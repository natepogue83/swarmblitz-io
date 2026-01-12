import { Player, initPlayer, updateFrame, polygonArea } from "./core/index.js";
import { consts } from "../config.js";

let running = false;
let user, socket, frame;
let players, allPlayers;
let coinsById = new Map();
let turretsById = new Map();
let projectilesById = new Map();
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

let requestAnimationFrame;
try {
	requestAnimationFrame = window.requestAnimationFrame;
} catch {
	requestAnimationFrame = callback => { setTimeout(callback, 1000 / 30) };
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
	
	socket.on("game", data => {
		if (timeout != undefined) clearTimeout(timeout);
		
		frame = data.frame;
		reset();
		
		// Load XP pickups (coins)
		if (data.coins) {
			data.coins.forEach(c => coinsById.set(c.id, c));
		}
		
		// Load turrets
		if (data.turrets) {
			data.turrets.forEach(t => turretsById.set(t.id, t));
		}
		
		// Load projectiles
		if (data.projectiles) {
			data.projectiles.forEach(p => projectilesById.set(p.id, p));
		}

		// Load players
		data.players.forEach(p => {
			const pl = new Player(p);
			// Copy stat multipliers
			pl.staminaRegenMult = p.staminaRegenMult || 1.0;
			pl.staminaDrainMult = p.staminaDrainMult || 1.0;
			pl.speedMult = p.speedMult || 1.0;
			pl.snipGraceBonusSec = p.snipGraceBonusSec || 0;
			
			// XP/Level fields
			pl.level = p.level || 1;
			pl.xp = p.xp || 0;
			pl.sizeScale = p.sizeScale || 1.0;
			
			// HP fields
			pl.hp = p.hp ?? (consts.PLAYER_MAX_HP || 100);
			pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP || 100);
			
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
	
	socket.emit("hello", {
		name: name,
		type: 0,
		gameid: -1,
		god: flag
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
	if (!user || user.dead || !socket || !mouseSet) return;
	
	// Update world mouse position based on last screen position and current view offset.
	mouseX = (lastScreenX / lastZoom) + viewOffset.x;
	mouseY = (lastScreenY / lastZoom) + viewOffset.y;

	// Calculate angle from player to mouse position
	const dx = mouseX - user.x;
	const dy = mouseY - user.y;
	
	// If mouse is too close to player center, don't update angle
	if (dx * dx + dy * dy < 100) return;
	
	const targetAngle = Math.atan2(dy, dx);
	
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

function getTurrets() {
	return Array.from(turretsById.values());
}

function getProjectiles() {
	return Array.from(projectilesById.values());
}

function getDrones() {
	return Array.from(dronesById.values());
}

function disconnect() {
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
		data.coinRemovals.forEach(id => coinsById.delete(id));
	}
	
	// Handle XP/Level updates
	if (data.xpUpdates) {
		data.xpUpdates.forEach(update => {
			const p = allPlayers[update.num];
			if (p) {
				p.level = update.level;
				p.xp = update.xp;
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
	
	// Handle drone updates (positions, HP, targeting)
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
	
	// Handle turret updates
	if (data.turretSpawns) {
		data.turretSpawns.forEach(t => turretsById.set(t.id, t));
	}
	if (data.turretRemovals) {
		data.turretRemovals.forEach(id => turretsById.delete(id));
	}
	if (data.turretUpdates) {
		data.turretUpdates.forEach(update => {
			const t = turretsById.get(update.id);
			if (t) {
				// Check if ownership changed (turret captured)
				const ownerChanged = update.ownerId !== undefined && t.ownerId !== update.ownerId;
				
				if (update.targetId !== undefined) t.targetId = update.targetId;
				if (update.hp !== undefined) t.hp = update.hp;
				// Handle turret capture (ownership transfer)
				if (update.ownerId !== undefined) t.ownerId = update.ownerId;
				if (update.ringIndex !== undefined) t.ringIndex = update.ringIndex;
				if (update.damage !== undefined) t.damage = update.damage;
				if (update.range !== undefined) t.range = update.range;
				if (update.cooldown !== undefined) t.cooldown = update.cooldown;
				if (update.maxHp !== undefined) t.maxHp = update.maxHp;
				
				// Notify renderer of turret capture for visual effect
				if (ownerChanged) {
					const newOwner = allPlayers[t.ownerId];
					invokeRenderer("turretCaptured", [t.x, t.y, newOwner]);
				}
			}
		});
	}
	// Handle projectile updates
	if (data.projectileSpawns) {
		data.projectileSpawns.forEach(p => projectilesById.set(p.id, p));
	}
	if (data.projectileRemovals) {
		data.projectileRemovals.forEach(id => projectilesById.delete(id));
	}
	if (data.projectileHits) {
		// Notify renderer of projectile hits for visual effects
		data.projectileHits.forEach(hit => {
			const target = allPlayers[hit.targetNum];
			if (target) {
				// Use server's authoritative HP value
				if (hit.remainingHp !== undefined) {
					target.hp = hit.remainingHp;
				} else {
					// Fallback to local calculation
					target.hp = Math.max(0, (target.hp || 100) - hit.damage);
				}
			}
			invokeRenderer("projectileHit", [hit.x, hit.y, hit.damage]);
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

	if (data.newPlayers) {
		data.newPlayers.forEach(p => {
			if (user && p.num === user.num) return;
			const pl = new Player(p);
			// Copy XP/Level fields
			pl.level = p.level || 1;
			pl.xp = p.xp || 0;
			pl.sizeScale = p.sizeScale || 1.0;
			// HP fields
			pl.hp = p.hp ?? (consts.PLAYER_MAX_HP || 100);
			pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP || 100);
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
	turretsById.clear();
	projectilesById.clear();
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
	updateFrame(players, dead, (killer, other) => {
		if (players[killer] === user && killer !== other) kills++;
	});
	
	dead.forEach(val => {
		console.log((val.name || "Unnamed") + " is dead");
		delete allPlayers[val.num];
		invokeRenderer("removePlayer", [val]);
	});
	
	// Update projectile positions locally (client-side interpolation)
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	for (const [id, proj] of projectilesById) {
		// Move projectile based on velocity
		proj.x += proj.vx;
		proj.y += proj.vy;
		
		// Remove if out of bounds (client-side cleanup for smooth visuals)
		if (proj.x < 0 || proj.x > mapSize || proj.y < 0 || proj.y > mapSize) {
			projectilesById.delete(id);
		}
	}
	
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

// Export stuff
export { 
	connectGame, 
	getUser, 
	getPlayers, 
	getOthers, 
	getCoins,
	getTurrets,
	getProjectiles,
	getDrones,
	disconnect, 
	setRenderer, 
	setAllowAnimation, 
	getKills,
	updateMousePosition,
	sendTargetAngle,
	setViewOffset,
	updateZoom,
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
