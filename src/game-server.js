import { Color, Player, initPlayer, updateFrame, polygonArea, pointInPolygon, PLAYER_RADIUS } from "./core/index.js";
import { consts } from "../config.js";

// Debug logging (keep off by default for performance)
const DEBUG_LEVELING_LOGS = false;
const DEBUG_HITSCAN_LOGS = false;
const DEBUG_KILL_REWARD_LOGS = false;

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

function Game(id) {
	const possColors = Color.possColors();
	let nextInd = 0;
	const players = [];
	const gods = [];
	let newPlayers = [];
	let frame = 0;
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// XP pickups (world pickups - renamed from coins)
	let coins = [];  // Still called "coins" internally for pickup entities
	let nextCoinId = 0;
	let coinSpawnCooldown = 0;

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
		
		players.push(p);
		newPlayers.push(p);
		nextInd++;
		initPlayer(p);
		
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
				"coins": coins
			});
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
			frame
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

		const snews = newPlayers.map(val => {
			const splayers = players.map(p => serializePlayer(p, val.num));
			val.client.emit("game", {
				"num": val.num,
				"gameid": id,
				"frame": frame,
				"players": splayers,
				"coins": coins
			});
			return serializePlayer(val, val.num);
		});
		
		const moves = players.map(val => {
			return {
				num: val.num,
				left: !!val.disconnected,
				targetAngle: val.targetAngle
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
		if (economyDeltas.xpUpdates.length > 0) data.xpUpdates = economyDeltas.xpUpdates;
		if (economyDeltas.levelUps.length > 0) data.levelUps = economyDeltas.levelUps;
		if (economyDeltas.hitscanEvents.length > 0) data.hitscanEvents = economyDeltas.hitscanEvents;
		if (economyDeltas.captureEvents.length > 0) data.captureEvents = economyDeltas.captureEvents;
		if (economyDeltas.droneUpdates.length > 0) data.droneUpdates = economyDeltas.droneUpdates;
		if (economyDeltas.killEvents.length > 0) data.killEvents = economyDeltas.killEvents;
		
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
