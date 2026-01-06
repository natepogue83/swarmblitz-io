import { Color, Player, initPlayer, updateFrame, polygonArea, pointInPolygon, PLAYER_RADIUS } from "./core/index.js";
import { consts } from "../config.js";
import { UPGRADES, pickUpgradeOptions, applyUpgrade } from "./upgrades.js";

// ===== DRONE SYSTEM =====

let nextDroneId = 0;

/**
 * Create a drone entity.
 */
function createDrone(ownerId, orbitAngleOffset) {
	return {
		id: nextDroneId++,
		ownerId,
		x: 0,
		y: 0,
		hp: consts.DRONE_HP || 40,
		maxHp: consts.DRONE_HP || 40,
		damage: consts.DRONE_DAMAGE || 4,
		range: consts.DRONE_RANGE || 200,
		cooldownRemaining: 0,
		orbitRadius: consts.DRONE_ORBIT_RADIUS || 55,
		orbitAngleOffset,
		targetId: null
	};
}

/**
 * Rebuild drone array with evenly spaced orbit offsets.
 * Preserves HP of existing drones where possible.
 */
function rebuildDronesArray(player, count) {
	const oldDrones = player.drones || [];
	const newDrones = [];
	
	for (let i = 0; i < count; i++) {
		const offset = (i * Math.PI * 2) / count;
		
		// Try to reuse existing drone data (preserve HP, cooldown)
		if (i < oldDrones.length) {
			const old = oldDrones[i];
			old.orbitAngleOffset = offset;
			newDrones.push(old);
		} else {
			// Create new drone
			newDrones.push(createDrone(player.num, offset));
		}
	}
	
	player.drones = newDrones;
	player.droneCount = count;
}

/**
 * Calculate the cost of the next drone for a player.
 */
function getDroneNextCost(droneCount) {
	const baseCost = consts.DRONE_BASE_COST || 120;
	const mult = consts.DRONE_COST_MULT || 1.6;
	// Cost for drone N (0-indexed): baseCost * mult^N
	return Math.floor(baseCost * Math.pow(mult, droneCount));
}

/**
 * Update drone positions to orbit around player.
 */
function updateDronePositions(player) {
	if (!player.drones) return;
	
	for (const drone of player.drones) {
		// Orbit position based on player angle + drone offset
		const angle = player.angle + drone.orbitAngleOffset;
		drone.x = player.x + Math.cos(angle) * drone.orbitRadius;
		drone.y = player.y + Math.sin(angle) * drone.orbitRadius;
		drone.ownerId = player.num;
	}
}

// ===== TURRET SYSTEM =====

/**
 * Compute turret stats based on ring index (1, 2, or 3).
 * Ring 1 = closest to home (strongest), Ring 3 = farthest (weakest).
 */
function computeTurretStats(ringIndex) {
	if (ringIndex === 1) {
		return {
			hp: consts.TURRET_RING1_HP || 100,
			maxHp: consts.TURRET_RING1_HP || 100,
			damage: consts.TURRET_RING1_DAMAGE || 10,
			range: consts.TURRET_RING1_RANGE || 350,
			cooldown: consts.TURRET_RING1_COOLDOWN || 0.5
		};
	} else if (ringIndex === 2) {
		return {
			hp: consts.TURRET_RING2_HP || 70,
			maxHp: consts.TURRET_RING2_HP || 70,
			damage: consts.TURRET_RING2_DAMAGE || 7,
			range: consts.TURRET_RING2_RANGE || 300,
			cooldown: consts.TURRET_RING2_COOLDOWN || 0.65
		};
	} else {
		return {
			hp: consts.TURRET_RING3_HP || 45,
			maxHp: consts.TURRET_RING3_HP || 45,
			damage: consts.TURRET_RING3_DAMAGE || 4,
			range: consts.TURRET_RING3_RANGE || 260,
			cooldown: consts.TURRET_RING3_COOLDOWN || 0.8
		};
	}
}

/**
 * Determine ring index based on distance from owner's home position.
 */
function getRingIndex(dist) {
	const ring1 = consts.TURRET_RING1_RADIUS || 200;
	const ring2 = consts.TURRET_RING2_RADIUS || 400;
	if (dist <= ring1) return 1;
	if (dist <= ring2) return 2;
	return 3;
}

/**
 * Create a turret entity.
 */
function createTurret(id, ownerId, x, y, ringIndex) {
	const stats = computeTurretStats(ringIndex);
	return {
		id,
		ownerId,
		x,
		y,
		ringIndex,
		hp: stats.hp,
		maxHp: stats.maxHp,
		damage: stats.damage,
		range: stats.range,
		cooldown: stats.cooldown,
		cooldownRemaining: 0,
		targetId: null // Current target player num (for visual feedback)
	};
}

function Game(id) {
	const possColors = Color.possColors();
	let nextInd = 0;
	const players = [];
	const gods = [];
	let newPlayers = [];
	let frame = 0;
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// Coins system (world pickups)
	let coins = [];
	let nextCoinId = 0;
	let coinSpawnCooldown = 0;

	// BankStore system - one per player, keyed by player.num
	const bankStores = {};
	let nextBankStoreId = 0;
	
	// Turret system
	let turrets = [];
	let nextTurretId = 0;
	const turretSpawnTimers = {}; // keyed by player.num
	
	// Projectile system
	let projectiles = [];
	let nextProjectileId = 0;

	this.id = id;
	
	this.addPlayer = (client, name) => {
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
		
		// Initialize upgrade multipliers (persist through death for session)
		p.staminaRegenMult = 1.0;
		p.staminaDrainMult = 1.0;
		p.speedMult = 1.0;
		p.snipGraceBonusSec = 0;
		p.upgrades = []; // Track applied upgrade IDs
		p.lastBankDepositTime = 0; // Cooldown tracking
		
		// Bank meter system (Archero-style)
		p.coins = 0;
		p.bankProgress = 0;
		p.bankTarget = consts.BANK_BASE_TARGET;
		p.bankLevel = 0;
		p.isChoosingUpgrade = false;
		p.upgradeOptions = []; // 3 options when choosing
		
		// Drone system - start with 1 drone
		p.droneCount = 1;
		p.drones = [];
		rebuildDronesArray(p, 1);
		
		players.push(p);
		newPlayers.push(p);
		nextInd++;
		initPlayer(p);
		
		// Create BankStore for this player at their spawn location
		const bankStore = {
			id: nextBankStoreId++,
			ownerId: p.num,
			x: p.spawnX,
			y: p.spawnY,
			radius: consts.BANKSTORE_RADIUS
		};
		bankStores[p.num] = bankStore;
		
		if (p.name.indexOf("[BOT]") == -1) {
			console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) joined.`);
		}
		
		client.on("requestFrame", () => {
			if (p.frame === frame) return;
			p.frame = frame;
			
			const splayers = players.map(val => serializePlayer(val, p.num));
			client.emit("game", {
				"num": p.num,
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": coins,
				"bankStores": Object.values(bankStores),
				"turrets": turrets,
				"projectiles": projectiles
			});
		});
		
		client.on("frame", (data, errorHan) => {
			if (typeof data === "function") {
				errorHan(false, "No data supplied.");
				return;
			}
			if (typeof errorHan !== "function") errorHan = () => {};
			
			// Ignore movement input while choosing upgrade (frozen)
			if (p.isChoosingUpgrade) {
				errorHan(true);
				return;
			}
			
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
			// Clean up bankstore when player disconnects
			delete bankStores[p.num];
			// Clean up turret spawn timer
			delete turretSpawnTimers[p.num];
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) left.`);
			}
		});
		
		// Handle upgrade choice (Archero-style level-up)
		client.on("chooseUpgrade", (data, callback) => {
			if (typeof callback !== "function") callback = () => {};
			
			if (!p.isChoosingUpgrade) {
				callback(false, "Not in upgrade selection");
				return;
			}
			
			const upgradeId = data?.upgradeId;
			if (!upgradeId) {
				callback(false, "No upgrade ID provided");
				return;
			}
			
			// Validate that the chosen upgrade is one of the offered options
			const validOption = p.upgradeOptions.find(opt => opt.id === upgradeId);
			if (!validOption) {
				callback(false, "Invalid upgrade choice");
				return;
			}
			
			// Apply the upgrade
			const success = applyUpgrade(p, upgradeId);
			if (!success) {
				callback(false, "Failed to apply upgrade");
				return;
			}
			
			p.upgrades.push(upgradeId);

			// Clear choosing state (we may re-trigger immediately if carryover fills next target)
			p.isChoosingUpgrade = false;
			p.upgradeOptions = [];

			// Advance level + target
			p.bankLevel += 1;
			p.bankTarget = consts.BANK_BASE_TARGET + p.bankLevel * consts.BANK_TARGET_INCREMENT;

			// Carryover: any overage deposited beyond the previous target should apply to next level
			// We store overage on triggerLevelUp() in p._bankCarryOver.
			const carry = Math.max(0, p._bankCarryOver || 0);
			p._bankCarryOver = 0;
			p.bankProgress = carry;

			// If carryover is enough to immediately fill the next target, prompt again (no extra deposit needed)
			if (p.bankProgress >= p.bankTarget) {
				triggerLevelUp(p);
			}

			// Ensure clients get an update even if no economy event happens this tick.
			p._forceBankUpdate = true;

			console.log(`[${new Date()}] ${p.name} chose upgrade: ${validOption.name} (Level ${p.bankLevel})`);
			callback(true, "Upgrade applied");
		});
		
		// Handle buy drone request
		client.on("buyDrone", (data, callback) => {
			if (typeof callback !== "function") callback = () => {};
			
			// Check if player is at their bank position
			const store = bankStores[p.num];
			if (!store) {
				callback(false, "No bank store found");
				return;
			}
			
			const distToStore = Math.hypot(p.x - store.x, p.y - store.y);
			if (distToStore > store.radius) {
				callback(false, "Not at home base");
				return;
			}
			
			// Check drone cap
			const maxDrones = consts.MAX_DRONES || 6;
			if ((p.droneCount || 1) >= maxDrones) {
				callback(false, "Max drones reached");
				return;
			}
			
			// Check cost
			const cost = getDroneNextCost(p.droneCount || 1);
			if ((p.coins || 0) < cost) {
				callback(false, "Not enough coins");
				return;
			}
			
			// Purchase successful
			p.coins -= cost;
			p.droneCount = (p.droneCount || 1) + 1;
			rebuildDronesArray(p, p.droneCount);
			
			// Mark for update
			p._forceBankUpdate = true;
			
			console.log(`[${new Date()}] ${p.name} bought drone #${p.droneCount} for ${cost} coins`);
			callback(true, "Drone purchased");
		});
		
		return true;
	};
	
	// Serialize player with bank meter stats
	// viewerNum: the player requesting this data (for private fields like upgradeOptions)
	function serializePlayer(player, viewerNum) {
		const data = player.serialData();
		data.staminaRegenMult = player.staminaRegenMult || 1.0;
		data.staminaDrainMult = player.staminaDrainMult || 1.0;
		data.speedMult = player.speedMult || 1.0;
		data.snipGraceBonusSec = player.snipGraceBonusSec || 0;
		data.upgrades = player.upgrades || [];
		
		// Bank meter fields
		data.coins = player.coins || 0;
		data.bankProgress = player.bankProgress || 0;
		data.bankTarget = player.bankTarget || consts.BANK_BASE_TARGET;
		data.bankLevel = player.bankLevel || 0;
		data.isChoosingUpgrade = player.isChoosingUpgrade || false;
		
		// Only send upgradeOptions to the owner (privacy)
		if (viewerNum === player.num && player.isChoosingUpgrade) {
			data.upgradeOptions = player.upgradeOptions;
		} else {
			data.upgradeOptions = [];
		}
		
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
			frame
		};
		gods.push(g);
		
		const splayers = players.map(val => serializePlayer(val, -1));
		client.emit("game", {
			"gameid": id,
			"frame": frame,
			"players": splayers,
			"coins": coins,
			"bankStores": Object.values(bankStores),
			"turrets": turrets,
			"projectiles": projectiles
		});
		
		client.on("requestFrame", () => {
			if (g.frame === frame) return;
			g.frame = frame;
			
			const splayers = players.map(val => serializePlayer(val, -1));
			g.client.emit("game", {
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": coins,
				"bankStores": Object.values(bankStores),
				"turrets": turrets,
				"projectiles": projectiles
			});
		});
		
		return true;
	};

	function tick() {
		const deltaSeconds = 1 / 60;
		const economyDeltas = {
			coinSpawns: [],
			coinRemovals: [],
			bankUpdates: [], // Bank meter updates
			turretSpawns: [],
			turretRemovals: [],
			turretUpdates: [], // HP changes, target changes
			projectileSpawns: [],
			projectileRemovals: [],
			projectileHits: [], // Hit events for visual feedback
			captureEvents: [], // Capture success events for visual feedback
			droneUpdates: [] // Drone position/HP updates
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

		const snews = newPlayers.map(val => {
			const splayers = players.map(p => serializePlayer(p, val.num));
			val.client.emit("game", {
				"num": val.num,
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": coins,
				"bankStores": Object.values(bankStores),
				"turrets": turrets,
				"projectiles": projectiles
			});
			return serializePlayer(val, val.num);
		});
		
		const moves = players.map(val => {
			return {
				num: val.num,
				left: !!val.disconnected,
				targetAngle: val.targetAngle,
				isChoosingUpgrade: val.isChoosingUpgrade
			};
		});
		
		update(economyDeltas, deltaSeconds);
		
		const data = {
			frame: frame + 1,
			moves
		};

		// Add economy deltas if they exist
		if (economyDeltas.coinSpawns.length > 0) data.coinSpawns = economyDeltas.coinSpawns;
		if (economyDeltas.coinRemovals.length > 0) data.coinRemovals = economyDeltas.coinRemovals;
		if (economyDeltas.bankUpdates.length > 0) data.bankUpdates = economyDeltas.bankUpdates;
		if (economyDeltas.turretSpawns.length > 0) data.turretSpawns = economyDeltas.turretSpawns;
		if (economyDeltas.turretRemovals.length > 0) data.turretRemovals = economyDeltas.turretRemovals;
		if (economyDeltas.turretUpdates.length > 0) data.turretUpdates = economyDeltas.turretUpdates;
		if (economyDeltas.projectileSpawns.length > 0) data.projectileSpawns = economyDeltas.projectileSpawns;
		if (economyDeltas.projectileRemovals.length > 0) data.projectileRemovals = economyDeltas.projectileRemovals;
		if (economyDeltas.projectileHits.length > 0) data.projectileHits = economyDeltas.projectileHits;
		if (economyDeltas.captureEvents.length > 0) data.captureEvents = economyDeltas.captureEvents;
		if (economyDeltas.droneUpdates.length > 0) data.droneUpdates = economyDeltas.droneUpdates;
		
		if (snews.length > 0) {
			data.newPlayers = snews;
			newPlayers = [];
		}
		
		for (const p of players) {
			p.client.emit("notifyFrame", data);
		}
		for (const g of gods) {
			g.client.emit("notifyFrame", data);
		}
		
		frame++;
	}
	
	this.tickFrame = tick;

	function update(economyDeltas, deltaSeconds) {
		const dead = [];
		updateFrame(players, dead);
		
		const PLAYER_RADIUS = consts.CELL_WIDTH / 2;

		for (const p of dead) {
			// Drop coins as loot when player dies (always drop at least minimum)
			if (!p.handledDead) {
				const heldCoins = p.coins || 0;
				const fromHeld = Math.floor(heldCoins * consts.COIN_DROP_PERCENT);
				const dropAmount = Math.max(consts.COIN_DROP_MIN, fromHeld);
				
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
				p.coins = Math.max(0, heldCoins - fromHeld);
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

		// ===== TURRET SYSTEM UPDATE =====
		
		// 1. Spawn turrets for each player
		for (const p of players) {
			if (p.dead || p.isChoosingUpgrade) continue;
			
			// Initialize spawn timer if needed
			if (turretSpawnTimers[p.num] === undefined) {
				turretSpawnTimers[p.num] = consts.TURRET_SPAWN_INTERVAL_SEC || 8;
			}
			
			// Decrement timer
			turretSpawnTimers[p.num] -= deltaSeconds;
			
			if (turretSpawnTimers[p.num] <= 0) {
				turretSpawnTimers[p.num] = consts.TURRET_SPAWN_INTERVAL_SEC || 8;
				
				// Check turret cap for this player
				const playerTurrets = turrets.filter(t => t.ownerId === p.num);
				if (playerTurrets.length >= (consts.MAX_TURRETS_PER_PLAYER || 15)) {
					continue;
				}
				
				// Try to spawn a turret in player's territory
				const spawnPos = findTurretSpawnPosition(p, playerTurrets);
				if (spawnPos) {
					const homeX = p.spawnX;
					const homeY = p.spawnY;
					const dist = Math.hypot(spawnPos.x - homeX, spawnPos.y - homeY);
					const ringIndex = getRingIndex(dist);
					
					const turret = createTurret(nextTurretId++, p.num, spawnPos.x, spawnPos.y, ringIndex);
					turrets.push(turret);
					economyDeltas.turretSpawns.push(turret);
				}
			}
		}
		
		// 1b. Check for turret captures (turrets inside enemy territory become theirs)
		for (const turret of turrets) {
			const currentOwner = players.find(p => p.num === turret.ownerId && !p.dead);
			if (!currentOwner) continue;
			
			// Only consider capture if turret is NOT in current owner's territory
			// This prevents flip-flopping when territories overlap
			const inOwnerTerritory = currentOwner.territory && currentOwner.territory.length >= 3 &&
				pointInPolygon({ x: turret.x, y: turret.y }, currentOwner.territory);
			
			if (inOwnerTerritory) continue; // Turret is safe in owner's territory
			
			// Check if turret is inside another player's territory
			for (const p of players) {
				if (p.dead || p.num === turret.ownerId) continue;
				
				// Check if turret position is inside this player's territory
				if (p.territory && p.territory.length >= 3 && 
					pointInPolygon({ x: turret.x, y: turret.y }, p.territory)) {
					
					// Transfer ownership!
					const oldOwnerId = turret.ownerId;
					turret.ownerId = p.num;
					
					// Recalculate ring index based on new owner's home position
					const dist = Math.hypot(turret.x - p.spawnX, turret.y - p.spawnY);
					turret.ringIndex = getRingIndex(dist);
					
					// Update stats based on new ring
					const stats = computeTurretStats(turret.ringIndex);
					turret.damage = stats.damage;
					turret.range = stats.range;
					turret.cooldown = stats.cooldown;
					// Keep current HP but update maxHp
					turret.maxHp = stats.maxHp;
					turret.hp = Math.min(turret.hp, turret.maxHp);
					
					// Reset target (will find new enemies)
					turret.targetId = null;
					
					// Notify clients of the ownership change
					economyDeltas.turretUpdates.push({
						id: turret.id,
						ownerId: turret.ownerId,
						ringIndex: turret.ringIndex,
						damage: turret.damage,
						range: turret.range,
						cooldown: turret.cooldown,
						maxHp: turret.maxHp,
						hp: turret.hp,
						targetId: turret.targetId
					});
					
					console.log(`Turret ${turret.id} captured by ${p.name} from player ${oldOwnerId}`);
					break; // Turret can only be in one territory
				}
			}
		}
		
		// 2. Update turrets (targeting + shooting projectiles)
		for (let i = turrets.length - 1; i >= 0; i--) {
			const turret = turrets[i];
			
			// Check if owner still exists
			const owner = players.find(p => p.num === turret.ownerId && !p.dead);
			if (!owner) {
				// Owner left/died - remove turret
				economyDeltas.turretRemovals.push(turret.id);
				turrets.splice(i, 1);
				continue;
			}
			
			// Reduce cooldown
			if (turret.cooldownRemaining > 0) {
				turret.cooldownRemaining -= deltaSeconds;
			}
			
			// Find target (nearest enemy in range)
			let target = null;
			let minDist = turret.range;
			
			for (const p of players) {
				if (p.dead || p.num === turret.ownerId || p.isChoosingUpgrade) continue;
				
				const dist = Math.hypot(p.x - turret.x, p.y - turret.y);
				if (dist < minDist) {
					minDist = dist;
					target = p;
				}
			}
			
			// Update target for visual feedback
			const prevTargetId = turret.targetId;
			turret.targetId = target ? target.num : null;
			
			// Fire projectile if ready and has target
			if (target && turret.cooldownRemaining <= 0) {
				turret.cooldownRemaining = turret.cooldown;
				
				// Calculate direction towards target (lead prediction for moving targets)
				const dx = target.x - turret.x;
				const dy = target.y - turret.y;
				const dist = Math.hypot(dx, dy);
				
				// Simple lead prediction: estimate where target will be
				const projectileSpeed = consts.PROJECTILE_SPEED || 8;
				const timeToTarget = dist / (projectileSpeed * 60); // Convert to seconds
				const predictedX = target.x + Math.cos(target.angle) * target.speed * timeToTarget * 60;
				const predictedY = target.y + Math.sin(target.angle) * target.speed * timeToTarget * 60;
				
				// Direction to predicted position
				const pdx = predictedX - turret.x;
				const pdy = predictedY - turret.y;
				const pDist = Math.hypot(pdx, pdy);
				
				const vx = (pdx / pDist) * projectileSpeed;
				const vy = (pdy / pDist) * projectileSpeed;
				
				// Create projectile
				const projectile = {
					id: nextProjectileId++,
					ownerId: turret.ownerId,
					turretId: turret.id,
					x: turret.x,
					y: turret.y,
					vx,
					vy,
					damage: turret.damage,
					lifetime: consts.PROJECTILE_MAX_LIFETIME || 3,
					radius: consts.PROJECTILE_RADIUS || 6
				};
				
				projectiles.push(projectile);
				economyDeltas.projectileSpawns.push(projectile);
			}
			
			// Send update if target changed
			if (prevTargetId !== turret.targetId) {
				economyDeltas.turretUpdates.push({
					id: turret.id,
					targetId: turret.targetId,
					hp: turret.hp
				});
			}
		}
		
		// ===== DRONE SYSTEM UPDATE =====
		
		// Update all player drones
		for (const p of players) {
			if (p.dead || !p.drones) continue;
			
			// Update drone positions (orbit around player)
			updateDronePositions(p);
			
			// Check if player is in own territory (for HP regen)
			const inTerritory = p.territory && p.territory.length >= 3 && 
				pointInPolygon({ x: p.x, y: p.y }, p.territory);
			
			// Update each drone
			for (const drone of p.drones) {
				// HP regeneration when owner is in safe territory
				if (inTerritory && drone.hp < drone.maxHp) {
					const regenRate = consts.DRONE_HP_REGEN_IN_TERRITORY || 8;
					drone.hp = Math.min(drone.maxHp, drone.hp + regenRate * deltaSeconds);
				}
				
				// Skip targeting/shooting if dead or choosing upgrade
				if (p.isChoosingUpgrade) continue;
				
				// Reduce cooldown
				if (drone.cooldownRemaining > 0) {
					drone.cooldownRemaining -= deltaSeconds;
				}
				
				// Find target (nearest enemy player in range)
				let target = null;
				let minDist = drone.range;
				
				for (const enemy of players) {
					if (enemy.dead || enemy.num === p.num || enemy.isChoosingUpgrade) continue;
					// Don't target snipped invulnerable players (if you want this behavior)
					// if (enemy.isSnipped) continue;
					
					const dist = Math.hypot(enemy.x - drone.x, enemy.y - drone.y);
					if (dist < minDist) {
						minDist = dist;
						target = enemy;
					}
				}
				
				drone.targetId = target ? target.num : null;
				
				// Fire projectile if ready and has target
				if (target && drone.cooldownRemaining <= 0) {
					drone.cooldownRemaining = consts.DRONE_COOLDOWN || 1.0;
					
					// Calculate direction towards target with lead prediction
					const dx = target.x - drone.x;
					const dy = target.y - drone.y;
					const dist = Math.hypot(dx, dy);
					
					const projectileSpeed = consts.PROJECTILE_SPEED || 8;
					const timeToTarget = dist / (projectileSpeed * 60);
					const predictedX = target.x + Math.cos(target.angle) * target.speed * timeToTarget * 60;
					const predictedY = target.y + Math.sin(target.angle) * target.speed * timeToTarget * 60;
					
					const pdx = predictedX - drone.x;
					const pdy = predictedY - drone.y;
					const pDist = Math.hypot(pdx, pdy);
					
					const vx = (pdx / pDist) * projectileSpeed;
					const vy = (pdy / pDist) * projectileSpeed;
					
					// Create projectile (same system as turrets)
					const projectile = {
						id: nextProjectileId++,
						ownerId: p.num,
						droneId: drone.id,
						x: drone.x,
						y: drone.y,
						vx,
						vy,
						damage: drone.damage,
						lifetime: consts.PROJECTILE_MAX_LIFETIME || 3,
						radius: consts.PROJECTILE_RADIUS || 6
					};
					
					projectiles.push(projectile);
					economyDeltas.projectileSpawns.push(projectile);
				}
			}
		}
		
		// 2b. Update projectiles (movement + collision)
		const projectileRadius = consts.PROJECTILE_RADIUS || 6;
		const playerRadius = consts.CELL_WIDTH / 2;
		
		for (let i = projectiles.length - 1; i >= 0; i--) {
			const proj = projectiles[i];
			
			// Move projectile
			proj.x += proj.vx;
			proj.y += proj.vy;
			
			// Reduce lifetime
			proj.lifetime -= deltaSeconds;
			
			// Check if out of bounds or expired
			if (proj.lifetime <= 0 || 
				proj.x < 0 || proj.x > mapSize || 
				proj.y < 0 || proj.y > mapSize) {
				economyDeltas.projectileRemovals.push(proj.id);
				projectiles.splice(i, 1);
				continue;
			}
			
			// Check collision with players (except owner)
			let hit = false;
			for (const p of players) {
				if (p.dead || p.num === proj.ownerId || p.isChoosingUpgrade) continue;
				
				const dist = Math.hypot(p.x - proj.x, p.y - proj.y);
				if (dist < playerRadius + projectileRadius) {
					// Hit!
					p.hp -= proj.damage;
					if (p.hp < 0) p.hp = 0;
					
					economyDeltas.projectileHits.push({
						projectileId: proj.id,
						targetNum: p.num,
						x: proj.x,
						y: proj.y,
						damage: proj.damage,
						remainingHp: p.hp  // Send current HP so client can sync
					});
					
					// Check for death - add to dead array for proper processing
					if (p.hp <= 0) {
						p.die();
						dead.push(p);
					}
					
					// Remove projectile
					economyDeltas.projectileRemovals.push(proj.id);
					projectiles.splice(i, 1);
					hit = true;
					break;
				}
			}
			
			// Check collision with enemy drones (drones can be damaged)
			if (!hit) {
				const droneRadius = consts.DRONE_RADIUS || 10;
				for (const p of players) {
					if (p.dead || p.num === proj.ownerId || !p.drones) continue;
					
					for (const drone of p.drones) {
						if (drone.hp <= 0) continue;
						
						const dist = Math.hypot(drone.x - proj.x, drone.y - proj.y);
						if (dist < droneRadius + projectileRadius) {
							// Hit drone!
							drone.hp -= proj.damage;
							if (drone.hp < 0) drone.hp = 0;
							
							economyDeltas.projectileHits.push({
								projectileId: proj.id,
								droneId: drone.id,
								ownerNum: p.num,
								x: proj.x,
								y: proj.y,
								damage: proj.damage,
								isDroneHit: true
							});
							
							// Remove projectile
							economyDeltas.projectileRemovals.push(proj.id);
							projectiles.splice(i, 1);
							hit = true;
							break;
						}
					}
					if (hit) break;
				}
			}
		}
		
		// 3. Process players who died from projectile damage
		// (These were added to dead[] after the initial death processing loop)
		for (const p of dead) {
			if (p.handledDead) continue; // Skip if already processed
			
			// Drop coins as loot when player dies
			const heldCoins = p.coins || 0;
			const fromHeld = Math.floor(heldCoins * consts.COIN_DROP_PERCENT);
			const dropAmount = Math.max(consts.COIN_DROP_MIN, fromHeld);
			
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
			p.coins = Math.max(0, heldCoins - fromHeld);
			
			possColors.push(p.baseColor);
			p.handledDead = true;
			
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`${p.name || "Unnamed"} (${p.num}) died from turret damage.`);
			}
			p.client.emit("dead");
			p.client.disconnect(true);
		}
		
		// 4. Remove turrets of dead players (cleanup)
		const deadPlayerNums = new Set(dead.map(p => p.num));
		for (let i = turrets.length - 1; i >= 0; i--) {
			if (deadPlayerNums.has(turrets[i].ownerId)) {
				economyDeltas.turretRemovals.push(turrets[i].id);
				turrets.splice(i, 1);
			}
		}
		
		// Also remove projectiles from dead players
		for (let i = projectiles.length - 1; i >= 0; i--) {
			if (deadPlayerNums.has(projectiles[i].ownerId)) {
				economyDeltas.projectileRemovals.push(projectiles[i].id);
				projectiles.splice(i, 1);
			}
		}

		// Process alive players economy
		for (const p of players) {
			// Skip economy processing while choosing upgrade (frozen state)
			if (p.isChoosingUpgrade) {
				// Still allow forced bank updates (e.g. triggered by chooseUpgrade)
				if (p._forceBankUpdate) {
					economyDeltas.bankUpdates.push({
						num: p.num,
						coins: p.coins,
						bankProgress: p.bankProgress,
						bankTarget: p.bankTarget,
						bankLevel: p.bankLevel,
						isChoosingUpgrade: p.isChoosingUpgrade,
						upgradeOptions: p.isChoosingUpgrade ? p.upgradeOptions : []
					});
					p._forceBankUpdate = false;
				}
				continue;
			}
			
			let changed = false;

			// 1. Coin pickups -> add to coins (not bankProgress yet)
			for (let i = coins.length - 1; i >= 0; i--) {
				const coin = coins[i];
				const dist = Math.hypot(p.x - coin.x, p.y - coin.y);
				if (dist < PLAYER_RADIUS + consts.COIN_RADIUS) {
					p.coins += coin.value;
					economyDeltas.coinRemovals.push(coin.id);
					coins.splice(i, 1);
					changed = true;
				}
			}

			// 2. Territory rewards -> add to coins
			if (p._pendingTerritoryAreaGained > 0) {
				p._territoryCoinCarry += p._pendingTerritoryAreaGained * consts.COINS_PER_AREA_UNIT;
				const coinsGained = Math.floor(p._territoryCoinCarry);
				if (coinsGained > 0) {
					p.coins += coinsGained;
					p._territoryCoinCarry -= coinsGained;
					changed = true;
					
					// Emit capture event for visual feedback
					economyDeltas.captureEvents.push({
						playerNum: p.num,
						x: p.x,
						y: p.y,
						coinsGained: coinsGained,
						areaGained: p._pendingTerritoryAreaGained
					});
				}
				p._pendingTerritoryAreaGained = 0;
			}

			// 3. Deposit coins -> bankProgress (only at player's own bank circle)
			const store = bankStores[p.num];
			if (store && p.coins > 0) {
				const distToStore = Math.hypot(p.x - store.x, p.y - store.y);
				const now = Date.now();
				if (distToStore < store.radius && (now - p.lastBankDepositTime) >= consts.BANK_DEPOSIT_COOLDOWN_MS) {
					// Deposit all coins into bankProgress
					p.bankProgress += p.coins;
					p.coins = 0;
					p.lastBankDepositTime = now;
					changed = true;
					
					// Check if bank meter is full -> trigger level-up
					if (p.bankProgress >= p.bankTarget && !p.isChoosingUpgrade) {
						triggerLevelUp(p);
						changed = true;
					}
				}
			}

			if (changed || p._forceBankUpdate) {
				economyDeltas.bankUpdates.push({
					num: p.num,
					coins: p.coins,
					bankProgress: p.bankProgress,
					bankTarget: p.bankTarget,
					bankLevel: p.bankLevel,
					isChoosingUpgrade: p.isChoosingUpgrade,
					upgradeOptions: p.isChoosingUpgrade ? p.upgradeOptions : [],
					droneCount: p.droneCount || 1
				});
				p._forceBankUpdate = false;
			}
			
			// Always send drone updates (positions change every frame)
			if (p.drones && p.drones.length > 0) {
				economyDeltas.droneUpdates.push({
					ownerNum: p.num,
					drones: p.drones.map(d => ({
						id: d.id,
						x: d.x,
						y: d.y,
						hp: d.hp,
						maxHp: d.maxHp,
						targetId: d.targetId
					}))
				});
			}
		}
	}
	
	function triggerLevelUp(player) {
		if (player.isChoosingUpgrade) return;

		// Compute carryover and keep the meter visually \"full\" during selection.
		const carry = Math.max(0, (player.bankProgress || 0) - (player.bankTarget || 0));
		player._bankCarryOver = carry;
		player.bankProgress = player.bankTarget;

		player.isChoosingUpgrade = true;
		player.upgradeOptions = pickUpgradeOptions(3);

		// Ensure clients receive the upgradeOptions immediately
		player._forceBankUpdate = true;

		console.log(`[${new Date()}] ${player.name} reached bank level ${player.bankLevel + 1}! Choosing upgrade...`);
	}
}

/**
 * Find a valid spawn position for a turret within the player's territory.
 * Tries to find a spot that respects minimum spacing from other turrets.
 */
function findTurretSpawnPosition(player, existingTurrets) {
	const territory = player.territory;
	if (!territory || territory.length < 3) return null;
	
	const minSpacing = consts.MIN_TURRET_SPACING || 60;
	const maxAttempts = 30;
	
	// Calculate bounding box of territory
	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	for (const pt of territory) {
		if (pt.x < minX) minX = pt.x;
		if (pt.x > maxX) maxX = pt.x;
		if (pt.y < minY) minY = pt.y;
		if (pt.y > maxY) maxY = pt.y;
	}
	
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		// Random point in bounding box
		const x = minX + Math.random() * (maxX - minX);
		const y = minY + Math.random() * (maxY - minY);
		
		// Check if point is inside territory
		if (!pointInPolygon({ x, y }, territory)) continue;
		
		// Check spacing from existing turrets
		let tooClose = false;
		for (const t of existingTurrets) {
			const dist = Math.hypot(t.x - x, t.y - y);
			if (dist < minSpacing) {
				tooClose = true;
				break;
			}
		}
		
		if (!tooClose) {
			return { x, y };
		}
	}
	
	return null; // Could not find valid position
}

function findEmptySpawn(players, mapSize) {
	// Keep spawns away from the border a bit (same as previous behavior)
	const margin = consts.SPAWN_MARGIN ?? (consts.CELL_WIDTH * 3);
	
	// "Try" to keep some minimum distance from other players, but don't optimize for max distance.
	// We'll relax this constraint if space is tight so spawns don't fail or become too predictable.
	const baseMinDist = consts.SPAWN_MIN_DIST ?? (consts.CELL_WIDTH * 5);
	const maxAttempts = consts.SPAWN_MAX_ATTEMPTS ?? 220;
	
	const alivePlayers = players.filter(p => p && !p.dead && !p.disconnected);
	
	const clampSpawn = (val) => Math.max(margin, Math.min(mapSize - margin, val));
	
	// Returns true if a player-sized circle around (x,y) overlaps any other player's territory polygon.
	const overlapsAnyTerritory = (x, y) => {
		if (alivePlayers.length === 0) return false;
		
		// Check center + a few offsets so we don't place a player's body partially inside territory
		const r = (PLAYER_RADIUS || 15) * 0.9;
		const probes = [
			{ x, y },
			{ x: x + r, y },
			{ x: x - r, y },
			{ x, y: y + r },
			{ x, y: y - r }
		];
		
		for (const p of alivePlayers) {
			const territory = p.territory;
			if (!territory || territory.length < 3) continue;
			
			for (const probe of probes) {
				if (pointInPolygon(probe, territory)) return true;
			}
		}
		
		return false;
	};
	
	const tooCloseToAnyPlayer = (x, y, minDist) => {
		if (!minDist || minDist <= 0) return false;
		for (const p of alivePlayers) {
			const dist = Math.hypot(p.x - x, p.y - y);
			if (dist < minDist) return true;
		}
		return false;
	};
	
	const pickRandom = () => {
		const x = clampSpawn(margin + Math.random() * (mapSize - margin * 2));
		const y = clampSpawn(margin + Math.random() * (mapSize - margin * 2));
		return { x, y };
	};
	
	// Phase 1: enforce base min distance + territory safety
	// Phase 2: relax min distance a bit (still territory-safe)
	// Phase 3: ignore min distance entirely (still territory-safe)
	const phases = [
		{ attempts: Math.floor(maxAttempts * 0.45), minDist: baseMinDist },
		{ attempts: Math.floor(maxAttempts * 0.35), minDist: baseMinDist * 0.6 },
		{ attempts: Math.max(1, maxAttempts - Math.floor(maxAttempts * 0.45) - Math.floor(maxAttempts * 0.35)), minDist: 0 }
	];
	
	for (const phase of phases) {
		for (let attempts = 0; attempts < phase.attempts; attempts++) {
			const { x, y } = pickRandom();
			if (overlapsAnyTerritory(x, y)) continue;
			if (tooCloseToAnyPlayer(x, y, phase.minDist)) continue;
			return { x, y };
		}
	}
	
	// Fallback: deterministic-ish scan over a grid (with random offsets) to find *any* territory-safe point.
	// This avoids rare cases where random sampling misses a thin available region.
	const step = consts.SPAWN_SCAN_STEP ?? consts.CELL_WIDTH;
	const offX = Math.random() * step;
	const offY = Math.random() * step;
	for (let y = margin + offY; y <= mapSize - margin; y += step) {
		for (let x = margin + offX; x <= mapSize - margin; x += step) {
			const sx = clampSpawn(x);
			const sy = clampSpawn(y);
			if (!overlapsAnyTerritory(sx, sy)) return { x: sx, y: sy };
		}
	}
	
	// If the entire map is covered by territories (extremely unlikely), we can't satisfy "never inside territory".
	return null;
}

export default Game;
