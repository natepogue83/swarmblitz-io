import { Color, Player, initPlayer, updateFrame, polygonArea, pointInPolygon, PLAYER_RADIUS } from "./core/index.js";
import Enemy from "./core/enemy.js";
import EnemySpawner, { ENEMY_TYPES, BOSS_TYPES } from "./core/enemy-spawner.js";
import { consts } from "../config.js";
import { MSG } from "./net/packet.js";
import { rollUpgradeChoices, selectUpgrade, initPlayerUpgrades, serializeUpgrades } from "./core/upgrade-system.js";

// Debug logging (keep off by default for performance)
const DEBUG_LEVELING_LOGS = false;
const DEBUG_HITSCAN_LOGS = false;
const DEBUG_KILL_REWARD_LOGS = false;

// ===== AREA OF INTEREST (AOI) OPTIMIZATION =====
// Instead of sending all player data to everyone, each player only receives
// data about players within their AOI radius. This reduces O(N²) to O(N×K).
// AOI radius is now DYNAMIC based on each player's viewport size
const AOI_MIN_RADIUS = consts.AOI_MIN_RADIUS ?? 400;   // Minimum AOI radius
const AOI_BUFFER = consts.AOI_BUFFER ?? 150;           // Extra buffer beyond viewport (spawn off-screen)
const AOI_HYSTERESIS = consts.AOI_HYSTERESIS ?? 100;   // Extra buffer before removing from AOI (prevents flicker)
const GRID_CELL_SIZE = consts.AOI_GRID_SIZE ?? 200;    // Spatial grid cell size

// Calculate AOI radius for a player based on their viewport
function calculateAOIRadius(viewport) {
	if (!viewport || !viewport.width || !viewport.height) {
		return AOI_MIN_RADIUS;
	}
	// Use the diagonal of the viewport plus buffer to ensure nothing pops in on screen
	// diagonal = sqrt(width² + height²) / 2 (half because player is centered)
	const halfDiagonal = Math.sqrt(viewport.width * viewport.width + viewport.height * viewport.height) / 2;
	return Math.max(AOI_MIN_RADIUS, halfDiagonal + AOI_BUFFER);
}

function createEconomyDeltas() {
	return {
		coinSpawns: [],
		coinRemovals: [],
		xpUpdates: [],
		levelUps: [],
		hitscanEvents: [],
		captureEvents: [],
		droneUpdates: [],
		killEvents: []
	};
}

function mergeEconomyDeltas(target, source) {
	target.coinSpawns.push(...source.coinSpawns);
	target.coinRemovals.push(...source.coinRemovals);
	target.xpUpdates.push(...source.xpUpdates);
	target.levelUps.push(...source.levelUps);
	target.hitscanEvents.push(...source.hitscanEvents);
	target.captureEvents.push(...source.captureEvents);
	target.droneUpdates.push(...source.droneUpdates);
	target.killEvents.push(...source.killEvents);
}

// ===== XP HELPER =====
// Calculate XP needed to reach the next level from current level
function getXpForLevel(level) {
	const base = consts.XP_BASE_PER_LEVEL || 50;
	const increment = consts.XP_INCREMENT_PER_LEVEL || 15;
	return base + (level - 1) * increment;
}

// ===== DRONE SYSTEM =====

let nextDroneId = 0;

/**
 * Create a drone entity.
 * @param {number} ownerId - Player number who owns this drone
 * @param {number} orbitAngleOffset - Starting angle offset for orbit
 * @param {number} droneIndex - Index of this drone (0 = first drone, 1+ = additional)
 */
function createDrone(ownerId, orbitAngleOffset, droneIndex) {
	// First drone does full damage, additional drones do reduced damage
	const baseDamage = consts.DRONE_DAMAGE || 10;
	const extraDamage = consts.DRONE_DAMAGE_EXTRA || 5;
	const damage = droneIndex === 0 ? baseDamage : extraDamage;
	
	return {
		id: nextDroneId++,
		ownerId,
		x: 0,
		y: 0,
		damage: damage,
		range: consts.DRONE_RANGE || 200,
		cooldownRemaining: 0,
		orbitRadius: consts.DRONE_ORBIT_RADIUS || 55,
		orbitAngleOffset,           // Starting offset for this drone (evenly spaced)
		currentOrbitAngle: orbitAngleOffset,  // Current angle (animated)
		targetId: null,
		droneIndex: droneIndex      // Track which drone this is for damage calculation
	};
}

/**
 * Rebuild drone array with evenly spaced orbit offsets.
 * Preserves cooldown of existing drones where possible.
 * First drone does full damage, additional drones do reduced damage.
 */
function rebuildDronesArray(player, count) {
	const oldDrones = player.drones || [];
	const newDrones = [];
	
	const baseDamage = consts.DRONE_DAMAGE || 10;
	const extraDamage = consts.DRONE_DAMAGE_EXTRA || 5;
	
	for (let i = 0; i < count; i++) {
		const offset = (i * Math.PI * 2) / count;
		// First drone (index 0) does full damage, rest do reduced
		const damage = i === 0 ? baseDamage : extraDamage;
		
		// Try to reuse existing drone data (preserve cooldown)
		if (i < oldDrones.length) {
			const old = oldDrones[i];
			old.orbitAngleOffset = offset;
			// Update current orbit angle to maintain smooth spacing
			old.currentOrbitAngle = offset;
			old.droneIndex = i;
			old.damage = damage;  // Update damage based on new position
			newDrones.push(old);
		} else {
			// Create new drone with proper index
			newDrones.push(createDrone(player.num, offset, i));
		}
	}
	
	player.drones = newDrones;
	player.droneCount = count;

	// IMPORTANT: newly created drones start at (0,0). If we send a frame before the next
	// orbit update, clients will see a one-frame "blip" at the map origin. Initialize
	// positions immediately so drones always spawn at the correct orbit location.
	updateDronePositions(player, 0);
}

/**
 * Update drone positions to orbit around player.
 * @param {Object} player - The player whose drones to update
 * @param {number} deltaSeconds - Time elapsed since last update
 */
function updateDronePositions(player, deltaSeconds) {
	if (!player.drones) return;
	
	const orbitSpeed = consts.DRONE_ORBIT_SPEED || 1.5; // radians per second
	
	for (const drone of player.drones) {
		// Continuously rotate the drone's orbit angle
		drone.currentOrbitAngle += orbitSpeed * deltaSeconds;
		
		// Keep angle in [0, 2*PI] range to prevent floating point issues
		if (drone.currentOrbitAngle > Math.PI * 2) {
			drone.currentOrbitAngle -= Math.PI * 2;
		}
		
		// Calculate position based on player center and current orbit angle
		drone.x = player.x + Math.cos(drone.currentOrbitAngle) * drone.orbitRadius;
		drone.y = player.y + Math.sin(drone.currentOrbitAngle) * drone.orbitRadius;
		drone.ownerId = player.num;
	}
}

// ===== SPATIAL GRID =====
// Efficiently find nearby players without checking every player
class SpatialGrid {
	constructor(mapSize, cellSize) {
		this.cellSize = cellSize;
		this.gridWidth = Math.ceil(mapSize / cellSize);
		this.cells = new Map();  // Map of "x,y" -> Set of players
	}
	
	_cellKey(x, y) {
		const cx = Math.floor(x / this.cellSize);
		const cy = Math.floor(y / this.cellSize);
		return `${cx},${cy}`;
	}
	
	_cellCoords(x, y) {
		return {
			cx: Math.floor(x / this.cellSize),
			cy: Math.floor(y / this.cellSize)
		};
	}
	
	insert(player) {
		const key = this._cellKey(player.x, player.y);
		if (!this.cells.has(key)) {
			this.cells.set(key, new Set());
		}
		this.cells.get(key).add(player);
		player._gridCell = key;
	}
	
	remove(player) {
		if (player._gridCell && this.cells.has(player._gridCell)) {
			this.cells.get(player._gridCell).delete(player);
		}
		player._gridCell = null;
	}
	
	update(player) {
		const newKey = this._cellKey(player.x, player.y);
		if (player._gridCell !== newKey) {
			this.remove(player);
			this.insert(player);
		}
	}
	
	// Get all players within radius of a point
	getNearby(x, y, radius) {
		const nearby = [];
		const cellRadius = Math.ceil(radius / this.cellSize);
		const { cx, cy } = this._cellCoords(x, y);
		
		for (let dx = -cellRadius; dx <= cellRadius; dx++) {
			for (let dy = -cellRadius; dy <= cellRadius; dy++) {
				const key = `${cx + dx},${cy + dy}`;
				const cell = this.cells.get(key);
				if (cell) {
					for (const player of cell) {
						const dist = Math.hypot(player.x - x, player.y - y);
						if (dist <= radius) {
							nearby.push(player);
						}
					}
				}
			}
		}
		return nearby;
	}
	
	// Get all players within radius, including a buffer zone
	getNearbyWithBuffer(x, y, radius, buffer) {
		const nearby = [];
		const inBuffer = [];
		const cellRadius = Math.ceil((radius + buffer) / this.cellSize);
		const { cx, cy } = this._cellCoords(x, y);
		
		for (let dx = -cellRadius; dx <= cellRadius; dx++) {
			for (let dy = -cellRadius; dy <= cellRadius; dy++) {
				const key = `${cx + dx},${cy + dy}`;
				const cell = this.cells.get(key);
				if (cell) {
					for (const player of cell) {
						const dist = Math.hypot(player.x - x, player.y - y);
						if (dist <= radius) {
							nearby.push(player);
						} else if (dist <= radius + buffer) {
							inBuffer.push(player);
						}
					}
				}
			}
		}
		return { nearby, inBuffer };
	}
	
	clear() {
		this.cells.clear();
	}
}

function Game(id) {
	const possColors = Color.possColors();
	let nextInd = 0;
	const players = [];
	const gods = [];
	let frame = 0;
	let simFrame = 0;
	let pendingDeltas = createEconomyDeltas();
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// Spatial grid for efficient nearby queries
	const spatialGrid = new SpatialGrid(mapSize, GRID_CELL_SIZE);
	const coinGrid = new SpatialGrid(mapSize, GRID_CELL_SIZE);
	
	// XP pickups (world pickups - renamed from coins)
	let coins = [];  // Still called "coins" internally for pickup entities
	let nextCoinId = 0;
	let coinSpawnCooldown = 0;
	
	// PvE enemies
	const enemies = [];
	let nextEnemyId = 0;
	const enemySpawner = new EnemySpawner();
	let enemyKills = 0;
	let runTime = 0;
	
	// Upgrade system pause state
	let gamePaused = false;
	let pendingUpgradeOffer = null; // { playerNum, choices: [...] }

	this.id = id;
	
	// Reset game state for new run (called when player joins/restarts)
	function resetGameState() {
		// Clear all enemies
		enemies.length = 0;
		nextEnemyId = 0;
		
		// Clear all coins/XP pickups
		coins.length = 0;
		coinGrid.clear();
		nextCoinId = 0;
		coinSpawnCooldown = 0;
		
		// Reset enemy spawner
		enemySpawner.reset();
		
		// Reset stats
		enemyKills = 0;
		runTime = 0;
		
		// Reset pause state
		gamePaused = false;
		pendingUpgradeOffer = null;
		
		console.log(`[${new Date()}] Game state reset for new run.`);
	}
	
	this.addPlayer = (client, name, viewport) => {
		if (players.length >= 1) {
			return { ok: false, error: "Singleplayer only." };
		}
		if (players.length >= consts.MAX_PLAYERS) {
			return { ok: false, error: "There're too many players!" };
		}
		
		// Reset game state for new run (singleplayer restart)
		resetGameState();
		
		const start = findEmptySpawn(players, mapSize);
		if (!start) return { ok: false, error: "Cannot find spawn location." };
		
		const params = {
			x: start.x,
			y: start.y,
			angle: Math.random() * Math.PI * 2,
			name,
			num: nextInd,
			base: possColors.shift()
		};
		
		const p = new Player(params);
		p.targetAngle = params.angle;
		p.client = client;
		
		// Initialize stat multipliers
		p.speedMult = 1.0;
		p.snipGraceBonusSec = 0;
		
		// XP/Level system - start at level 1 with 0 XP
		p.level = 1;
		p.xp = 0;
		p.updateSizeScale();
		
		// Drone system - drones = level (start with 1)
		p.droneCount = p.level;
		p.drones = [];
		rebuildDronesArray(p, p.droneCount);
		
		// Initialize upgrade system
		initPlayerUpgrades(p);
		
		// AOI tracking - which players this player knows about
		p.knownPlayers = new Set();  // Set of player nums this client has received
		p.knownCoins = new Set();    // Set of coin IDs this client has received
		
		// Viewport-based AOI - calculate radius based on client's screen size
		p.viewport = viewport || { width: 800, height: 600 };
		p.aoiRadius = calculateAOIRadius(p.viewport);
		
		players.push(p);
		nextInd++;
		initPlayer(p);
		p._territoryDirty = true;
		
		// Add to spatial grid
		spatialGrid.insert(p);
		
		if (p.name.indexOf("[BOT]") == -1) {
			console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) joined.`);
		}
		
		return { ok: true, player: p };
	};
	
	// Serialize player with XP/level stats
	function serializePlayer(player, viewerNum) {
		const data = player.serialData();
		data.speedMult = player.speedMult || 1.0;
		data.snipGraceBonusSec = player.snipGraceBonusSec || 0;
		
		// XP/Level fields
		data.level = player.level || 1;
		data.xp = player.xp || 0;
		data.sizeScale = player.sizeScale || 1.0;
		
		// Drone data
		data.droneCount = player.droneCount || 1;
		data.drones = (player.drones || []).map(d => ({
			id: d.id,
			ownerId: d.ownerId,
			x: d.x,
			y: d.y,
			hp: d.hp,
			maxHp: d.maxHp,
			targetId: d.targetId
		}));
		
		return data;
	}

	function serializeEnemy(enemy) {
		const data = enemy.serialData ? enemy.serialData() : {
			id: enemy.id,
			x: enemy.x,
			y: enemy.y,
			vx: enemy.vx,
			vy: enemy.vy,
			radius: enemy.radius,
			hp: enemy.hp,
			maxHp: enemy.maxHp,
			contactDamage: enemy.contactDamage,
			speed: enemy.speed,
			lastHitAt: enemy.lastHitAt,
			type: enemy.type
		};
		// Include charging state for client rendering
		if (enemy.isCharging) {
			data.isCharging = true;
		}
		// Include boss flag
		if (enemy.isBoss) {
			data.isBoss = true;
		}
		return data;
	}

	function getEnemiesForPlayer(player) {
		const aoiRadius = player.aoiRadius || calculateAOIRadius(player.viewport);
		const maxDist = aoiRadius + AOI_BUFFER;
		const maxDistSq = maxDist * maxDist;
		return enemies.filter(enemy => {
			const dx = enemy.x - player.x;
			const dy = enemy.y - player.y;
			return dx * dx + dy * dy <= maxDistSq;
		});
	}

	function getEnemyStats() {
		const bossCount = enemies.filter(e => e.isBoss).length;
		return {
			runTime,
			spawnInterval: enemySpawner.spawnInterval,
			enemies: enemies.length,
			kills: enemyKills,
			unlockedTypes: enemySpawner.getUnlockedTypes(),
			bossCount,
			bossInterval: enemySpawner.getBossInterval(),
			nextBossIn: Math.max(0, enemySpawner.nextBossAt - runTime)
		};
	}
	
	this.addGod = client => {
		const g = {
			client,
			frame,
			isGod: true  // Gods see everything (for spectating)
		};
		gods.push(g);
		return { ok: true, god: g };
	};

	this.updateViewport = (player, viewport) => {
		if (viewport && typeof viewport.width === "number" && typeof viewport.height === "number") {
			player.viewport = viewport;
			player.aoiRadius = calculateAOIRadius(viewport);
		}
	};

	this.handleInput = (player, data) => {
		if (!data) return { ok: false, error: "No data supplied." };
		if (data.targetAngle !== undefined) {
			if (typeof data.targetAngle === "number" && !isNaN(data.targetAngle)) {
				player.targetAngle = data.targetAngle;
				return { ok: true };
			}
			return { ok: false, error: "Target angle must be a valid number." };
		}
		return { ok: true };
	};

	this.handleDisconnect = player => {
		player.die();
		player.disconnected = true;
		spatialGrid.remove(player);
		if (player.name.indexOf("[BOT]") == -1) {
			console.log(`[${new Date()}] ${player.name || "Unnamed"} (${player.num}) left.`);
		}
	};

	this.handleUpgradePick = (player, upgradeId) => {
		// Validate that this player has a pending upgrade offer
		if (!gamePaused || !pendingUpgradeOffer || pendingUpgradeOffer.playerNum !== player.num) {
			console.warn(`[UPGRADE] Invalid upgrade pick from ${player.name} - no pending offer`);
			return { ok: false, error: "No pending upgrade offer." };
		}
		
		// Validate that the upgrade is one of the offered choices
		const validChoice = pendingUpgradeOffer.choices.find(c => c.id === upgradeId);
		if (!validChoice) {
			console.warn(`[UPGRADE] Invalid upgrade pick from ${player.name} - ${upgradeId} not in choices`);
			return { ok: false, error: "Invalid upgrade selection." };
		}
		
		// Apply the upgrade
		const newStacks = selectUpgrade(player, upgradeId);
		
		if (DEBUG_LEVELING_LOGS) {
			console.log(`[UPGRADE] ${player.name} selected ${validChoice.name} (now ${newStacks} stacks)`);
		}
		
		// Clear the pending offer and resume game
		pendingUpgradeOffer = null;
		gamePaused = false;
		
		// Force an XP update to sync derived stats
		player._forceXpUpdate = true;
		
		return { ok: true, upgradeId, newStacks };
	};
	
	// Expose pause state for external queries
	this.isPaused = () => gamePaused;

	this.sendFullState = player => {
		if (!player || !player.client) return;
		player.frame = frame;
		
		const aoiRadius = player.aoiRadius || calculateAOIRadius(player.viewport);
		const nearbyPlayers = spatialGrid.getNearby(player.x, player.y, aoiRadius);
		const nearbyCoins = coinGrid.getNearby(player.x, player.y, aoiRadius);
		
		player.knownPlayers.clear();
		player.knownCoins.clear();
		for (const np of nearbyPlayers) {
			player.knownPlayers.add(np.num);
		}
		for (const c of nearbyCoins) {
			player.knownCoins.add(c.id);
		}
		
		const splayers = nearbyPlayers.map(val => serializePlayer(val, player.num));
		const senemies = getEnemiesForPlayer(player).map(serializeEnemy);
		player.client.sendPacket(MSG.INIT, {
			"num": player.num,
			"gameid": id,
			"frame": frame,
			"players": splayers,
			"coins": nearbyCoins,
			"enemies": senemies,
			"enemyStats": getEnemyStats()
		});
	};

	this.sendFullStateToGod = god => {
		if (!god || !god.client) return;
		god.frame = frame;
		
		const splayers = players.map(val => serializePlayer(val, -1));
		const senemies = enemies.map(serializeEnemy);
		god.client.sendPacket(MSG.INIT, {
			"gameid": id,
			"frame": frame,
			"players": splayers,
			"coins": coins,
			"enemies": senemies,
			"enemyStats": getEnemyStats()
		});
	};

	function tickSim(deltaSeconds) {
		// Skip simulation if game is paused (upgrade selection pending)
		if (gamePaused) {
			return;
		}
		
		const economyDeltas = createEconomyDeltas();
		
		// Coin spawning
		coinSpawnCooldown -= deltaSeconds;
		if (coinSpawnCooldown <= 0 && coins.length < consts.MAX_COINS) {
			const x = Math.random() * (mapSize - 2 * consts.BORDER_WIDTH) + consts.BORDER_WIDTH;
			const y = Math.random() * (mapSize - 2 * consts.BORDER_WIDTH) + consts.BORDER_WIDTH;
			const newCoin = {
				id: nextCoinId++,
				x,
				y,
				value: consts.COIN_VALUE
			};
			coins.push(newCoin);
			coinGrid.insert(newCoin);
			economyDeltas.coinSpawns.push(newCoin);
			coinSpawnCooldown = consts.COIN_SPAWN_INTERVAL_SEC;
		}
		
		const droneUpdateEveryTicks = consts.DRONE_UPDATE_EVERY_TICKS ?? 5;
		const shouldSendDroneUpdates = simFrame % droneUpdateEveryTicks === 0;
		
		// Run game simulation
		update(economyDeltas, deltaSeconds, shouldSendDroneUpdates);
		
		// Update spatial grid for all alive players
		for (const p of players) {
			if (!p.dead && !p.disconnected) {
				spatialGrid.update(p);
			}
		}
		
		mergeEconomyDeltas(pendingDeltas, economyDeltas);
		simFrame++;
	}
	
	function flushFrame() {
		// Build per-player update packets with AOI filtering
		for (const p of players) {
			if (p.disconnected || p.dead) continue;
			
			if (!p.knownPlayers) p.knownPlayers = new Set();
			if (!p.knownCoins) p.knownCoins = new Set();
			p.knownPlayers.add(p.num);
			
			const aoiRadius = p.aoiRadius || calculateAOIRadius(p.viewport);
			const { nearby, inBuffer } = spatialGrid.getNearbyWithBuffer(p.x, p.y, aoiRadius, AOI_HYSTERESIS);
			
			if (!nearby.includes(p)) {
				nearby.push(p);
			}
			
			const nearbyNums = new Set(nearby.map(np => np.num));
			const bufferNums = new Set(inBuffer.map(np => np.num));
			
			const entering = [];
			const leaving = [];
			
			for (const np of nearby) {
				if (!p.knownPlayers.has(np.num)) {
					entering.push(np);
					p.knownPlayers.add(np.num);
				}
			}
			
			for (const knownNum of p.knownPlayers) {
				if (!nearbyNums.has(knownNum) && !bufferNums.has(knownNum)) {
					leaving.push(knownNum);
				}
			}
			for (const leaveNum of leaving) {
				p.knownPlayers.delete(leaveNum);
			}
			
			const moves = [];
			for (const np of nearby) {
				moves.push({
					num: np.num,
					left: !!np.disconnected || np.dead,
					targetAngle: np.targetAngle,
					x: np.x,
					y: np.y
				});
			}
			for (const bp of inBuffer) {
				if (p.knownPlayers.has(bp.num)) {
					moves.push({
						num: bp.num,
						left: !!bp.disconnected || bp.dead,
						targetAngle: bp.targetAngle,
						x: bp.x,
						y: bp.y
					});
				}
			}
			
			const filteredData = {
				frame: frame + 1,
				moves
			};
			
			if (pendingDeltas.coinSpawns.length > 0) {
				const nearbyCoinSpawns = pendingDeltas.coinSpawns.filter(c => 
					Math.hypot(c.x - p.x, c.y - p.y) <= aoiRadius
				);
				if (nearbyCoinSpawns.length > 0) {
					filteredData.coinSpawns = nearbyCoinSpawns;
					for (const c of nearbyCoinSpawns) {
						p.knownCoins.add(c.id);
					}
				}
			}
			
			if (pendingDeltas.coinRemovals.length > 0) {
				const knownRemovals = pendingDeltas.coinRemovals.filter(id => 
					p.knownCoins.has(id)
				);
				if (knownRemovals.length > 0) {
					filteredData.coinRemovals = knownRemovals;
					for (const id of knownRemovals) {
						p.knownCoins.delete(id);
					}
				}
			}
			
			if (pendingDeltas.xpUpdates.length > 0) {
				const nearbyXp = pendingDeltas.xpUpdates.filter(u => 
					p.knownPlayers.has(u.num) || u.num === p.num
				);
				if (nearbyXp.length > 0) filteredData.xpUpdates = nearbyXp;
			}
			
			if (pendingDeltas.levelUps.length > 0) {
				const nearbyLvl = pendingDeltas.levelUps.filter(u => 
					p.knownPlayers.has(u.playerNum) || u.playerNum === p.num
				);
				if (nearbyLvl.length > 0) filteredData.levelUps = nearbyLvl;
			}
			
			if (pendingDeltas.hitscanEvents.length > 0) {
				const nearbyHits = pendingDeltas.hitscanEvents.filter(h => 
					Math.hypot(h.fromX - p.x, h.fromY - p.y) <= aoiRadius ||
					Math.hypot(h.toX - p.x, h.toY - p.y) <= aoiRadius
				);
				if (nearbyHits.length > 0) filteredData.hitscanEvents = nearbyHits;
			}
			
			if (pendingDeltas.captureEvents.length > 0) {
				const nearbyCap = pendingDeltas.captureEvents.filter(e => 
					p.knownPlayers.has(e.playerNum) || e.playerNum === p.num
				);
				if (nearbyCap.length > 0) filteredData.captureEvents = nearbyCap;
			}
			
			if (pendingDeltas.droneUpdates.length > 0) {
				const nearbyDrones = pendingDeltas.droneUpdates.filter(d => 
					p.knownPlayers.has(d.ownerNum) || d.ownerNum === p.num
				);
				if (nearbyDrones.length > 0) filteredData.droneUpdates = nearbyDrones;
			}
			
			if (pendingDeltas.killEvents.length > 0) {
				const relevantKills = pendingDeltas.killEvents.filter(k => 
					k.killerNum === p.num || k.victimNum === p.num ||
					p.knownPlayers.has(k.killerNum) || p.knownPlayers.has(k.victimNum)
				);
				if (relevantKills.length > 0) filteredData.killEvents = relevantKills;
			}
			
			const territoryUpdates = [];
			for (const np of nearby) {
				if (np._territoryDirty) {
					territoryUpdates.push({
						num: np.num,
						territory: np.territory
					});
				}
			}
			if (territoryUpdates.length > 0) {
				filteredData.territoryUpdates = territoryUpdates;
			}
			
			if (entering.length > 0) {
				filteredData.newPlayers = entering.map(np => serializePlayer(np, p.num));
			}
			
			if (leaving.length > 0) {
				filteredData.leftPlayers = leaving;
			}
			
			const nearbyEnemies = getEnemiesForPlayer(p).map(serializeEnemy);
			filteredData.enemies = nearbyEnemies;
			filteredData.enemyStats = getEnemyStats();
			
			p.client.sendPacket(MSG.FRAME, filteredData);
		}
		
		const godData = {
			frame: frame + 1,
			moves: players.map(val => ({
				num: val.num,
				left: !!val.disconnected,
				targetAngle: val.targetAngle
			}))
		};
		if (pendingDeltas.coinSpawns.length > 0) godData.coinSpawns = pendingDeltas.coinSpawns;
		if (pendingDeltas.coinRemovals.length > 0) godData.coinRemovals = pendingDeltas.coinRemovals;
		if (pendingDeltas.xpUpdates.length > 0) godData.xpUpdates = pendingDeltas.xpUpdates;
		if (pendingDeltas.levelUps.length > 0) godData.levelUps = pendingDeltas.levelUps;
		if (pendingDeltas.hitscanEvents.length > 0) godData.hitscanEvents = pendingDeltas.hitscanEvents;
		if (pendingDeltas.captureEvents.length > 0) godData.captureEvents = pendingDeltas.captureEvents;
		if (pendingDeltas.droneUpdates.length > 0) godData.droneUpdates = pendingDeltas.droneUpdates;
		if (pendingDeltas.killEvents.length > 0) godData.killEvents = pendingDeltas.killEvents;
		godData.enemies = enemies.map(serializeEnemy);
		godData.enemyStats = getEnemyStats();
		
		for (const g of gods) {
			g.client.sendPacket(MSG.FRAME, godData);
		}
		
		for (const p of players) {
			p._territoryDirty = false;
		}
		
		pendingDeltas = createEconomyDeltas();
		frame++;
	}
	
	this.tickSim = tickSim;
	this.flushFrame = flushFrame;

	function update(economyDeltas, deltaSeconds, shouldSendDroneUpdates) {
		const dead = [];
		runTime += deltaSeconds;
		
		const activePlayer = players.find(p => !p.dead && !p.disconnected) || null;
		
		const spawnEnemyXp = (x, y) => {
			const newCoin = {
				id: nextCoinId++,
				x: Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, x)),
				y: Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, y)),
				value: 1
			};
			coins.push(newCoin);
			coinGrid.insert(newCoin);
			economyDeltas.coinSpawns.push(newCoin);
		};
		
		const handleEnemyDeath = (enemy, killer) => {
			if (enemy.dead) return;
			enemy.dead = true;
			enemyKills += 1;
			spawnEnemyXp(enemy.x, enemy.y);
			if (killer) {
				economyDeltas.killEvents.push({
					killerNum: killer.num,
					victimNum: -1,
					victimName: enemy.type || "Enemy",
					killType: "enemy"
				});
			}
		};
		
		// Callback for collision kills (from updateFrame)
		const notifyKill = (killerIdx, victimIdx) => {
			const killer = players[killerIdx];
			const victim = players[victimIdx];
			if (killer && victim) {
				economyDeltas.killEvents.push({
					killerNum: killer.num,
					victimNum: victim.num,
					victimName: victim.name || 'Unknown',
					killType: 'collision'
				});
			}
		};
		
		updateFrame(players, dead, notifyKill, deltaSeconds);
		
		// Check for snip deaths (players who died while snipped)
		for (const p of dead) {
			if (p.snippedBy != null) {
				// This player died from a snip - credit the snipper
				economyDeltas.killEvents.push({
					killerNum: p.snippedBy,
					victimNum: p.num,
					victimName: p.name || 'Unknown',
					killType: 'snip'
				});
			}
		}
		
		const spawnResult = enemySpawner.update(deltaSeconds, activePlayer, mapSize);
		const enemySpawns = spawnResult.enemies || spawnResult; // Handle both old and new format
		const bossSpawns = spawnResult.bosses || [];
		
		// Spawn regular enemies
		for (const spawn of enemySpawns) {
			const typeName = spawn.type || 'basic';
			const typeData = ENEMY_TYPES[typeName] || ENEMY_TYPES.basic;
			
			const enemy = new Enemy({
				id: `enemy-${nextEnemyId++}`,
				x: spawn.x,
				y: spawn.y,
				type: typeName,
				radius: typeData.radius,
				maxHp: typeData.maxHp,
				hp: typeData.maxHp,
				speed: typeData.speed,
				contactDamage: typeData.contactDamage
			});
			
			// Type-specific properties
			if (typeName === 'charger') {
				enemy.chargeSpeed = typeData.chargeSpeed;
				enemy.chargeCooldown = typeData.chargeCooldown;
				enemy.chargeDistance = typeData.chargeDistance;
				enemy.lastChargeTime = 0;
				enemy.isCharging = false;
				enemy.chargeTargetX = 0;
				enemy.chargeTargetY = 0;
			} else if (typeName === 'sniper') {
				enemy.preferredDistance = typeData.preferredDistance;
			}
			
			enemies.push(enemy);
		}
		
		// Spawn bosses
		for (const spawn of bossSpawns) {
			const bossType = spawn.type || 'titan';
			const bossData = BOSS_TYPES[bossType] || BOSS_TYPES.titan;
			
			const boss = new Enemy({
				id: `boss-${nextEnemyId++}`,
				x: spawn.x,
				y: spawn.y,
				type: bossType,
				radius: bossData.radius,
				maxHp: bossData.maxHp,
				hp: bossData.maxHp,
				speed: bossData.speed,
				contactDamage: bossData.contactDamage
			});
			
			boss.isBoss = true;
			
			// Boss-specific properties
			if (bossType === 'berserker') {
				boss.chargeSpeed = bossData.chargeSpeed;
				boss.chargeCooldown = bossData.chargeCooldown;
				boss.chargeDistance = bossData.chargeDistance;
				boss.lastChargeTime = 0;
				boss.isCharging = false;
				boss.chargeTargetX = 0;
				boss.chargeTargetY = 0;
			} else if (bossType === 'summoner') {
				boss.summonCooldown = bossData.summonCooldown;
				boss.summonCount = bossData.summonCount;
				boss.preferredDistance = bossData.preferredDistance;
				boss.lastSummonTime = 0;
			}
			
			enemies.push(boss);
		}
		
		if (activePlayer && !activePlayer.dead) {
			const playerRadius = activePlayer.getScaledRadius ? activePlayer.getScaledRadius() : PLAYER_RADIUS;
			const hitCooldown = 0.35;
			for (const enemy of enemies) {
				if (enemy.dead) continue;
				
				const dx = activePlayer.x - enemy.x;
				const dy = activePlayer.y - enemy.y;
				const dist = Math.hypot(dx, dy);
				const norm = dist > 0 ? 1 / dist : 0;
				
				// Apply slow debuff if active
				let effectiveSpeed = enemy.speed;
				if (enemy.slowExpires && runTime < enemy.slowExpires) {
					effectiveSpeed *= (1 - (enemy.slowAmount || 0));
				} else {
					enemy.slowAmount = 0;
				}
				
				// Type-specific movement behavior
				let moveX = dx * norm;
				let moveY = dy * norm;
				
				if (enemy.type === 'charger') {
					// Charger: winds up then rushes at player's last position
					if (enemy.isCharging) {
						// Move toward charge target at high speed
						const chargeDx = enemy.chargeTargetX - enemy.x;
						const chargeDy = enemy.chargeTargetY - enemy.y;
						const chargeDist = Math.hypot(chargeDx, chargeDy);
						
						if (chargeDist < 15) {
							// Reached target, stop charging
							enemy.isCharging = false;
							enemy.lastChargeTime = runTime;
						} else {
							const chargeNorm = 1 / chargeDist;
							moveX = chargeDx * chargeNorm;
							moveY = chargeDy * chargeNorm;
							effectiveSpeed = enemy.chargeSpeed || 200;
						}
					} else if (dist < (enemy.chargeDistance || 180) && 
							   (runTime - (enemy.lastChargeTime || 0)) >= (enemy.chargeCooldown || 3)) {
						// Start charging - lock onto player's current position
						enemy.isCharging = true;
						enemy.chargeTargetX = activePlayer.x;
						enemy.chargeTargetY = activePlayer.y;
					}
				} else if (enemy.type === 'sniper' || enemy.type === 'summoner') {
					// Sniper/Summoner: tries to maintain preferred distance and orbits player
					const preferred = enemy.preferredDistance || 200;
					
					// Initialize orbit direction if not set
					if (enemy.orbitDir === undefined) {
						enemy.orbitDir = Math.random() < 0.5 ? 1 : -1;
					}
					
					if (dist < preferred - 40) {
						// Too close, back away quickly
						moveX = -dx * norm;
						moveY = -dy * norm;
						effectiveSpeed *= 1.2; // Move faster when retreating
					} else if (dist > preferred + 60) {
						// Too far, approach
						moveX = dx * norm;
						moveY = dy * norm;
					} else {
						// Good distance - orbit around player (perpendicular movement)
						moveX = -dy * norm * enemy.orbitDir;
						moveY = dx * norm * enemy.orbitDir;
						// Also slightly adjust distance if needed
						const distError = dist - preferred;
						moveX += dx * norm * distError * 0.01;
						moveY += dy * norm * distError * 0.01;
						// Normalize
						const mag = Math.sqrt(moveX * moveX + moveY * moveY);
						if (mag > 0) {
							moveX /= mag;
							moveY /= mag;
						}
					}
					
					// Summoner: spawn minions periodically
					if (enemy.type === 'summoner' && enemy.summonCooldown) {
						if ((runTime - (enemy.lastSummonTime || 0)) >= enemy.summonCooldown) {
							enemy.lastSummonTime = runTime;
							// Spawn minions around the summoner
							const summonCount = enemy.summonCount || 3;
							for (let s = 0; s < summonCount; s++) {
								const angle = (s / summonCount) * Math.PI * 2;
								const spawnDist = enemy.radius + 20;
								const minionX = enemy.x + Math.cos(angle) * spawnDist;
								const minionY = enemy.y + Math.sin(angle) * spawnDist;
								
								// Spawn basic enemies as minions
								const minion = new Enemy({
									id: `enemy-${nextEnemyId++}`,
									x: minionX,
									y: minionY,
									type: 'swarm', // Summons swarm enemies
									radius: ENEMY_TYPES.swarm.radius,
									maxHp: ENEMY_TYPES.swarm.maxHp,
									hp: ENEMY_TYPES.swarm.maxHp,
									speed: ENEMY_TYPES.swarm.speed,
									contactDamage: ENEMY_TYPES.swarm.contactDamage
								});
								enemies.push(minion);
							}
						}
					}
				} else if (enemy.type === 'berserker') {
					// Berserker boss: charges like charger but more aggressive
					if (enemy.isCharging) {
						const chargeDx = enemy.chargeTargetX - enemy.x;
						const chargeDy = enemy.chargeTargetY - enemy.y;
						const chargeDist = Math.hypot(chargeDx, chargeDy);
						
						if (chargeDist < 20) {
							enemy.isCharging = false;
							enemy.lastChargeTime = runTime;
						} else {
							const chargeNorm = 1 / chargeDist;
							moveX = chargeDx * chargeNorm;
							moveY = chargeDy * chargeNorm;
							effectiveSpeed = enemy.chargeSpeed || 250;
						}
					} else if (dist < (enemy.chargeDistance || 250) && 
							   (runTime - (enemy.lastChargeTime || 0)) >= (enemy.chargeCooldown || 2)) {
						enemy.isCharging = true;
						enemy.chargeTargetX = activePlayer.x;
						enemy.chargeTargetY = activePlayer.y;
					}
				}
				// Basic, tank, swarm, titan all use default "move toward player" behavior
				
				enemy.vx = moveX * effectiveSpeed;
				enemy.vy = moveY * effectiveSpeed;
				enemy.x += enemy.vx * deltaSeconds;
				enemy.y += enemy.vy * deltaSeconds;
				
				enemy.x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, enemy.x));
				enemy.y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, enemy.y));
				
				const hitDx = activePlayer.x - enemy.x;
				const hitDy = activePlayer.y - enemy.y;
				const hitDist = Math.hypot(hitDx, hitDy);
				const hitRadius = playerRadius + enemy.radius;
				
				if (hitDist < hitRadius && (runTime - enemy.lastHitAt) >= hitCooldown) {
					let damage = enemy.contactDamage;
					const inTerritory = activePlayer.territory && activePlayer.territory.length >= 3 &&
						pointInPolygon({ x: activePlayer.x, y: activePlayer.y }, activePlayer.territory);
					if (inTerritory) {
						const reduction = consts.TERRITORY_DAMAGE_REDUCTION ?? 0.5;
						damage *= (1 - reduction);
					}
					
					// Apply armor reduction from upgrades
					const playerStats = activePlayer.derivedStats || {};
					const armor = playerStats.armor || 0;
					damage = Math.max(0, damage - armor);
					
					// Get effective max HP from upgrades
					const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
					const maxHpMult = playerStats.maxHpMult || 1.0;
					activePlayer.maxHp = baseMaxHp * maxHpMult;
					
					activePlayer.hp -= damage;
					if (activePlayer.hp < 0) activePlayer.hp = 0;
					enemy.lastHitAt = runTime;
					
					if (activePlayer.hp <= 0 && !activePlayer.dead) {
						activePlayer.die();
						dead.push(activePlayer);
						economyDeltas.killEvents.push({
							killerNum: -1,
							victimNum: activePlayer.num,
							victimName: activePlayer.name || "Player",
							killType: "enemy"
						});
					}
				}
			}
		}
		
		for (let i = enemies.length - 1; i >= 0; i--) {
			if (enemies[i].dead) {
				enemies.splice(i, 1);
			}
		}
		
		const PLAYER_RADIUS = consts.CELL_WIDTH / 2;

		for (const p of dead) {
			// Drop XP as loot when player dies (always drop at least minimum)
			if (!p.handledDead) {
				// Calculate total XP based on current level and XP
				// Sum up XP from all previous levels plus current XP
				let totalXp = p.xp;
				for (let lvl = 1; lvl < p.level; lvl++) {
					totalXp += getXpForLevel(lvl);
				}
				
				// Drop 15% as loot coins
				const dropPercent = consts.COIN_DROP_PERCENT ?? 0.15;
				const fromXp = Math.floor(totalXp * dropPercent);
				const dropAmount = Math.max(consts.COIN_DROP_MIN, fromXp);
				
				// Spawn coins in a burst pattern around death location
				const numCoins = Math.min(Math.ceil(dropAmount / consts.COIN_VALUE), 20); // Cap visual coins at 20
				const valuePerCoin = Math.ceil(dropAmount / numCoins);
				
				for (let i = 0; i < numCoins; i++) {
					const angle = (i / numCoins) * Math.PI * 2 + Math.random() * 0.5;
					const dist = 30 + Math.random() * 50;
					const newCoin = {
						id: nextCoinId++,
						x: p.x + Math.cos(angle) * dist,
						y: p.y + Math.sin(angle) * dist,
						value: i === numCoins - 1 
							? dropAmount - valuePerCoin * (numCoins - 1) // Last coin gets remainder
							: valuePerCoin,
						// Animation data for client
						fromDeath: true,
						originX: p.x,
						originY: p.y,
						spawnTime: Date.now()
					};
					// Clamp to map bounds
					newCoin.x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, newCoin.x));
					newCoin.y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, newCoin.y));
					coins.push(newCoin);
					coinGrid.insert(newCoin);
					economyDeltas.coinSpawns.push(newCoin);
				}
				
				// Transfer 15% directly to killer (if there is one)
				const killerPercent = consts.KILLER_XP_PERCENT ?? 0.20;
				const killerXpCalc = Math.floor(totalXp * killerPercent);
				const killerXp = Math.max(consts.KILLER_XP_MIN || 20, killerXpCalc);
				
				// Find the killer from killEvents
				const killEvent = economyDeltas.killEvents.find(evt => evt.victimNum === p.num);
				if (killEvent) {
					const killer = players.find(pl => pl.num === killEvent.killerNum && !pl.dead);
					if (killer) {
						// Add XP to killer
						killer.xp += killerXp;
						
						// Check for level up
						let xpNeeded = getXpForLevel(killer.level);
						while (killer.xp >= xpNeeded && killer.level < (consts.MAX_DRONES || 50)) {
							killer.xp -= xpNeeded;
							killer.level++;
							
							// Update size scale
							const sizePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL || 0.04;
							const maxScale = consts.PLAYER_SIZE_SCALE_MAX || 2.0;
							killer.sizeScale = Math.min(maxScale, 1.0 + (killer.level - 1) * sizePerLevel);
							
							// Rebuild drones for new level
							rebuildDronesArray(killer, killer.level);
							
							// Send level up event
							economyDeltas.levelUps.push({
								playerNum: killer.num,
								newLevel: killer.level,
								droneCount: killer.drones.length
							});
							
							xpNeeded = getXpForLevel(killer.level);
						}
						
						// Send XP update
						economyDeltas.xpUpdates.push({
							num: killer.num,
							xp: killer.xp,
							level: killer.level,
							xpPerLevel: getXpForLevel(killer.level),
							sizeScale: killer.sizeScale,
							droneCount: killer.drones.length
						});
						
						if (DEBUG_KILL_REWARD_LOGS) {
							console.log(`[KILL REWARD] ${killer.name} received ${killerXp} XP for killing ${p.name} (victim had ${totalXp} total XP)`);
						}
					}
				}
			}
			
			if (!p.handledDead) {
				possColors.push(p.baseColor);
				p.handledDead = true;
			}
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`${p.name || "Unnamed"} (${p.num}) died.`);
			}
			p.client.sendPacket(MSG.DEAD);
			if (p.client.close) p.client.close();
		}

		// ===== DRONE SYSTEM UPDATE =====
		
		// Update all player drones
		for (const p of players) {
			if (p.dead || !p.drones) continue;
			
			// Update drone positions (orbit around player)
			updateDronePositions(p, deltaSeconds);
			
			// Check if player is in own territory (for HP regen)
			const inTerritory = p.territory && p.territory.length >= 3 && 
				pointInPolygon({ x: p.x, y: p.y }, p.territory);
			
			// Get derived stats from upgrades
			const stats = p.derivedStats || {};
			const attackSpeedMult = stats.attackSpeedMult || 1.0;
			const damageMult = (stats.damageMult || 1.0) + (stats.adrenalSurgeDamage || 0);
			const critChance = stats.critChance || 0;
			const critMult = stats.critMult || 2.0;
			const lifeOnHitPercent = stats.lifeOnHitPercent || 0;
			const enemySlowPercent = Math.min(stats.enemySlowPercent || 0, 0.6);
			const chainLightningBounces = stats.chainLightningBounces || 0;
			const extraProjectiles = stats.extraProjectiles || 0;
			
			// Update life on hit cooldown
			if (p.lifeOnHitCooldown > 0) {
				p.lifeOnHitCooldown -= deltaSeconds;
			}
			
			// Update each drone
			for (const drone of p.drones) {
				// Reduce cooldown (modified by attack speed)
				if (drone.cooldownRemaining > 0) {
					drone.cooldownRemaining -= deltaSeconds * attackSpeedMult;
				}
				
				// Drones are disabled when owner is snipped (can't target or fire)
				if (p.isSnipped) {
					drone.targetId = null;
					continue; // Skip targeting and firing
				}
				
				// Find target (nearest enemy in range, measured from the owner center)
				let target = null;
				let minDist = drone.range;
				const ownerX = p.x;
				const ownerY = p.y;
				
				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;
					
					// Measure from player center so range matches the rendered ring
					const dist = Math.hypot(enemy.x - ownerX, enemy.y - ownerY);
					if (dist < minDist) {
						minDist = dist;
						target = enemy;
					}
				}
				
				drone.targetId = target ? target.id : null;
				
				// Hitscan fire if ready and has target
				if (target && drone.cooldownRemaining <= 0) {
					drone.cooldownRemaining = consts.DRONE_COOLDOWN || 1.0;
					
					// Calculate base damage dynamically from config
					// First drone = full damage, 2nd = EXTRA_MULT, 3rd+ = decay factor applied
					const droneIndex = p.drones.indexOf(drone);
					const baseDamage = consts.DRONE_DAMAGE || 10;
					const extraMult = consts.DRONE_DAMAGE_EXTRA_MULT ?? 0.35;
					const decayFactor = consts.DRONE_DAMAGE_DECAY_FACTOR ?? 0.9;
					
					let baseDmg;
					if (droneIndex === 0) {
						baseDmg = baseDamage;
					} else if (droneIndex === 1) {
						baseDmg = baseDamage * extraMult;
					} else {
						// 3rd drone and beyond: apply decay factor for each drone after the 2nd
						baseDmg = baseDamage * extraMult * Math.pow(decayFactor, droneIndex - 1);
					}
					
					// Apply damage multiplier from upgrades
					let damage = baseDmg * damageMult;
					
					// Check for critical hit
					const isCrit = Math.random() < critChance;
					if (isCrit) {
						damage *= critMult;
					}
					
					// Apply damage to primary target
					applyHitscanDamage(p, drone, target, damage, isCrit, economyDeltas, enemySlowPercent, lifeOnHitPercent);
					
					// Multi-shot: fire at additional nearby enemies
					if (extraProjectiles > 0) {
						const nearbyEnemies = enemies.filter(e => 
							e !== target && !e.dead && e.hp > 0 &&
							Math.hypot(e.x - ownerX, e.y - ownerY) < drone.range
						);
						// Sort by distance
						nearbyEnemies.sort((a, b) => 
							Math.hypot(a.x - ownerX, a.y - ownerY) - Math.hypot(b.x - ownerX, b.y - ownerY)
						);
						// Fire at up to extraProjectiles additional targets
						for (let i = 0; i < Math.min(extraProjectiles, nearbyEnemies.length); i++) {
							const multiTarget = nearbyEnemies[i];
							applyHitscanDamage(p, drone, multiTarget, damage, isCrit, economyDeltas, enemySlowPercent, lifeOnHitPercent);
						}
					}
					
					// Chain lightning: bounce to additional enemies
					if (chainLightningBounces > 0 && !target.dead) {
						const hitEnemies = new Set([target.id]);
						let chainTarget = target;
						let chainDamage = damage * 0.7; // 70% damage per bounce
						
						for (let bounce = 0; bounce < chainLightningBounces; bounce++) {
							// Find nearest enemy not yet hit
							let nextTarget = null;
							let nextDist = 200; // Chain range
							
							for (const enemy of enemies) {
								if (enemy.dead || enemy.hp <= 0 || hitEnemies.has(enemy.id)) continue;
								const dist = Math.hypot(enemy.x - chainTarget.x, enemy.y - chainTarget.y);
								if (dist < nextDist) {
									nextDist = dist;
									nextTarget = enemy;
								}
							}
							
							if (!nextTarget) break;
							
							hitEnemies.add(nextTarget.id);
							
							// Apply chain damage
							nextTarget.hp -= chainDamage;
							if (nextTarget.hp < 0) nextTarget.hp = 0;
							
							// Send chain lightning visual
							economyDeltas.hitscanEvents.push({
								fromX: chainTarget.x,
								fromY: chainTarget.y,
								toX: nextTarget.x,
								toY: nextTarget.y,
								ownerId: p.num,
								targetEnemyId: nextTarget.id,
								damage: chainDamage,
								remainingHp: nextTarget.hp,
								isChain: true
							});
							
							// Check for death
							if (nextTarget.hp <= 0) {
								handleEnemyDeath(nextTarget, p);
							}
							
							chainTarget = nextTarget;
						}
					}
				}
			}
		}
		
		// Helper function to apply hitscan damage with all effects
		function applyHitscanDamage(player, drone, target, damage, isCrit, deltas, slowPercent, lifeOnHitPct) {
			// Apply damage
			target.hp -= damage;
			if (target.hp < 0) target.hp = 0;
			
			// Apply slow debuff
			if (slowPercent > 0) {
				target.slowAmount = Math.min((target.slowAmount || 0) + slowPercent, 0.6);
				target.slowExpires = runTime + 1.5; // 1.5s duration
			}
			
			// Life on hit (with internal cooldown)
			if (lifeOnHitPct > 0 && player.lifeOnHitCooldown <= 0) {
				const healAmount = player.maxHp * lifeOnHitPct;
				player.hp = Math.min(player.maxHp, player.hp + healAmount);
				player.lifeOnHitCooldown = 0.1; // 0.1s cooldown
			}
			
			if (DEBUG_HITSCAN_LOGS) {
				console.log(`[HITSCAN] Drone ${drone.id} (owner: ${player.name}) hit enemy ${target.id} for ${damage.toFixed(1)} dmg${isCrit ? ' (CRIT!)' : ''}. HP: ${target.hp}/${target.maxHp}`);
			}
			
			// Send hitscan event for visual feedback
			deltas.hitscanEvents.push({
				fromX: drone.x,
				fromY: drone.y,
				toX: target.x,
				toY: target.y,
				ownerId: player.num,
				targetEnemyId: target.id,
				damage: damage,
				remainingHp: target.hp,
				isCrit: isCrit
			});
			
			// Check for death
			if (target.hp <= 0) {
				handleEnemyDeath(target, player);
			}
		}
		
		// Process players who died from hitscan damage
		// (These were added to dead[] after the initial death processing loop)
		for (const p of dead) {
			if (p.handledDead) continue; // Skip if already processed
			
			// Calculate total XP
			let totalXp = p.xp;
			for (let lvl = 1; lvl < p.level; lvl++) {
				totalXp += getXpForLevel(lvl);
			}
			
			// Drop 15% as loot coins
			const dropPercent = consts.COIN_DROP_PERCENT ?? 0.15;
			const fromXp = Math.floor(totalXp * dropPercent);
			const dropAmount = Math.max(consts.COIN_DROP_MIN, fromXp);
			
			const numCoins = Math.min(Math.ceil(dropAmount / consts.COIN_VALUE), 20);
			const valuePerCoin = Math.ceil(dropAmount / numCoins);
			
			for (let i = 0; i < numCoins; i++) {
				const angle = (i / numCoins) * Math.PI * 2 + Math.random() * 0.5;
				const dist = 30 + Math.random() * 50;
				const newCoin = {
					id: nextCoinId++,
					x: p.x + Math.cos(angle) * dist,
					y: p.y + Math.sin(angle) * dist,
					value: i === numCoins - 1 
						? dropAmount - valuePerCoin * (numCoins - 1)
						: valuePerCoin,
					fromDeath: true,
					originX: p.x,
					originY: p.y,
					spawnTime: Date.now()
				};
				newCoin.x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, newCoin.x));
				newCoin.y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, newCoin.y));
				coins.push(newCoin);
				coinGrid.insert(newCoin);
				economyDeltas.coinSpawns.push(newCoin);
			}
			
			// Transfer 15% directly to killer (if there is one)
			const killerPercent = consts.KILLER_XP_PERCENT ?? 0.15;
			const killerXpCalc = Math.floor(totalXp * killerPercent);
			const killerXp = Math.max(consts.KILLER_XP_MIN || 5, killerXpCalc);
			
			// Find the killer from killEvents
			const killEvent = economyDeltas.killEvents.find(evt => evt.victimNum === p.num);
			if (killEvent) {
				const killer = players.find(pl => pl.num === killEvent.killerNum && !pl.dead);
				if (killer) {
					// Add XP to killer
					killer.xp += killerXp;
					
					// Check for level up
					let xpNeeded = getXpForLevel(killer.level);
					while (killer.xp >= xpNeeded && killer.level < (consts.MAX_DRONES || 50)) {
						killer.xp -= xpNeeded;
						killer.level++;
						
						// Update size scale
						const sizePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL || 0.04;
						const maxScale = consts.PLAYER_SIZE_SCALE_MAX || 2.0;
						killer.sizeScale = Math.min(maxScale, 1.0 + (killer.level - 1) * sizePerLevel);
						
						// Rebuild drones for new level
						rebuildDronesArray(killer, killer.level);
						
						// Send level up event
						economyDeltas.levelUps.push({
							playerNum: killer.num,
							newLevel: killer.level,
							droneCount: killer.drones.length
						});
						
						xpNeeded = getXpForLevel(killer.level);
					}
					
					// Send XP update
					economyDeltas.xpUpdates.push({
						num: killer.num,
						xp: killer.xp,
						level: killer.level,
						xpPerLevel: getXpForLevel(killer.level),
						sizeScale: killer.sizeScale,
						droneCount: killer.drones.length
					});
					
					console.log(`[KILL REWARD] ${killer.name} received ${killerXp} XP for killing ${p.name} (victim had ${totalXp} total XP)`);
				}
			}
			
			possColors.push(p.baseColor);
			p.handledDead = true;
			
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`${p.name || "Unnamed"} (${p.num}) died from combat damage.`);
			}
			p.client.sendPacket(MSG.DEAD);
			if (p.client.close) p.client.close();
		}
		
		// Process alive players economy (XP/Leveling)
		for (const p of players) {
			if (p.dead) continue;
			
			let changed = false;

			// 1. XP pickups (coins) -> add directly to XP
			const scaledRadius = p.getScaledRadius ? p.getScaledRadius() : PLAYER_RADIUS;
			const pickupRadiusMult = (p.derivedStats && p.derivedStats.pickupRadiusMult) || 1.0;
			const effectivePickupRadius = (scaledRadius + consts.COIN_RADIUS) * pickupRadiusMult;
			for (let i = coins.length - 1; i >= 0; i--) {
				const coin = coins[i];
				const dist = Math.hypot(p.x - coin.x, p.y - coin.y);
				if (dist < effectivePickupRadius) {
					p.xp += coin.value;
					economyDeltas.coinRemovals.push(coin.id);
					coinGrid.remove(coin);
					coins.splice(i, 1);
					changed = true;
				}
			}

			// 2. Territory rewards -> add directly to XP
			if (p._pendingTerritoryAreaGained > 0) {
				p._territoryCoinCarry = (p._territoryCoinCarry || 0) + p._pendingTerritoryAreaGained * consts.COINS_PER_AREA_UNIT;
				const xpGained = Math.floor(p._territoryCoinCarry);
				if (xpGained > 0) {
					p.xp += xpGained;
					p._territoryCoinCarry -= xpGained;
					changed = true;
					p._territoryDirty = true;
					
					// Emit capture event for visual feedback
					economyDeltas.captureEvents.push({
						playerNum: p.num,
						x: p.x,
						y: p.y,
						xpGained: xpGained,
						areaGained: p._pendingTerritoryAreaGained
					});
				}
				p._pendingTerritoryAreaGained = 0;
			}

			// 3. Auto-level up when XP threshold reached
			let leveledUp = false;
			let xpNeeded = getXpForLevel(p.level);
			// Only process ONE level-up at a time (upgrade selection will pause)
			if (p.xp >= xpNeeded && !gamePaused) {
				p.xp -= xpNeeded;
				p.level += 1;
				leveledUp = true;
				changed = true;
				
				// Apply level benefits: +1 drone, update size
				applyLevelBenefits(p);
				
				economyDeltas.levelUps.push({
					playerNum: p.num,
					newLevel: p.level,
					x: p.x,
					y: p.y
				});
				
				if (DEBUG_LEVELING_LOGS) {
					console.log(`[${new Date()}] ${p.name} reached level ${p.level}!`);
				}
				
				// Generate 3 upgrade choices and pause the game
				const choices = rollUpgradeChoices(p);
				pendingUpgradeOffer = {
					playerNum: p.num,
					choices: choices
				};
				gamePaused = true;
				
				// Send upgrade offer to the player
				p.client.sendPacket(MSG.UPGRADE_OFFER, {
					choices: choices,
					newLevel: p.level
				});
				
				if (DEBUG_LEVELING_LOGS) {
					console.log(`[UPGRADE] Offering upgrades to ${p.name}:`, choices.map(c => c.name).join(', '));
				}
			}

			if (changed || p._forceXpUpdate) {
				economyDeltas.xpUpdates.push({
					num: p.num,
					level: p.level,
					xp: p.xp,
					xpPerLevel: getXpForLevel(p.level),
					sizeScale: p.sizeScale,
					droneCount: p.droneCount || 1
				});
				p._forceXpUpdate = false;
			}
			
			// Throttle drone updates to reduce bandwidth
			if (shouldSendDroneUpdates && p.drones && p.drones.length > 0) {
				economyDeltas.droneUpdates.push({
					ownerNum: p.num,
					drones: p.drones.map(d => ({
						id: d.id,
						x: d.x,
						y: d.y,
						targetId: d.targetId
					}))
				});
			}
		}
	}
	
	/**
	 * Apply level-up benefits: +1 drone and increased player size
	 */
	function applyLevelBenefits(player) {
		// Update size scale based on new level
		player.updateSizeScale();
		
		// Add one drone (up to max)
		const maxDrones = consts.MAX_DRONES || 50;
		const newDroneCount = Math.min(player.level, maxDrones);
		
		if (newDroneCount > (player.droneCount || 1)) {
			player.droneCount = newDroneCount;
			rebuildDronesArray(player, player.droneCount);
		}
	}
}

function findEmptySpawn(players, mapSize) {
	// Keep spawns away from the border a bit
	const margin = consts.SPAWN_MARGIN ?? (consts.CELL_WIDTH * 3);
	
	// New player's initial territory radius (must match initPlayer in core/index.js)
	const newTerritoryRadius = consts.CELL_WIDTH * 1.5;
	
	// Minimum distance from other players to avoid awkward immediate encounters
	// Should be at least the sum of both territories + some buffer
	const baseMinDist = consts.SPAWN_MIN_DIST ?? (newTerritoryRadius * 4);
	const maxAttempts = consts.SPAWN_MAX_ATTEMPTS ?? 300;
	
	const alivePlayers = players.filter(p => p && !p.dead && !p.disconnected);
	
	const clampSpawn = (val) => Math.max(margin, Math.min(mapSize - margin, val));
	
	// Check if the new player's territory would overlap with any existing territory.
	// We sample points around the circumference of the new player's territory circle.
	const newTerritoryOverlapsExisting = (x, y) => {
		if (alivePlayers.length === 0) return false;
		
		// Sample points around the new player's territory edge + center
		const samples = [{ x, y }]; // Center
		const numSamples = 12;
		for (let i = 0; i < numSamples; i++) {
			const angle = (i / numSamples) * Math.PI * 2;
			samples.push({
				x: x + Math.cos(angle) * newTerritoryRadius,
				y: y + Math.sin(angle) * newTerritoryRadius
			});
		}
		
		for (const p of alivePlayers) {
			const territory = p.territory;
			if (!territory || territory.length < 3) continue;
			
			// Check if any sample point is inside existing territory
			for (const sample of samples) {
				if (pointInPolygon(sample, territory)) return true;
			}
			
			// Also check if the spawn center is too close to the other player's territory boundary
			// This prevents spawning right at the edge of someone's territory
			for (const tp of territory) {
				const dist = Math.hypot(tp.x - x, tp.y - y);
				if (dist < newTerritoryRadius + PLAYER_RADIUS) return true;
			}
		}
		
		return false;
	};
	
	// Check if spawn is too close to any player's current position
	const tooCloseToAnyPlayer = (x, y, minDist) => {
		if (!minDist || minDist <= 0) return false;
		for (const p of alivePlayers) {
			const dist = Math.hypot(p.x - x, p.y - y);
			if (dist < minDist) return true;
		}
		return false;
	};
	
	// Check if spawn would be on or near any player's trail (could cause immediate snip scenarios)
	const nearAnyTrail = (x, y) => {
		const trailBuffer = newTerritoryRadius + PLAYER_RADIUS * 2;
		for (const p of alivePlayers) {
			if (!p.trail || !p.trail.points || p.trail.points.length < 2) continue;
			
			// Check distance to each trail segment
			for (let i = 0; i < p.trail.points.length - 1; i++) {
				const t1 = p.trail.points[i];
				const t2 = p.trail.points[i + 1];
				const dist = pointToSegmentDistance(x, y, t1, t2);
				if (dist < trailBuffer) return true;
			}
		}
		return false;
	};
	
	const pickRandom = () => {
		const x = clampSpawn(margin + Math.random() * (mapSize - margin * 2));
		const y = clampSpawn(margin + Math.random() * (mapSize - margin * 2));
		return { x, y };
	};
	
	// Phase 1: strict - enforce base min distance + territory safety + trail avoidance
	// Phase 2: relaxed distance - still territory-safe and trail-safe
	// Phase 3: minimal distance - just territory-safe (trail can be dealt with)
	// Phase 4: emergency - any territory-safe spot
	const phases = [
		{ attempts: Math.floor(maxAttempts * 0.4), minDist: baseMinDist, checkTrail: true },
		{ attempts: Math.floor(maxAttempts * 0.3), minDist: baseMinDist * 0.5, checkTrail: true },
		{ attempts: Math.floor(maxAttempts * 0.2), minDist: newTerritoryRadius * 2, checkTrail: false },
		{ attempts: Math.floor(maxAttempts * 0.1), minDist: 0, checkTrail: false }
	];
	
	for (const phase of phases) {
		for (let attempts = 0; attempts < phase.attempts; attempts++) {
			const { x, y } = pickRandom();
			if (newTerritoryOverlapsExisting(x, y)) continue;
			if (tooCloseToAnyPlayer(x, y, phase.minDist)) continue;
			if (phase.checkTrail && nearAnyTrail(x, y)) continue;
			return { x, y };
		}
	}
	
	// Fallback: deterministic-ish scan over a grid (with random offsets) to find *any* territory-safe point.
	// This avoids rare cases where random sampling misses a thin available region.
	const step = consts.SPAWN_SCAN_STEP ?? consts.CELL_WIDTH;
	const offX = Math.random() * step;
	const offY = Math.random() * step;
	for (let sy = margin + offY; sy <= mapSize - margin; sy += step) {
		for (let sx = margin + offX; sx <= mapSize - margin; sx += step) {
			const cx = clampSpawn(sx);
			const cy = clampSpawn(sy);
			if (!newTerritoryOverlapsExisting(cx, cy)) return { x: cx, y: cy };
		}
	}
	
	// If the entire map is covered by territories (extremely unlikely), we can't satisfy "never inside territory".
	return null;
}

// Helper: Calculate distance from point to line segment
function pointToSegmentDistance(px, py, ax, ay, bx, by) {
	// Handle object arguments
	if (typeof ax === 'object') {
		const a = ax;
		const b = ay;
		ax = a.x; ay = a.y;
		bx = b.x; by = b.y;
	}
	
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSq = dx * dx + dy * dy;
	
	if (lengthSq === 0) {
		// Segment is a point
		return Math.hypot(px - ax, py - ay);
	}
	
	// Project point onto line, clamped to segment
	let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));
	
	const projX = ax + t * dx;
	const projY = ay + t * dy;
	
	return Math.hypot(px - projX, py - projY);
}

export default Game;
