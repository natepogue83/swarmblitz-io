import { Player, initPlayer, updateFrame, polygonArea } from "./core/index.js";
import { consts, config } from "../config.js";
import { MSG, encodePacket, decodePacket } from "./net/packet.js";
import * as SoundManager from "./sound-manager.js";
import { createLocalSession } from "./local-session.js";

// Helper to calculate XP needed for a level
function getXpForLevel(level) {
	const base = consts.XP_BASE_PER_LEVEL || 50;
	const growth = consts.XP_GROWTH_RATE || 1.15;
	return Math.round(base * Math.pow(growth, level - 1));
}

let running = false;
let user, socket, frame;
let players, allPlayers;
let coinsById = new Map();
let dronesById = new Map(); // Stores all drones keyed by id
let projectilesById = new Map(); // Stores all active projectiles keyed by id
let healPacksById = new Map(); // Stores all active heal packs keyed by id (Support drone passive)
let enemies = [];
let enemyStats = { runTime: 0, spawnInterval: 0, enemies: 0, kills: 0 };
let kills;
let useLocalSession = false; // Track if using local session vs WebSocket

// Upgrade system state
let upgradeChoices = null; // Current upgrade choices shown to player
let gamePaused = false; // True when upgrade or drone selection is pending

// Drone choice state
let droneChoices = null; // Current drone type choices shown to player
let droneChoiceIndex = -1; // Index of the drone slot being chosen
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
const clientTickRate = config.netTickRate || config.serverTickRate || config.fps || 60;

// Helper to send a message (handles both local and WebSocket mode)
function sendMessage(type, payload) {
	if (!socket || socket.readyState !== 1) return;
	if (useLocalSession) {
		socket.send([type, payload]);
	} else {
		socket.send(encodePacket(type, payload));
	}
}

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

// Public API
function connectGame(wsUrl, name, callback) {
	if (running) return;
	running = true;
	user = null;
	deadFrames = 0;
	
	const prefixes = consts.PREFIXES.split(" ");
	const names = consts.NAMES.split(" ");
	name = name || [prefixes[Math.floor(Math.random() * prefixes.length)], names[Math.floor(Math.random() * names.length)]].join(" ");
	
	// Use local session if no wsUrl provided (client-only mode)
	useLocalSession = !wsUrl;
	
	if (useLocalSession) {
		socket = createLocalSession();
		console.info("Starting local single-player game...");
	} else {
		socket = new WebSocket(wsUrl);
		socket.binaryType = "arraybuffer";
	}
	
	socket.addEventListener("open", () => {
		console.info(useLocalSession ? "Local session ready." : "Connected to server.");
		// Send HELLO message
		sendMessage(MSG.HELLO, {
			name: name,
			type: 0,
			gameid: -1
		});
	});
	
	socket.addEventListener("message", (event) => {
		// Decode message based on session type
		let type, data;
		if (useLocalSession) {
			// LocalSession passes plain objects
			[type, data] = event.data;
		} else {
			// WebSocket uses msgpack
			[type, data] = decodePacket(event.data);
		}
		
		if (type === MSG.HELLO_ACK) {
			if (data?.ok) {
				console.info("Connected to game!");
			} else {
				const msg = data?.error || "Unable to connect to game.";
				console.error("Unable to connect to game: " + msg);
				running = false;
				socket.close();
			}
			if (callback) callback(!!data?.ok, data?.error);
			return;
		}
		if (type === MSG.INIT) {
			handleInitState(data);
			return;
		}
		if (type === MSG.FRAME) {
			processFrame(data);
			return;
		}
		if (type === MSG.DEAD) {
			socket.close();
			return;
		}
		if (type === MSG.UPGRADE_OFFER) {
			// Server is offering upgrade choices - pause and show UI
			upgradeChoices = data.choices;
			gamePaused = true;
			invokeRenderer("showUpgradeUI", [data.choices, data.newLevel]);
			return;
		}
		if (type === MSG.DRONE_OFFER) {
			// Server is offering drone type choices - pause and show UI
			droneChoices = data.choices;
			droneChoiceIndex = data.droneIndex;
			gamePaused = true;
			invokeRenderer("showDroneUI", [data.choices, data.droneIndex, data.newDroneCount]);
			return;
		}
	});
	
	socket.addEventListener("close", () => {
		console.info(useLocalSession ? "Local session ended." : "Server has disconnected.");
		if (!user) return;
		user.die();
		dirty = true;
		paintLoop();
		running = false;
		invokeRenderer("disconnect", []);
	});
	
	socket.addEventListener("error", () => {
		console.error(useLocalSession ? "Local session error" : "WebSocket error");
	});
}

function handleInitState(data) {
	if (timeout != undefined) clearTimeout(timeout);
		
		frame = data.frame;
		reset();
		
		// Load XP pickups (coins)
		if (data.coins) {
			data.coins.forEach(c => coinsById.set(c.id, c));
		}
	
	if (data.enemies) {
		enemies = data.enemies;
	}
	if (data.enemyStats) {
		enemyStats = data.enemyStats;
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
			
			// Stamina fields
			pl.stamina = p.stamina ?? (consts.PLAYER_MAX_STAMINA ?? 100);
			pl.maxStamina = p.maxStamina ?? (consts.PLAYER_MAX_STAMINA ?? 100);
			
			// Derived stats from upgrades
			pl.derivedStats = p.derivedStats || null;
			
			// Drone fields
			pl.droneCount = p.droneCount || 1;
			pl.droneTypes = p.droneTypes || ['assault'];
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
	
	// Don't send input while game is paused (upgrade selection)
	if (gamePaused) return;
	
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
	
	// Update local user's targetAngle immediately for responsive aiming
	// (Don't wait for server round-trip)
	if (user) {
		user.targetAngle = targetAngle;
	}
	
	sendMessage(MSG.INPUT, {
		frame: frame,
		targetAngle: targetAngle
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

function getEnemies() {
	return enemies.slice();
}

function getProjectiles() {
	return Array.from(projectilesById.values());
}

function getHealPacks() {
	return Array.from(healPacksById.values());
}

function getEnemyStats() {
	return { ...enemyStats };
}

function disconnect() {
	window.removeEventListener("resize", sendViewportUpdate);
	if (socket) socket.close();
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
		sendMessage(MSG.REQUEST, null);
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
	
	if (data.coinUpdates) {
		data.coinUpdates.forEach(update => {
			const coin = coinsById.get(update.id);
			if (coin) {
				coin.x = update.x;
				coin.y = update.y;
			}
		});
	}
	
	if (data.gameMessages) {
		data.gameMessages.forEach(msg => {
			invokeRenderer("gameMessage", [msg.text, msg.duration]);
		});
	}
	
	if (data.enemies) {
		enemies = data.enemies;
	}
	if (data.enemyStats) {
		enemyStats = data.enemyStats;
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
				if (update.hp !== undefined) p.hp = update.hp;
				if (update.maxHp !== undefined) p.maxHp = update.maxHp;
				if (update.stamina !== undefined) p.stamina = update.stamina;
				if (update.maxStamina !== undefined) p.maxStamina = update.maxStamina;
				if (update.derivedStats !== undefined) p.derivedStats = update.derivedStats;
				if (update.upgrades !== undefined) p.upgrades = update.upgrades;
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
			if (p && update.drones && update.drones.length > 0) {
				// Build map of existing drones by ID for quick lookup
				const existingById = new Map();
				if (p.drones) {
					for (const d of p.drones) {
						existingById.set(d.id, d);
					}
				}
				
				// Build new drones array from update, merging with existing data
				const newDrones = [];
				for (const updateDrone of update.drones) {
					const existing = existingById.get(updateDrone.id);
					if (existing) {
						// Update existing drone in place
						existing.x = updateDrone.x;
						existing.y = updateDrone.y;
						existing.targetId = updateDrone.targetId;
						existing.ownerId = update.ownerNum;
						// Update type info
						if (updateDrone.typeId) existing.typeId = updateDrone.typeId;
						if (updateDrone.typeName) existing.typeName = updateDrone.typeName;
						if (updateDrone.typeColor) existing.typeColor = updateDrone.typeColor;
						if (updateDrone.attackType) existing.attackType = updateDrone.attackType;
						newDrones.push(existing);
						dronesById.set(existing.id, existing);
					} else {
						// New drone from server
						updateDrone.ownerId = update.ownerNum;
						newDrones.push(updateDrone);
						dronesById.set(updateDrone.id, updateDrone);
					}
				}
				
				// Only replace if we have drones to show
				if (newDrones.length > 0) {
					p.drones = newDrones;
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
			invokeRenderer("hitscan", [hit.fromX, hit.fromY, hit.toX, hit.toY, hit.ownerId, hit.damage, hit.attackType, hit.typeColor, hit.isCrit, hit.isChain, hit.isExplosion, hit.isHeatseekerDrone]);
		});
	}

	// Phase Shift visuals (gold flash when effect triggers)
	if (data.phaseShiftEvents) {
		data.phaseShiftEvents.forEach(evt => {
			invokeRenderer("phaseShiftUsed", [evt.playerNum, evt.x, evt.y]);
		});
	}

	// Adrenaline visuals (speed glow when activated)
	if (data.adrenalineEvents) {
		data.adrenalineEvents.forEach(evt => {
			invokeRenderer("adrenalineActivated", [evt.playerNum, evt.duration]);
		});
	}

	// Momentum sound cue (when stacking starts)
	if (data.momentumEvents) {
		data.momentumEvents.forEach(evt => {
			invokeRenderer("momentumStart", [evt.playerNum]);
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
	
	// Handle projectile spawns
	if (data.projectileSpawns) {
		data.projectileSpawns.forEach(proj => {
			projectilesById.set(proj.id, {
				id: proj.id,
				x: proj.x,
				y: proj.y,
				vx: proj.vx,
				vy: proj.vy,
				attackType: proj.attackType,
				typeColor: proj.typeColor,
				opacity: proj.opacity,
				size: proj.size,
				ownerId: proj.ownerId,
				isPlayerShot: proj.isPlayerShot,
				spawnTime: Date.now()
			});
			// Track when local player fires a shot from their aim dot
			if (proj.isPlayerShot && user && proj.ownerId === user.num) {
				user.lastShotTime = Date.now();
			}
			
			// Play fire sound for projectile weapons (non-hitscan)
			if (user && proj.attackType) {
				const isOwnShot = proj.ownerId === user.num;
				const dx = proj.x - user.x;
				const dy = proj.y - user.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				SoundManager.playProjectileFire(proj.attackType, distance, isOwnShot);
			}
		});
	}
	
	// Handle projectile updates
	if (data.projectileUpdates) {
		data.projectileUpdates.forEach(proj => {
			const existing = projectilesById.get(proj.id);
			if (existing) {
				existing.x = proj.x;
				existing.y = proj.y;
				existing.vx = proj.vx;
				existing.vy = proj.vy;
			}
		});
	}
	
	// Handle projectile removals
	if (data.projectileRemovals) {
		data.projectileRemovals.forEach(projId => {
			projectilesById.delete(projId);
		});
	}
	
	// Handle heal pack spawns (Support drone passive)
	if (data.healPackSpawns) {
		data.healPackSpawns.forEach(pack => {
			healPacksById.set(pack.id, {
				id: pack.id,
				x: pack.x,
				y: pack.y,
				healAmount: pack.healAmount,
				ownerId: pack.ownerId,
				spawnTime: Date.now()
			});
		});
	}
	
	// Handle missile spawns (Missile Pod upgrade)
	if (data.missileSpawns) {
		data.missileSpawns.forEach(missile => {
			invokeRenderer("missileSpawn", [missile.id, missile.x, missile.y, missile.vx, missile.vy, missile.ownerId]);
		});
	}
	
	// Handle missile updates
	if (data.missileUpdates) {
		data.missileUpdates.forEach(missile => {
			invokeRenderer("missileUpdate", [missile.id, missile.x, missile.y, missile.vx, missile.vy]);
		});
	}
	
	// Handle missile removals
	if (data.missileRemovals) {
		data.missileRemovals.forEach(missileId => {
			invokeRenderer("missileRemove", [missileId]);
		});
	}
	
	// Handle sticky charge detonations
	if (data.stickyChargeDetonations) {
		data.stickyChargeDetonations.forEach(det => {
			invokeRenderer("stickyChargeDetonate", [det.x, det.y, det.damage, det.charges, det.ownerId]);
		});
	}
	
	// Handle arc barrage bursts
	if (data.arcBarrageBursts) {
		data.arcBarrageBursts.forEach(burst => {
			invokeRenderer("arcBarrageBurst", [
				burst.x,
				burst.y,
				burst.radius,
				burst.playerNum,
				burst.damage,
				burst.hitCount,
				burst.hits
			]);
		});
	}
	
	// Handle heal pack updates
	if (data.healPackUpdates) {
		data.healPackUpdates.forEach(pack => {
			const existing = healPacksById.get(pack.id);
			if (existing) {
				existing.x = pack.x;
				existing.y = pack.y;
				existing.timeRemaining = pack.timeRemaining;
				existing.isBlinking = pack.isBlinking;
			}
		});
	}
	
	// Handle heal pack removals
	if (data.healPackRemovals) {
		data.healPackRemovals.forEach(packId => {
			healPacksById.delete(packId);
		});
	}
	
	// Handle heal pack pickups
	if (data.healPackPickups) {
		data.healPackPickups.forEach(pickup => {
			const pack = healPacksById.get(pickup.id);
			// Check if local player picked it up
			if (pack && user && pickup.playerNum === user.num) {
				invokeRenderer("healPackPickup", [pack, pickup.healAmount]);
			}
			healPacksById.delete(pickup.id);
		});
	}
	
	// Handle territory updates (when server sends changed territories)
	if (data.territoryUpdates) {
		data.territoryUpdates.forEach(update => {
			const player = allPlayers[update.num];
			if (player && update.territory) {
				player.territory = update.territory;
			}
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

	// Singleplayer: only update the local player from moves
	if (data.moves && user) {
		const move = data.moves.find(val => val.num === user.num);
		if (move) {
			if (move.left) user.die();
			user.targetAngle = move.targetAngle;
			
			// Sync position with server to prevent drift (especially for drones)
			if (move.x !== undefined && move.y !== undefined) {
				// Snap to server position when paused, lerp during normal play
				if (gamePaused) {
					user.x = move.x;
					user.y = move.y;
				} else {
					// Smooth correction to server position
					const correctionStrength = 0.3;
					user.x += (move.x - user.x) * correctionStrength;
					user.y += (move.y - user.y) * correctionStrength;
				}
			}
		}
	}
	
	update();
	
	dirty = true;
	requestAnimationFrame(paintLoop);
	
	timeout = setTimeout(() => {
		console.warn("Server has timed-out. Disconnecting.");
		if (socket) socket.close();
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
		if (socket) socket.close();
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
	enemies = [];
	enemyStats = { runTime: 0, spawnInterval: 0, enemies: 0, kills: 0 };
	kills = 0;
	invokeRenderer("reset");
}

function setUser(player) {
	user = player;
	invokeRenderer("setUser", [player]);
}

function update() {
	// Skip simulation update while upgrade UI is open (game paused)
	if (gamePaused) {
		invokeRenderer("update", [frame]);
		return;
	}
	
	const dead = [];
	updateFrame(players, dead, undefined, 1 / clientTickRate);
	
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

// Upgrade system functions
function selectUpgrade(upgradeId) {
	if (!socket || socket.readyState !== 1) return;
	if (!upgradeChoices || !gamePaused) return;
	
	// Validate the selection is one of the choices
	const validChoice = upgradeChoices.find(c => c.id === upgradeId);
	if (!validChoice) {
		console.warn("Invalid upgrade selection:", upgradeId);
		return;
	}
	
	// Send selection to server
	sendMessage(MSG.UPGRADE_PICK, { upgradeId });
	
	// Clear local state - unpause now, if drone choice follows it will re-pause
	upgradeChoices = null;
	gamePaused = false;
	
	// Notify renderer to hide UI
	invokeRenderer("hideUpgradeUI", []);
}

// Drone type selection functions
function selectDrone(droneTypeId) {
	if (!socket || socket.readyState !== 1) return;
	if (!droneChoices || droneChoices.length === 0) return;
	
	// Validate the selection is one of the choices
	const validChoice = droneChoices.find(c => c.id === droneTypeId);
	if (!validChoice) {
		console.warn("Invalid drone selection:", droneTypeId);
		return;
	}
	
	// Send selection to server
	sendMessage(MSG.DRONE_PICK, { droneTypeId });
	
	// Clear local state (server will resume)
	droneChoices = null;
	droneChoiceIndex = -1;
	gamePaused = false;
	
	// Notify renderer to hide UI
	invokeRenderer("hideDroneUI", []);
}

function getUpgradeChoices() {
	return upgradeChoices;
}

function getDroneChoices() {
	return droneChoices;
}

function isGamePaused() {
	return gamePaused;
}

function setGamePaused(paused) {
	gamePaused = paused;
	// Send pause state to server so it stops simulation
	sendMessage(MSG.PAUSE, { paused });
}

// ===== DEV CONSOLE COMMANDS =====
function devGiveXP(amount) {
	sendMessage(MSG.DEV_CMD, { cmd: 'giveXP', amount });
}

function devSetLevel(level) {
	sendMessage(MSG.DEV_CMD, { cmd: 'setLevel', level });
}

function devGiveUpgrade(upgradeId) {
	sendMessage(MSG.DEV_CMD, { cmd: 'giveUpgrade', upgradeId });
}

function devHeal() {
	sendMessage(MSG.DEV_CMD, { cmd: 'heal' });
}

function devGodMode() {
	sendMessage(MSG.DEV_CMD, { cmd: 'godMode' });
}

function devAddDrone(droneTypeId) {
	sendMessage(MSG.DEV_CMD, { cmd: 'addDrone', droneTypeId });
}

function devClearDrones() {
	sendMessage(MSG.DEV_CMD, { cmd: 'clearDrones' });
}

// Export stuff
export { 
	connectGame, 
	getUser, 
	getPlayers, 
	getOthers, 
	getCoins,
	getDrones,
	getProjectiles,
	getHealPacks,
	getEnemies,
	getEnemyStats,
	disconnect, 
	setRenderer, 
	setAllowAnimation, 
	getKills,
	updateMousePosition,
	sendTargetAngle,
	setViewOffset,
	updateZoom,
	setKeyState,
	polygonArea,
	selectUpgrade,
	getUpgradeChoices,
	selectDrone,
	getDroneChoices,
	isGamePaused,
	setGamePaused,
	// Dev commands
	devGiveXP,
	devSetLevel,
	devGiveUpgrade,
	devHeal,
	devGodMode,
	devAddDrone,
	devClearDrones
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
