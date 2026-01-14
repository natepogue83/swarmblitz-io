import { Color, Player, initPlayer, updateFrame, polygonArea, pointInPolygon, PLAYER_RADIUS } from "./core/index.js";
import { consts } from "../config.js";

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
	let newPlayers = [];
	let frame = 0;
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// Spatial grid for efficient nearby queries
	const spatialGrid = new SpatialGrid(mapSize, GRID_CELL_SIZE);
	
	// XP pickups (world pickups - renamed from coins)
	let coins = [];  // Still called "coins" internally for pickup entities
	let nextCoinId = 0;
	let coinSpawnCooldown = 0;

	this.id = id;
	
	this.addPlayer = (client, name, viewport) => {
		if (players.length >= consts.MAX_PLAYERS) return false;
		
		const start = findEmptySpawn(players, mapSize);
		if (!start) return false;
		
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
		
		// AOI tracking - which players this player knows about
		p.knownPlayers = new Set();  // Set of player nums this client has received
		p.knownCoins = new Set();    // Set of coin IDs this client has received
		
		// Viewport-based AOI - calculate radius based on client's screen size
		p.viewport = viewport || { width: 800, height: 600 };
		p.aoiRadius = calculateAOIRadius(p.viewport);
		
		players.push(p);
		newPlayers.push(p);
		nextInd++;
		initPlayer(p);
		
		// Add to spatial grid
		spatialGrid.insert(p);
		
		if (p.name.indexOf("[BOT]") == -1) {
			console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) joined.`);
		}
		
		client.on("requestFrame", () => {
			if (p.frame === frame) return;
			p.frame = frame;
			
			// On full refresh, only send nearby players (AOI based on viewport)
			const aoiRadius = p.aoiRadius || calculateAOIRadius(p.viewport);
			const nearbyPlayers = spatialGrid.getNearby(p.x, p.y, aoiRadius);
			const nearbyCoins = coins.filter(c => 
				Math.hypot(c.x - p.x, c.y - p.y) <= aoiRadius
			);
			
			// Update known sets
			p.knownPlayers.clear();
			p.knownCoins.clear();
			for (const np of nearbyPlayers) {
				p.knownPlayers.add(np.num);
			}
			for (const c of nearbyCoins) {
				p.knownCoins.add(c.id);
			}
			
			const splayers = nearbyPlayers.map(val => serializePlayer(val, p.num));
			client.emit("game", {
				"num": p.num,
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": nearbyCoins
			});
		});
		
		// Handle viewport updates (when player resizes window)
		client.on("viewport", (viewport) => {
			if (viewport && typeof viewport.width === "number" && typeof viewport.height === "number") {
				p.viewport = viewport;
				p.aoiRadius = calculateAOIRadius(viewport);
			}
		});
		
		client.on("frame", (data, errorHan) => {
			if (typeof data === "function") {
				errorHan(false, "No data supplied.");
				return;
			}
			if (typeof errorHan !== "function") errorHan = () => {};
			
			if (!data) {
				errorHan(false, "No data supplied.");
			} else if (data.targetAngle !== undefined) {
				if (typeof data.targetAngle === "number" && !isNaN(data.targetAngle)) {
					p.targetAngle = data.targetAngle;
					errorHan(true);
				} else {
					errorHan(false, "Target angle must be a valid number.");
				}
			} else {
				errorHan(true);
			}
		});
		
		client.on("disconnect", () => {
			p.die();
			p.disconnected = true;
			spatialGrid.remove(p);
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) left.`);
			}
		});
		
		return true;
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
	
	this.addGod = client => {
		const g = {
			client,
			frame,
			isGod: true  // Gods see everything (for spectating)
		};
		gods.push(g);
		
		const splayers = players.map(val => serializePlayer(val, -1));
		client.emit("game", {
			"gameid": id,
			"frame": frame,
			"players": splayers,
			"coins": coins
		});
		
		client.on("requestFrame", () => {
			if (g.frame === frame) return;
			g.frame = frame;
			
			const splayers = players.map(val => serializePlayer(val, -1));
			g.client.emit("game", {
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": coins
			});
		});
		
		return true;
	};

	function tick() {
		const deltaSeconds = 1 / 60;
		
		// Global economy deltas (will be filtered per-player later)
		const economyDeltas = {
			coinSpawns: [],
			coinRemovals: [],
			xpUpdates: [], // XP/Level updates
			levelUps: [],  // Level up events
			hitscanEvents: [], // Drone hitscan laser shots
			captureEvents: [], // Capture success events for visual feedback
			droneUpdates: [], // Drone position updates
			killEvents: [] // Kill events for kill counter
		};

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
			economyDeltas.coinSpawns.push(newCoin);
			coinSpawnCooldown = consts.COIN_SPAWN_INTERVAL_SEC;
		}

		// Handle new players - send them initial game state (AOI-filtered)
		for (const val of newPlayers) {
			const aoiRadius = val.aoiRadius || calculateAOIRadius(val.viewport);
			const nearbyPlayers = spatialGrid.getNearby(val.x, val.y, aoiRadius);
			const nearbyCoins = coins.filter(c => 
				Math.hypot(c.x - val.x, c.y - val.y) <= aoiRadius
			);
			
			// Initialize known sets
			val.knownPlayers = val.knownPlayers || new Set();
			val.knownCoins = val.knownCoins || new Set();
			val.knownPlayers.clear();
			val.knownCoins.clear();
			for (const np of nearbyPlayers) {
				val.knownPlayers.add(np.num);
			}
			for (const c of nearbyCoins) {
				val.knownCoins.add(c.id);
			}
			
			const splayers = nearbyPlayers.map(p => serializePlayer(p, val.num));
			val.client.emit("game", {
				"num": val.num,
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": nearbyCoins
			});
		}
		newPlayers = [];
		
		// Run game simulation
		update(economyDeltas, deltaSeconds);
		
		// Update spatial grid for all alive players
		for (const p of players) {
			if (!p.dead && !p.disconnected) {
				spatialGrid.update(p);
			}
		}
		
		// Build per-player update packets with AOI filtering
		for (const p of players) {
			if (p.disconnected || p.dead) continue;
			
			// Ensure AOI tracking sets exist
			if (!p.knownPlayers) p.knownPlayers = new Set();
			if (!p.knownCoins) p.knownCoins = new Set();
			
			// Always know about self
			p.knownPlayers.add(p.num);
			
			// Use player's viewport-based AOI radius
			const aoiRadius = p.aoiRadius || calculateAOIRadius(p.viewport);
			const { nearby, inBuffer } = spatialGrid.getNearbyWithBuffer(p.x, p.y, aoiRadius, AOI_HYSTERESIS);
			
			// Always include self in nearby
			if (!nearby.includes(p)) {
				nearby.push(p);
			}
			
			const nearbyNums = new Set(nearby.map(np => np.num));
			const bufferNums = new Set(inBuffer.map(np => np.num));
			
			// Determine players entering and leaving AOI
			const entering = [];
			const leaving = [];
			
			// Check for new players entering AOI
			for (const np of nearby) {
				if (!p.knownPlayers.has(np.num)) {
					entering.push(np);
					p.knownPlayers.add(np.num);
				}
			}
			
			// Check for players leaving AOI (not in nearby or buffer)
			for (const knownNum of p.knownPlayers) {
				if (!nearbyNums.has(knownNum) && !bufferNums.has(knownNum)) {
					leaving.push(knownNum);
				}
			}
			for (const leaveNum of leaving) {
				p.knownPlayers.delete(leaveNum);
			}
			
			// Build moves array for only known players
			const moves = [];
			for (const np of nearby) {
				moves.push({
					num: np.num,
					left: !!np.disconnected || np.dead,
					targetAngle: np.targetAngle
				});
			}
			// Include buffer players but mark them as "left" if they died
			for (const bp of inBuffer) {
				if (p.knownPlayers.has(bp.num)) {
					moves.push({
						num: bp.num,
						left: !!bp.disconnected || bp.dead,
						targetAngle: bp.targetAngle
					});
				}
			}
			
			// Filter economy deltas by AOI
			const filteredData = {
				frame: frame + 1,
				moves
			};
			
			// Coin spawns within AOI
			if (economyDeltas.coinSpawns.length > 0) {
				const nearbyCoinSpawns = economyDeltas.coinSpawns.filter(c => 
					Math.hypot(c.x - p.x, c.y - p.y) <= aoiRadius
				);
				if (nearbyCoinSpawns.length > 0) {
					filteredData.coinSpawns = nearbyCoinSpawns;
					for (const c of nearbyCoinSpawns) {
						p.knownCoins.add(c.id);
					}
				}
			}
			
			// Coin removals - only if player knew about the coin
			if (economyDeltas.coinRemovals.length > 0) {
				const knownRemovals = economyDeltas.coinRemovals.filter(id => 
					p.knownCoins.has(id)
				);
				if (knownRemovals.length > 0) {
					filteredData.coinRemovals = knownRemovals;
					for (const id of knownRemovals) {
						p.knownCoins.delete(id);
					}
				}
			}
			
			// XP updates for known players only
			if (economyDeltas.xpUpdates.length > 0) {
				const nearbyXp = economyDeltas.xpUpdates.filter(u => 
					p.knownPlayers.has(u.num) || u.num === p.num
				);
				if (nearbyXp.length > 0) filteredData.xpUpdates = nearbyXp;
			}
			
			// Level ups for known players
			if (economyDeltas.levelUps.length > 0) {
				const nearbyLvl = economyDeltas.levelUps.filter(u => 
					p.knownPlayers.has(u.playerNum) || u.playerNum === p.num
				);
				if (nearbyLvl.length > 0) filteredData.levelUps = nearbyLvl;
			}
			
			// Hitscan events within AOI
			if (economyDeltas.hitscanEvents.length > 0) {
				const nearbyHits = economyDeltas.hitscanEvents.filter(h => 
					Math.hypot(h.fromX - p.x, h.fromY - p.y) <= aoiRadius ||
					Math.hypot(h.toX - p.x, h.toY - p.y) <= aoiRadius
				);
				if (nearbyHits.length > 0) filteredData.hitscanEvents = nearbyHits;
			}
			
			// Capture events for known players
			if (economyDeltas.captureEvents.length > 0) {
				const nearbyCap = economyDeltas.captureEvents.filter(e => 
					p.knownPlayers.has(e.playerNum) || e.playerNum === p.num
				);
				if (nearbyCap.length > 0) filteredData.captureEvents = nearbyCap;
			}
			
			// Drone updates for known players
			if (economyDeltas.droneUpdates.length > 0) {
				const nearbyDrones = economyDeltas.droneUpdates.filter(d => 
					p.knownPlayers.has(d.ownerNum) || d.ownerNum === p.num
				);
				if (nearbyDrones.length > 0) filteredData.droneUpdates = nearbyDrones;
			}
			
			// Kill events - always send if local player is killer or victim
			if (economyDeltas.killEvents.length > 0) {
				const relevantKills = economyDeltas.killEvents.filter(k => 
					k.killerNum === p.num || k.victimNum === p.num ||
					p.knownPlayers.has(k.killerNum) || p.knownPlayers.has(k.victimNum)
				);
				if (relevantKills.length > 0) filteredData.killEvents = relevantKills;
			}
			
			// New players entering AOI
			if (entering.length > 0) {
				filteredData.newPlayers = entering.map(np => serializePlayer(np, p.num));
			}
			
			// Players leaving AOI
			if (leaving.length > 0) {
				filteredData.leftPlayers = leaving;
			}
			
			p.client.emit("notifyFrame", filteredData);
		}
		
		// Gods see everything
		const godData = {
			frame: frame + 1,
			moves: players.map(val => ({
				num: val.num,
				left: !!val.disconnected,
				targetAngle: val.targetAngle
			}))
		};
		if (economyDeltas.coinSpawns.length > 0) godData.coinSpawns = economyDeltas.coinSpawns;
		if (economyDeltas.coinRemovals.length > 0) godData.coinRemovals = economyDeltas.coinRemovals;
		if (economyDeltas.xpUpdates.length > 0) godData.xpUpdates = economyDeltas.xpUpdates;
		if (economyDeltas.levelUps.length > 0) godData.levelUps = economyDeltas.levelUps;
		if (economyDeltas.hitscanEvents.length > 0) godData.hitscanEvents = economyDeltas.hitscanEvents;
		if (economyDeltas.captureEvents.length > 0) godData.captureEvents = economyDeltas.captureEvents;
		if (economyDeltas.droneUpdates.length > 0) godData.droneUpdates = economyDeltas.droneUpdates;
		if (economyDeltas.killEvents.length > 0) godData.killEvents = economyDeltas.killEvents;
		
		for (const g of gods) {
			g.client.emit("notifyFrame", godData);
		}
		
		frame++;
	}
	
	this.tickFrame = tick;

	function update(economyDeltas, deltaSeconds) {
		const dead = [];
		
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
		
		updateFrame(players, dead, notifyKill);
		
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
			p.client.emit("dead");
			p.client.disconnect(true);
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
			
			// Update each drone
			for (const drone of p.drones) {
				// Reduce cooldown
				if (drone.cooldownRemaining > 0) {
					drone.cooldownRemaining -= deltaSeconds;
				}
				
				// Drones are disabled when owner is snipped (can't target or fire)
				if (p.isSnipped) {
					drone.targetId = null;
					continue; // Skip targeting and firing
				}
				
				// Find target (nearest enemy player in range, measured from the owner center)
				let target = null;
				let minDist = drone.range;
				const ownerX = p.x;
				const ownerY = p.y;
				
				for (const enemy of players) {
					if (enemy.dead || enemy.num === p.num) continue;
					// Don't target snipped invulnerable players (if you want this behavior)
					// if (enemy.isSnipped) continue;
					
					// Measure from player center so range matches the rendered ring
					const dist = Math.hypot(enemy.x - ownerX, enemy.y - ownerY);
					if (dist < minDist) {
						minDist = dist;
						target = enemy;
					}
				}
				
				drone.targetId = target ? target.num : null;
				
				// Hitscan fire if ready and has target
				if (target && drone.cooldownRemaining <= 0) {
					drone.cooldownRemaining = consts.DRONE_COOLDOWN || 1.0;
					
					// Calculate damage dynamically from config
					// First drone = full damage, 2nd = EXTRA_MULT, 3rd+ = decay factor applied
					const droneIndex = p.drones.indexOf(drone);
					const baseDamage = consts.DRONE_DAMAGE || 10;
					const extraMult = consts.DRONE_DAMAGE_EXTRA_MULT ?? 0.35;
					const decayFactor = consts.DRONE_DAMAGE_DECAY_FACTOR ?? 0.9;
					
					let damage;
					if (droneIndex === 0) {
						damage = baseDamage;
					} else if (droneIndex === 1) {
						damage = baseDamage * extraMult;
					} else {
						// 3rd drone and beyond: apply decay factor for each drone after the 2nd
						damage = baseDamage * extraMult * Math.pow(decayFactor, droneIndex - 1);
					}
					
					// Apply damage reduction if target is in their own territory
					const targetInTerritory = target.territory && target.territory.length > 0 && 
						pointInPolygon({ x: target.x, y: target.y }, target.territory);
					if (targetInTerritory) {
						const reduction = consts.TERRITORY_DAMAGE_REDUCTION ?? 0.5;
						damage = damage * (1 - reduction);
					}
					
					// Hitscan: instant damage to target
					target.hp -= damage;
					if (target.hp < 0) target.hp = 0;
					
					if (DEBUG_HITSCAN_LOGS) {
						console.log(`[HITSCAN] Drone ${drone.id} (owner: ${p.name}) hit ${target.name} for ${damage.toFixed(1)} dmg${targetInTerritory ? ' (in territory)' : ''}. HP: ${target.hp}/${target.maxHp}`);
					}
					
					// Send hitscan event for visual feedback (laser line from drone to target)
					economyDeltas.hitscanEvents.push({
						fromX: drone.x,
						fromY: drone.y,
						toX: target.x,
						toY: target.y,
						ownerId: p.num,
						targetNum: target.num,
						damage: damage,
						remainingHp: target.hp
					});
					
					// Check for death
					if (target.hp <= 0) {
						target.die();
						dead.push(target);
						
						// Send kill event for the drone owner
						economyDeltas.killEvents.push({
							killerNum: p.num,
							victimNum: target.num,
							victimName: target.name || 'Unknown',
							killType: 'drone'
						});
					}
				}
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
			p.client.emit("dead");
			p.client.disconnect(true);
		}
		
		// Process alive players economy (XP/Leveling)
		for (const p of players) {
			if (p.dead) continue;
			
			let changed = false;

			// 1. XP pickups (coins) -> add directly to XP
			const scaledRadius = p.getScaledRadius ? p.getScaledRadius() : PLAYER_RADIUS;
			for (let i = coins.length - 1; i >= 0; i--) {
				const coin = coins[i];
				const dist = Math.hypot(p.x - coin.x, p.y - coin.y);
				if (dist < scaledRadius + consts.COIN_RADIUS) {
					p.xp += coin.value;
					economyDeltas.coinRemovals.push(coin.id);
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
			while (p.xp >= xpNeeded) {
				p.xp -= xpNeeded;
				p.level += 1;
				xpNeeded = getXpForLevel(p.level);
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
			
			// Always send drone updates (positions change every frame)
			if (p.drones && p.drones.length > 0) {
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
