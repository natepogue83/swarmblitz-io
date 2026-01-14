import { Player, initPlayer, updateFrame, polygonArea } from "./core/index.js";
import { consts } from "../config.js";

// Helper to calculate XP needed for a level
function getXpForLevel(level) {
	const base = consts.XP_BASE_PER_LEVEL || 50;
	const increment = consts.XP_INCREMENT_PER_LEVEL || 25;
	return base + (level - 1) * increment;
}

let running = false;
let user, socket, frame;
let players, allPlayers;
let coinsById = new Map();
let dronesById = new Map(); // Stores all drones keyed by id
let kills;
let timeout = undefined;
let dirty = false;
let deadFrames = 0;
let requesting = -1;
let frameCache = [];
let _allowAnimation = true;
let renderer;
let mouseX = 0, mouseY = 0;
let lastScreenX = 0, lastScreenY = 0;
let lastZoom = 1;
let mouseSet = false;
let viewOffset = { x: 0, y: 0 };

// WASD keyboard control state
let wasdKeys = { w: false, a: false, s: false, d: false };
let useWasd = false; // True when WASD keys are being pressed
let wasdCurrentAngle = 0; // Current smoothed WASD angle
let wasdTargetAngle = 0; // Target angle based on key presses
const WASD_TURN_SPEED = 0.15; // Radians per frame for smooth turning

let requestAnimationFrame;
try {
	requestAnimationFrame = window.requestAnimationFrame;
} catch {
	requestAnimationFrame = callback => { setTimeout(callback, 1000 / 30) };
}

// Get current viewport dimensions for AOI calculation
function getViewportDimensions() {
	// Use the actual window dimensions
	const width = window.innerWidth || document.documentElement.clientWidth || 800;
	const height = window.innerHeight || document.documentElement.clientHeight || 600;
	return { width, height };
}

// Send viewport update to server
function sendViewportUpdate() {
	if (socket && socket.connected) {
		const viewport = getViewportDimensions();
		socket.emit("viewport", viewport);
	}
}

// Public API
function connectGame(io, url, name, callback, flag) {
	if (running) return;
	running = true;
	user = null;
	deadFrames = 0;
	
	const prefixes = consts.PREFIXES.split(" ");
	const names = consts.NAMES.split(" ");
	name = name || [prefixes[Math.floor(Math.random() * prefixes.length)], names[Math.floor(Math.random() * names.length)]].join(" ");
	
	io.j = [];
	io.sockets = [];
	socket = io(url, {
		"forceNew": true,
		upgrade: false,
		transports: ["websocket"]
	});
	
	socket.on("connect", () => {
		console.info("Connected to server.");
	});
	
	// Listen for window resize to update AOI on server
	window.addEventListener("resize", sendViewportUpdate);
	
	socket.on("game", data => {
		if (timeout != undefined) clearTimeout(timeout);
		
		frame = data.frame;
		reset();
		
		// Load XP pickups (coins)
		if (data.coins) {
			data.coins.forEach(c => coinsById.set(c.id, c));
		}

		// Load players
		data.players.forEach(p => {
			const pl = new Player(p);
			// Copy stat multipliers
			pl.speedMult = p.speedMult || 1.0;
			pl.snipGraceBonusSec = p.snipGraceBonusSec || 0;
			
			// XP/Level fields
			pl.level = p.level || 1;
			pl.xp = p.xp || 0;
			pl.xpPerLevel = p.xpPerLevel || getXpForLevel(pl.level);
			pl.sizeScale = p.sizeScale || 1.0;
			
			// HP fields
			pl.hp = p.hp ?? (consts.PLAYER_MAX_HP ?? 100);
			pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP ?? 100);
			
			// Drone fields
			pl.droneCount = p.droneCount || 1;
			pl.drones = p.drones || [];
			// Store drones in the map
			for (const d of pl.drones) {
				dronesById.set(d.id, d);
			}
			
			addPlayer(pl);
			if (!p.territory || p.territory.length === 0) {
				initPlayer(pl);
			}
		});
		
		user = allPlayers[data.num];
		setUser(user);
		
		invokeRenderer("paint", []);
		frame = data.frame;
		
		if (requesting !== -1) {
			const minFrame = requesting;
			requesting = -1;
			while (frameCache.length > frame - minFrame) {
				processFrame(frameCache[frame - minFrame]);
			}
			frameCache = [];
		}
	});
	
	socket.on("notifyFrame", processFrame);
	
	socket.on("dead", () => {
		socket.disconnect();
	});
	
	socket.on("disconnect", () => {
		console.info("Server has disconnected. Creating new game.");
		socket.disconnect();
		if (!user) return;
		user.die();
		dirty = true;
		paintLoop();
		running = false;
		invokeRenderer("disconnect", []);
	});
	
	const viewport = getViewportDimensions();
	socket.emit("hello", {
		name: name,
		type: 0,
		gameid: -1,
		god: flag,
		viewport: viewport  // Send initial viewport dimensions
	}, (success, msg) => {
		if (success) console.info("Connected to game!");
		else {
			console.error("Unable to connect to game: " + msg);
			running = false;
		}
		if (callback) callback(success, msg);
	});
}

function updateMousePosition(clientX, clientY, canvasRect, canvasWidth, canvasHeight, zoom) {
	if (!user) return;
	
	// Store screen position and zoom for continuous updates
	lastScreenX = clientX - canvasRect.left;
	const screenY = clientY - canvasRect.top;
	
	const BAR_HEIGHT = 45;
	lastScreenY = screenY - BAR_HEIGHT;
	lastZoom = zoom;
	mouseSet = true;
	
	// Convert to world coordinates
	mouseX = (lastScreenX / lastZoom) + viewOffset.x;
	mouseY = (lastScreenY / lastZoom) + viewOffset.y;
}

function setViewOffset(x, y) {
	viewOffset.x = x;
	viewOffset.y = y;
}

function updateZoom(zoom) {
	lastZoom = zoom;
}

function sendTargetAngle() {
	if (!user || user.dead || !socket) return;
	
	let targetAngle;
	
	// Check if WASD is being used
	if (useWasd) {
		// Calculate target direction from WASD keys
		let dx = 0, dy = 0;
		if (wasdKeys.w) dy -= 1;
		if (wasdKeys.s) dy += 1;
		if (wasdKeys.a) dx -= 1;
		if (wasdKeys.d) dx += 1;
		
		// If no keys pressed, don't send update
		if (dx === 0 && dy === 0) return;
		
		// Calculate target angle from key combination
		wasdTargetAngle = Math.atan2(dy, dx);
		
		// Smoothly interpolate current angle toward target (omnidirectional)
		let angleDiff = wasdTargetAngle - wasdCurrentAngle;
		
		// Normalize angle difference to [-PI, PI]
		while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
		while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
		
		// Smoothly turn toward target
		if (Math.abs(angleDiff) < WASD_TURN_SPEED) {
			wasdCurrentAngle = wasdTargetAngle;
		} else {
			wasdCurrentAngle += Math.sign(angleDiff) * WASD_TURN_SPEED;
		}
		
		// Normalize current angle to [-PI, PI]
		while (wasdCurrentAngle > Math.PI) wasdCurrentAngle -= Math.PI * 2;
		while (wasdCurrentAngle < -Math.PI) wasdCurrentAngle += Math.PI * 2;
		
		targetAngle = wasdCurrentAngle;
	} else {
		// Mouse control
		if (!mouseSet) return;
		
		// Update world mouse position based on last screen position and current view offset.
		mouseX = (lastScreenX / lastZoom) + viewOffset.x;
		mouseY = (lastScreenY / lastZoom) + viewOffset.y;

		// Calculate angle from player to mouse position
		const dx = mouseX - user.x;
		const dy = mouseY - user.y;
		
		// If mouse is too close to player center, don't update angle
		if (dx * dx + dy * dy < 100) return;
		
		targetAngle = Math.atan2(dy, dx);
		
		// Sync WASD angle with mouse when not using WASD (for smooth transition)
		wasdCurrentAngle = targetAngle;
	}
	
	socket.emit("frame", {
		frame: frame,
		targetAngle: targetAngle
	}, (success, msg) => {
		if (!success) console.error(msg);
	});
}

function getUser() {
	return user;
}

function getPlayers() {
	return players.slice();
}

function getOthers() {
	const ret = [];
	for (const p of players) {
		if (p !== user) ret.push(p);
	}
	return ret;
}

function getCoins() {
	return Array.from(coinsById.values());
}

function getDrones() {
	return Array.from(dronesById.values());
}

function disconnect() {
	window.removeEventListener("resize", sendViewportUpdate);
	socket.disconnect();
	running = false;
}

// Private API
function addPlayer(player) {
	if (allPlayers[player.num]) return;
	allPlayers[player.num] = players[players.length] = player;
	invokeRenderer("addPlayer", [player]);
	return players.length - 1;
}

function invokeRenderer(name, args) {
	if (renderer && typeof renderer[name] === "function") {
		renderer[name].apply(null, args);
	}
}

function processFrame(data) {
	if (timeout != undefined) clearTimeout(timeout);
	
	if (requesting !== -1 && requesting < data.frame) {
		frameCache.push(data);
		return;
	}
	
	if (data.frame - 1 !== frame) {
		console.error("Frames don't match up!");
		socket.emit("requestFrame");
		requesting = data.frame;
		frameCache.push(data);
		return;
	}
	
	frame++;
	
	// Handle economy deltas
	if (data.coinSpawns) {
		// Check for death loot coins (have fromDeath flag)
		const deathLootCoins = data.coinSpawns.filter(c => c.fromDeath);
		if (deathLootCoins.length > 0) {
			// Group by origin point
			const originX = deathLootCoins[0].originX;
			const originY = deathLootCoins[0].originY;
			invokeRenderer("spawnLootCoins", [originX, originY, deathLootCoins]);
		}
		data.coinSpawns.forEach(c => coinsById.set(c.id, c));
	}
	if (data.coinRemovals) {
		data.coinRemovals.forEach(id => {
			const coin = coinsById.get(id);
			// Check if coin was near the local player (player picked it up)
			if (coin && user && !user.dead) {
				const dx = coin.x - user.x;
				const dy = coin.y - user.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				// If coin was within pickup range, notify renderer
				if (dist < 60) {
					invokeRenderer("coinPickup", [coin]);
				}
			}
			coinsById.delete(id);
		});
	}
	
	// Handle XP/Level updates
	if (data.xpUpdates) {
		data.xpUpdates.forEach(update => {
			const p = allPlayers[update.num];
			if (p) {
				p.level = update.level;
				p.xp = update.xp;
				p.xpPerLevel = update.xpPerLevel; // Store XP needed for next level
				p.sizeScale = update.sizeScale;
				// Update drone count
				if (update.droneCount !== undefined) {
					p.droneCount = update.droneCount;
				}
			}
		});
	}
	
	// Handle level-up events (for visual feedback)
	if (data.levelUps) {
		data.levelUps.forEach(levelUp => {
			invokeRenderer("levelUp", [levelUp.x, levelUp.y, levelUp.newLevel, allPlayers[levelUp.playerNum]]);
		});
	}
	
	// Handle drone updates (positions, targeting)
	if (data.droneUpdates) {
		data.droneUpdates.forEach(update => {
			const p = allPlayers[update.ownerNum];
			if (p) {
				// Update player's drones array
				p.drones = update.drones || [];
				// Update global drone map
				for (const d of p.drones) {
					d.ownerId = update.ownerNum;
					dronesById.set(d.id, d);
				}
			}
		});
	}
	
	// Handle hitscan events (drone laser shots)
	if (data.hitscanEvents) {
		data.hitscanEvents.forEach(hit => {
			const target = allPlayers[hit.targetNum];
			if (target) {
				// Use server's authoritative HP value
				if (hit.remainingHp !== undefined) {
					target.hp = hit.remainingHp;
				} else {
					// Fallback to local calculation
					target.hp = Math.max(0, (target.hp || 100) - hit.damage);
				}
				// Track last hit time for HP bar visibility
				target.lastHitTime = Date.now();
			}
			// Notify renderer of hitscan for visual effect (laser line)
			invokeRenderer("hitscan", [hit.fromX, hit.fromY, hit.toX, hit.toY, hit.ownerId, hit.damage]);
		});
	}
	
	// Handle capture events for visual feedback
	if (data.captureEvents) {
		data.captureEvents.forEach(evt => {
			const player = allPlayers[evt.playerNum];
			const isLocalPlayer = user && evt.playerNum === user.num;
			invokeRenderer("captureSuccess", [evt.x, evt.y, evt.xpGained, player, isLocalPlayer]);
		});
	}
	
	// Handle kill events (for kill sound and counter)
	if (data.killEvents) {
		data.killEvents.forEach(evt => {
			// Check if local player got the kill
			if (user && evt.killerNum === user.num) {
				kills++;
				invokeRenderer("playerKill", [evt.killerNum, evt.victimNum, evt.victimName, evt.killType]);
			}
			// Check if local player was killed
			if (user && evt.victimNum === user.num) {
				const killer = allPlayers[evt.killerNum];
				const killerName = killer ? (killer.name || 'Unknown') : 'Unknown';
				invokeRenderer("playerWasKilled", [killerName, evt.killType]);
			}
		});
	}

	if (data.newPlayers) {
		data.newPlayers.forEach(p => {
			if (user && p.num === user.num) return;
			const pl = new Player(p);
			// Copy XP/Level fields
			pl.level = p.level || 1;
			pl.xp = p.xp || 0;
			pl.xpPerLevel = p.xpPerLevel || getXpForLevel(pl.level);
			pl.sizeScale = p.sizeScale || 1.0;
			// HP fields
			pl.hp = p.hp ?? (consts.PLAYER_MAX_HP ?? 100);
			pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP ?? 100);
			// Drone fields
			pl.droneCount = p.droneCount || 1;
			pl.drones = p.drones || [];
			for (const d of pl.drones) {
				dronesById.set(d.id, d);
			}
			addPlayer(pl);
			if (!p.territory || p.territory.length === 0) {
				initPlayer(pl);
			}
		});
	}
	
	// Handle players leaving AOI (server stopped sending them)
	if (data.leftPlayers) {
		data.leftPlayers.forEach(num => {
			const p = allPlayers[num];
			if (p && p !== user) {
				// Remove their drones from the map
				if (p.drones) {
					for (const d of p.drones) {
						dronesById.delete(d.id);
					}
				}
				// Remove from players array
				const idx = players.indexOf(p);
				if (idx !== -1) {
					players.splice(idx, 1);
				}
				delete allPlayers[num];
				invokeRenderer("removePlayer", [p]);
			}
		});
	}
	
	// IMPORTANT: never rely on array index alignment between server `moves[]` and local `players[]`.
	// Players can be added/removed and local ordering can drift, which would randomly kill the wrong player.
	const presentNums = new Set();
	data.moves.forEach(val => {
		presentNums.add(val.num);
		const player = allPlayers[val.num];
		if (!player) return;
		if (val.left) player.die();
		player.targetAngle = val.targetAngle;
	});
	
	// Any locally-known player that isn't in the server moves list this frame should be considered gone/dead.
	for (const p of players) {
		if (p && !presentNums.has(p.num)) {
			p.die();
		}
	}
	
	update();
	
	dirty = true;
	requestAnimationFrame(paintLoop);
	
	timeout = setTimeout(() => {
		console.warn("Server has timed-out. Disconnecting.");
		socket.disconnect();
	}, 3000);
}

function paintLoop() {
	if (!dirty) return;
	invokeRenderer("paint", []);
	dirty = false;
	
	if (user && user.dead) {
		if (timeout) clearTimeout(timeout);
		if (deadFrames === 60) {
			const before = _allowAnimation;
			_allowAnimation = false;
			update();
			invokeRenderer("paint", []);
			_allowAnimation = before;
			user = null;
			deadFrames = 0;
			return;
		}
		socket.disconnect();
		deadFrames++;
		dirty = true;
		update();
		requestAnimationFrame(paintLoop);
	}
}

function reset() {
	user = null;
	players = [];
	allPlayers = [];
	coinsById.clear();
	dronesById.clear();
	kills = 0;
	invokeRenderer("reset");
}

function setUser(player) {
	user = player;
	invokeRenderer("setUser", [player]);
}

function update() {
	const dead = [];
	updateFrame(players, dead);
	
	dead.forEach(val => {
		console.log((val.name || "Unnamed") + " is dead");
		delete allPlayers[val.num];
		invokeRenderer("removePlayer", [val]);
	});
	
	invokeRenderer("update", [frame]);
}

function setRenderer(r) {
	renderer = r;
}

function setAllowAnimation(allow) {
	_allowAnimation = allow;
}

function getKills() {
	return kills;
}

// WASD key state management
function setKeyState(key, pressed) {
	const k = key.toLowerCase();
	if (k in wasdKeys) {
		wasdKeys[k] = pressed;
		// Check if any WASD key is pressed
		useWasd = wasdKeys.w || wasdKeys.a || wasdKeys.s || wasdKeys.d;
	}
}

// Export stuff
export { 
	connectGame, 
	getUser, 
	getPlayers, 
	getOthers, 
	getCoins,
	getDrones,
	disconnect, 
	setRenderer, 
	setAllowAnimation, 
	getKills,
	updateMousePosition,
	sendTargetAngle,
	setViewOffset,
	updateZoom,
	setKeyState,
	polygonArea
};

export const allowAnimation = {
	get: function() {
		return _allowAnimation;
	},
	set: function(val) {
		_allowAnimation = !!val;
	},
	enumerable: true
};
