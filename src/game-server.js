import { Color, Player, initPlayer, updateFrame, polygonArea, pointInPolygon, PLAYER_RADIUS } from "./core/index.js";
import Enemy from "./core/enemy.js";
import EnemySpawner, { ENEMY_TYPES, BOSS_TYPES } from "./core/enemy-spawner.js";
import { ENEMY_SCALING, ENEMY_XP_DROP, ENEMY_SPAWN_LIMITS } from "./core/enemy-knobs.js";
import { consts } from "../config.js";
import { MSG } from "./net/packet.js";
import { rollUpgradeChoices, selectUpgrade, initPlayerUpgrades, serializeUpgrades, recalculateDerivedStats } from "./core/upgrade-system.js";
import { rollDroneChoices, getDroneType, getDefaultDroneType, applyDroneType, DRONE_TYPES_BY_ID, DRONE_TYPES } from "./core/drone-types.js";
import * as UPGRADE_KNOBS from "./core/upgrade-knobs.js";

// Debug logging (keep off by default for performance)
const DEBUG_LEVELING_LOGS = false;
const DEBUG_HITSCAN_LOGS = false;
const DEBUG_KILL_REWARD_LOGS = false;
const PROC_COEFFICIENTS = UPGRADE_KNOBS.PROC_COEFFICIENTS || { default: 1.0 };

const PLAYER_COLOR_MIN_DISTANCE = 65;
const PROJECTILE_COLORS = [
	'#FF4500', // missiles
	'#FF9F1C', // explosive rounds
	'#00BFFF', // chain lightning
	'#8B0000', // bleed
	'#FF6600', // sticky charges
	'#00FFFF', // arc barrage
	'#00FF88'  // heatseeker drone hits
];

function parseColorToRgb(color) {
	if (!color) return null;
	if (color instanceof Color) {
		return parseColorToRgb(color.rgbString());
	}
	if (typeof color !== 'string') return null;
	if (color.startsWith('#')) {
		let hex = color.slice(1);
		if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
		if (hex.length !== 6) return null;
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
		return [r, g, b];
	}
	const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
	if (!match) return null;
	return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function colorDistance(a, b) {
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return Math.sqrt(dr * dr + dg * dg + db * db);
}

const FORBIDDEN_PLAYER_COLOR_RGBS = (() => {
	const colors = [];
	for (const type of DRONE_TYPES) {
		if (type.color) colors.push(type.color);
	}
	for (const data of Object.values(ENEMY_TYPES)) {
		if (data.color) colors.push(data.color);
		if (data.outline) colors.push(data.outline);
	}
	for (const data of Object.values(BOSS_TYPES)) {
		if (data.color) colors.push(data.color);
		if (data.outline) colors.push(data.outline);
	}
	colors.push(...PROJECTILE_COLORS);
	return colors.map(parseColorToRgb).filter(Boolean);
})();

function isPlayerColorTooSimilar(color) {
	const rgb = parseColorToRgb(color);
	if (!rgb) return false;
	for (const forbidden of FORBIDDEN_PLAYER_COLOR_RGBS) {
		if (colorDistance(rgb, forbidden) < PLAYER_COLOR_MIN_DISTANCE) {
			return true;
		}
	}
	return false;
}

function createEconomyDeltas() {
	return {
		coinSpawns: [],
		coinRemovals: [],
		coinUpdates: [],
		boostPickups: [],
		gameMessages: [],
		xpUpdates: [],
		levelUps: [],
		hitscanEvents: [],
		captureEvents: [],
		droneUpdates: [],
		killEvents: [],
		projectileSpawns: [],
		projectileUpdates: [],
		projectileRemovals: [],
		phaseShiftEvents: [],
		adrenalineEvents: [],
		momentumEvents: [],
		missileSpawns: [],
		missileUpdates: [],
		missileRemovals: [],
		stickyChargeDetonations: [],
		arcBarrageBursts: [],
		shockwaveEvents: [],
		enemySpawnWarnings: [],
		acidPoolSpawns: [],
		acidPoolUpdates: [],
		acidPoolRemovals: []
	};
}

function mergeEconomyDeltas(target, source) {
	target.coinSpawns.push(...source.coinSpawns);
	target.coinRemovals.push(...source.coinRemovals);
	target.coinUpdates.push(...source.coinUpdates);
	target.boostPickups.push(...source.boostPickups);
	target.gameMessages.push(...source.gameMessages);
	target.xpUpdates.push(...source.xpUpdates);
	target.levelUps.push(...source.levelUps);
	target.projectileSpawns.push(...source.projectileSpawns);
	target.projectileUpdates.push(...source.projectileUpdates);
	target.projectileRemovals.push(...source.projectileRemovals);
	target.hitscanEvents.push(...source.hitscanEvents);
	target.captureEvents.push(...source.captureEvents);
	target.droneUpdates.push(...source.droneUpdates);
	target.killEvents.push(...source.killEvents);
	target.phaseShiftEvents.push(...source.phaseShiftEvents);
	target.adrenalineEvents.push(...source.adrenalineEvents);
	target.momentumEvents.push(...source.momentumEvents);
	target.missileSpawns.push(...source.missileSpawns);
	target.missileUpdates.push(...source.missileUpdates);
	target.missileRemovals.push(...source.missileRemovals);
	target.stickyChargeDetonations.push(...source.stickyChargeDetonations);
	target.arcBarrageBursts.push(...source.arcBarrageBursts);
	target.shockwaveEvents.push(...source.shockwaveEvents);
	target.enemySpawnWarnings.push(...source.enemySpawnWarnings);
	target.acidPoolSpawns.push(...source.acidPoolSpawns);
	target.acidPoolUpdates.push(...source.acidPoolUpdates);
	target.acidPoolRemovals.push(...source.acidPoolRemovals);
}

function rollProcChance(baseChance, procCoefficient) {
	if (!baseChance || baseChance <= 0) return false;
	if (!procCoefficient || procCoefficient <= 0) return false;
	const chance = Math.min(1, baseChance * procCoefficient);
	return Math.random() < chance;
}

// ===== COLOR HELPER =====
// Convert HSL Color object to hex string
function colorToHex(color) {
	// HSL to RGB conversion
	const h = color.hue, s = color.sat, l = color.lum;
	let r, g, b;
	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1/6) return p + (q - p) * 6 * t;
			if (t < 1/2) return q;
			if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
			return p;
		};
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1/3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1/3);
	}
	// Convert to hex
	const toHex = (v) => {
		const hex = Math.round(v * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};
	return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ===== XP HELPER =====
// Calculate XP needed to reach the next level from current level
function getXpForLevel(level) {
	const base = consts.XP_BASE_PER_LEVEL || 50;
	const growth = consts.XP_GROWTH_RATE || 1.15;
	return Math.round(base * Math.pow(growth, level - 1));
}

// Calculate drone count based on level (1 drone at level 1, +1 at levels 4, 8, 12, etc.)
function getDroneCountForLevel(level) {
	const maxDrones = consts.MAX_DRONES || 50;
	const interval = consts.DRONE_LEVEL_INTERVAL || 4;
	// Formula: 1 drone at start, +1 drone at each interval (4, 8, 12, etc.)
	const count = 1 + Math.floor(level / interval);
	return Math.max(1, Math.min(maxDrones, count));
}

function getEnemyScalingMultiplier(runTimeSeconds, scaling) {
	if (!scaling || !scaling.enabled) return 1;
	const startTime = scaling.startTime || 0;
	const elapsed = Math.max(0, runTimeSeconds - startTime);
	const minutes = elapsed / 60;
	const perMinute = scaling.perMinute || 0;
	
	let exponent = scaling.exponent ?? 1.5;
	
	// Apply late-game ramp if configured
	const ramp = ENEMY_SCALING.lateGameRamp;
	if (ramp && ramp.enabled && minutes > ramp.startMinute) {
		const extra = (minutes - ramp.startMinute) * (ramp.exponentRampPerMinute || 0);
		exponent += extra;
	}
	
	const linearMult = 1 + minutes * perMinute;
	const mult = Math.pow(linearMult, exponent);
	let finalMult = mult;
	
	if (scaling.softCap !== undefined && finalMult > scaling.softCap) {
		const falloff = scaling.softCapFalloff ?? 0.5;
		finalMult = scaling.softCap + (finalMult - scaling.softCap) * falloff;
	}
	
	if (scaling.maxMult !== undefined) {
		return Math.min(scaling.maxMult, finalMult);
	}
	return finalMult;
}

function getPlayerMoveSpeed(player, runTime) {
	if (!player) return consts.SPEED || 4;
	const baseSpeed = player.speed || consts.SPEED || 4;
	const stats = player.derivedStats || {};
	let upgradeSpeedMult = stats.moveSpeedMult || 1.0;
	
	if ((player.adrenalineTimer || 0) > 0) {
		upgradeSpeedMult += UPGRADE_KNOBS.ADRENALINE.speedBonus;
	}
	if ((player.momentumStacks || 0) > 0) {
		upgradeSpeedMult += (player.momentumStacks * UPGRADE_KNOBS.MOMENTUM.speedPerSecond);
	}
	// Commando drone speed boost
	if (player.commandoSpeedBoostExpires && runTime !== undefined && runTime < player.commandoSpeedBoostExpires) {
		upgradeSpeedMult += (player.commandoSpeedBoost || 0.15);
	}
	
	const trailSpeedMult = player.currentSpeedBuff || 1.0;
	return baseSpeed * 60 * trailSpeedMult * upgradeSpeedMult;
}

// ===== DRONE SYSTEM =====

let nextDroneId = 0;

/**
 * Create a drone entity.
 * @param {number} ownerId - Player number who owns this drone
 * @param {number} orbitAngleOffset - Starting angle offset for orbit
 * @param {number} droneIndex - Index of this drone (0 = first drone, 1+ = additional)
 * @param {string} typeId - The drone type ID (defaults to 'assault')
 */
function createDrone(ownerId, orbitAngleOffset, droneIndex, typeId = 'assault') {
	// Get drone type for multipliers
	const droneType = getDroneType(typeId) || getDefaultDroneType();
	
	// Base stats from config
	const baseRange = consts.DRONE_RANGE || 200;
	const baseOrbitRadius = consts.DRONE_ORBIT_RADIUS || 55;
	
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
		range: baseRange * droneType.rangeMult,
		cooldownRemaining: 0,
		orbitRadius: baseOrbitRadius * droneType.orbitRadiusMult,
		orbitAngleOffset,           // Starting offset for this drone (evenly spaced)
		currentOrbitAngle: orbitAngleOffset,  // Current angle (animated)
		targetId: null,
		droneIndex: droneIndex,     // Track which drone this is for damage calculation
		// Drone type info
		typeId: droneType.id,
		typeName: droneType.name,
		typeColor: droneType.color,
		attackType: droneType.attackType || 'bullet',
		damageMult: droneType.damageMult,
		cooldownMult: droneType.cooldownMult,
		rangeMult: droneType.rangeMult,
		orbitRadiusMult: droneType.orbitRadiusMult,
		orbitSpeedMult: droneType.orbitSpeedMult,
		// Weapon properties
		isHitscan: droneType.isHitscan ?? false,
		projectileSpeed: droneType.projectileSpeed || 400,
		pierceCount: droneType.pierceCount || 0,
		projectileSize: droneType.projectileSize || 4
	};
}

/**
 * Rebuild drone array with evenly spaced orbit offsets.
 * Preserves cooldown of existing drones where possible.
 * First drone does full damage, additional drones do reduced damage.
 * Uses player.droneTypes array to determine type for each drone slot.
 */
function rebuildDronesArray(player, count) {
	const oldDrones = player.drones || [];
	const newDrones = [];
	
	// Ensure droneTypes array exists and has default for slot 0
	if (!player.droneTypes) {
		player.droneTypes = ['assault']; // First drone is always Assault by default
	}
	
	const baseDamage = consts.DRONE_DAMAGE || 10;
	const extraDamage = consts.DRONE_DAMAGE_EXTRA || 5;
	const baseRange = consts.DRONE_RANGE || 200;
	const baseOrbitRadius = consts.DRONE_ORBIT_RADIUS || 55;
	const usesPlayerDroneSlot = (player.droneTypes[0] || 'assault') === 'assault';
	const orbitingCount = Math.max(0, count - (usesPlayerDroneSlot ? 1 : 0));
	let orbitingIndex = 0;
	
	for (let i = 0; i < count; i++) {
		// First drone (index 0) does full damage, rest do reduced
		const damage = i === 0 ? baseDamage : extraDamage;
		
		// Get type for this slot (default to assault if not set)
		const typeId = player.droneTypes[i] || 'assault';
		const isPlayerDroneSlot = i === 0 && typeId === 'assault';
		const slotIndex = isPlayerDroneSlot ? null : orbitingIndex++;
		const offset = (orbitingCount > 0 && slotIndex !== null)
			? (slotIndex * Math.PI * 2) / orbitingCount
			: 0;
		const droneType = getDroneType(typeId) || getDefaultDroneType();
		const orbitRadius = isPlayerDroneSlot ? 0 : baseOrbitRadius * droneType.orbitRadiusMult;
		
		// Try to reuse existing drone data (preserve cooldown)
		if (i < oldDrones.length) {
			const old = oldDrones[i];
			old.orbitAngleOffset = offset;
			// Update current orbit angle to maintain smooth spacing
			old.currentOrbitAngle = offset;
			old.droneIndex = i;
			old.damage = damage;  // Update damage based on new position
			
			// Update type info (in case type was changed)
			old.typeId = droneType.id;
			old.typeName = droneType.name;
			old.typeColor = droneType.color;
			old.attackType = droneType.attackType || 'bullet';
			old.damageMult = droneType.damageMult;
			old.cooldownMult = droneType.cooldownMult;
			old.rangeMult = droneType.rangeMult;
			old.orbitRadiusMult = droneType.orbitRadiusMult;
			old.orbitSpeedMult = droneType.orbitSpeedMult;
			old.range = baseRange * droneType.rangeMult;
			old.orbitRadius = orbitRadius;
			// Weapon properties
			old.isHitscan = droneType.isHitscan ?? false;
			old.projectileSpeed = droneType.projectileSpeed || 400;
			old.pierceCount = droneType.pierceCount || 0;
			old.projectileSize = droneType.projectileSize || 4;
			
			newDrones.push(old);
		} else {
			// Create new drone with proper index and type
			const newDrone = createDrone(player.num, offset, i, typeId);
			newDrone.orbitRadius = orbitRadius;
			newDrones.push(newDrone);
		}
	}
	
	player.drones = newDrones;
	player.droneCount = count;

	// IMPORTANT: newly created drones start at (0,0). If we send a frame before the next
	// orbit update, clients will see a one-frame "blip" at the map origin. Initialize
	// positions immediately so drones always spawn at the correct orbit location.
	updateDronePositions(player, 0);
	
	// Debug: verify drones are created with valid positions
	if (newDrones.length > 0) {
		console.log(`[DRONE] Created ${newDrones.length} drones for player at (${player.x?.toFixed(0)}, ${player.y?.toFixed(0)})`);
		for (const d of newDrones) {
			console.log(`  - Drone ${d.id}: type=${d.typeId}, pos=(${d.x?.toFixed(0)}, ${d.y?.toFixed(0)})`);
		}
	}
}

/**
 * Update drone positions to orbit around player.
 * @param {Object} player - The player whose drones to update
 * @param {number} deltaSeconds - Time elapsed since last update
 */
function updateDronePositions(player, deltaSeconds) {
	if (!player.drones) return;
	
	const baseOrbitSpeed = consts.DRONE_ORBIT_SPEED || 1.5; // radians per second
	const playerSizeScale = player.sizeScale || 1.0;
	
	for (const drone of player.drones) {
		// Apply drone type's orbit speed multiplier
		const orbitSpeed = baseOrbitSpeed * (drone.orbitSpeedMult || 1.0);
		
		// Continuously rotate the drone's orbit angle
		drone.currentOrbitAngle += orbitSpeed * deltaSeconds;
		
		// Keep angle in [0, 2*PI] range to prevent floating point issues
		if (drone.currentOrbitAngle > Math.PI * 2) {
			drone.currentOrbitAngle -= Math.PI * 2;
		}
		
		// Scale orbit radius with player size
		const scaledOrbitRadius = drone.orbitRadius * playerSizeScale;
		
		// Calculate position based on player center and current orbit angle
		drone.x = player.x + Math.cos(drone.currentOrbitAngle) * scaledOrbitRadius;
		drone.y = player.y + Math.sin(drone.currentOrbitAngle) * scaledOrbitRadius;
		drone.ownerId = player.num;
		drone.ownerSizeScale = playerSizeScale; // Pass size scale to client for rendering
	}
}

function Game(id) {
	let possColors = Color.possColors();
	const filteredColors = possColors.filter(color => !isPlayerColorTooSimilar(color));
	if (filteredColors.length > 0) {
		possColors = filteredColors;
	}
	let nextInd = 0;
	const players = [];
	let frame = 0;
	let simFrame = 0;
	let pendingDeltas = createEconomyDeltas();
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// ===== PROJECTILE SYSTEM (variables) =====
	const projectiles = [];
	const pendingProjectileSpawns = [];
	let nextProjectileId = 1;
	// NOTE: createProjectile() and updateProjectiles() are defined below after handleEnemyDeath
	
	// ===== HEAL PACK SYSTEM (Support drone passive) =====
	const healPacks = [];
	let nextHealPackId = 1;
	
	// ===== ACID POOL SYSTEM (Acid drone passive) =====
	const acidPools = [];
	let nextAcidPoolId = 1;
	
	// ===== ASSAULT RAMP DAMAGE TRACKING =====
	// Map: ownerId -> Map<enemyId -> { stacks, lastHitTime }>
	const assaultRampStacks = new Map();
	
	// ===== FOCUSED FIRE TRACKING =====
	// Map: ownerId -> { targetId, stacks, lastHitTime }
	const focusedFireStacks = new Map();
	
	// ===== STICKY CHARGES SYSTEM =====
	// Array of { enemyId, ownerId, charges, detonationTime, baseDamage }
	const stickyCharges = [];
	
	// ===== MISSILE POD SYSTEM =====
	// Array of { x, y, vx, vy, ownerId, damage, lifetime, targetId }
	const missiles = [];
	let nextMissileId = 1;
	
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
	let timeSpeedMultiplier = 1; // Dev tool: speeds up runTime without affecting simulation
	const enemyLifetimeSeconds = consts.ENEMY_LIFETIME_SECONDS ?? 15;
	const enemyDespawnDistance = consts.ENEMY_DESPAWN_DISTANCE
		?? ((consts.AOI_MIN_RADIUS ?? 400) + (consts.AOI_BUFFER ?? 900));
	const spawnWarningLeadSeconds = consts.ENEMY_SPAWN_WARNING_LEAD_SECONDS ?? 2.0;
	const spawnGraceSeconds = consts.ENEMY_SPAWN_GRACE_SECONDS ?? 1.0;
	const pendingEnemySpawns = [];

	function markEnemyHit(enemy) {
		if (!enemy || enemy.isBoss) return;
		enemy.lastDamagedAt = runTime;
	}

	function applyBleedStacks(target, ownerId, bleedConfig) {
		if (!target || !bleedConfig) return;
		if (!target.bleedStacks) target.bleedStacks = 0;
		if (!target.bleedExpires) target.bleedExpires = 0;

		const damagePerStack = bleedConfig.damagePerStack ?? bleedConfig.bleedDamagePerStack ?? 1;
		const durationSeconds = bleedConfig.durationSeconds ?? bleedConfig.bleedDuration ?? 2.0;
		const maxStacks = bleedConfig.maxBleedStacks ?? bleedConfig.bleedMaxStacks ?? 10;
		const stackIncrement = bleedConfig.stackIncrement ?? 1;
		const maxAllowedStacks = Math.max(target.bleedMaxStacks || 0, maxStacks);

		target.bleedStacks = Math.min(target.bleedStacks + stackIncrement, maxAllowedStacks);
		target.bleedExpires = Math.max(target.bleedExpires || 0, runTime + durationSeconds);
		target.bleedDamagePerStack = Math.max(target.bleedDamagePerStack || 0, damagePerStack);
		target.bleedMaxStacks = maxAllowedStacks;
		if (ownerId !== undefined && ownerId !== null) {
			target.bleedOwnerId = ownerId;
		}
	}

	function applyBurnStacks(target, ownerId, burnConfig) {
		if (!target || !burnConfig) return;
		if (!target.burnStacks) target.burnStacks = 0;
		if (!target.burnExpires) target.burnExpires = 0;

		const damagePerStack = burnConfig.damagePerStack ?? burnConfig.burnDamagePerStack ?? 1;
		const durationSeconds = burnConfig.durationSeconds ?? burnConfig.burnDuration ?? 2.0;
		const maxStacks = burnConfig.maxBurnStacks ?? burnConfig.burnMaxStacks ?? 10;
		const stackIncrement = burnConfig.stackIncrement ?? 1;
		const maxAllowedStacks = Math.max(target.burnMaxStacks || 0, maxStacks);

		target.burnStacks = Math.min(target.burnStacks + stackIncrement, maxAllowedStacks);
		target.burnExpires = Math.max(target.burnExpires || 0, runTime + durationSeconds);
		target.burnDamagePerStack = Math.max(target.burnDamagePerStack || 0, damagePerStack);
		target.burnMaxStacks = maxAllowedStacks;
		if (ownerId !== undefined && ownerId !== null) {
			target.burnOwnerId = ownerId;
		}
	}

	function applyPoisonStacks(target, ownerId, poisonConfig) {
		if (!target || !poisonConfig) return;
		if (!target.poisonStacks) target.poisonStacks = 0;
		if (!target.poisonExpires) target.poisonExpires = 0;

		const damagePerStack = poisonConfig.damagePerStack ?? poisonConfig.poisonDamagePerStack ?? 3;
		const durationSeconds = poisonConfig.durationSeconds ?? poisonConfig.poisonDuration ?? 3.0;
		const maxStacks = poisonConfig.maxPoisonStacks ?? poisonConfig.poisonMaxStacks ?? 5;
		const stackIncrement = poisonConfig.stackIncrement ?? 1;
		const maxAllowedStacks = Math.max(target.poisonMaxStacks || 0, maxStacks);

		target.poisonStacks = Math.min(target.poisonStacks + stackIncrement, maxAllowedStacks);
		target.poisonExpires = Math.max(target.poisonExpires || 0, runTime + durationSeconds);
		target.poisonDamagePerStack = Math.max(target.poisonDamagePerStack || 0, damagePerStack);
		target.poisonMaxStacks = maxAllowedStacks;
		if (ownerId !== undefined && ownerId !== null) {
			target.poisonOwnerId = ownerId;
		}
	}

	function applyStun(target, duration) {
		if (!target) return;
		const stunDuration = duration ?? consts.STUN_DURATION_DEFAULT ?? 1.0;
		target.stunExpires = Math.max(target.stunExpires || 0, runTime + stunDuration);
	}

	function applyEnemyScaling(enemy) {
		if (!enemy) return;
		const hpScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.hp);
		const damageScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.damage);
		const speedScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.speed);
		const baseMaxHp = enemy.baseMaxHp ?? enemy.maxHp ?? 1;
		const baseDamage = enemy.baseContactDamage ?? enemy.contactDamage ?? 0;
		const baseSpeed = enemy.baseSpeed ?? enemy.speed ?? 0;
		const newMaxHp = Math.max(1, baseMaxHp * hpScale);
		if (enemy.maxHp !== newMaxHp) {
			const hpRatio = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) : 1;
			enemy.maxHp = newMaxHp;
			enemy.hp = Math.max(0, Math.min(newMaxHp, hpRatio * newMaxHp));
		}
		enemy.contactDamage = baseDamage * damageScale;
		enemy.speed = baseSpeed * speedScale;
		if (enemy.baseSpeed === undefined) {
			enemy.baseSpeed = baseSpeed;
		}
	}

	function spawnSwarmEnemyAt(x, y) {
		return queueEnemySpawn('swarm', x, y);
	}

	function queueEnemySpawn(typeName, x, y, isBoss = false) {
		pendingEnemySpawns.push({
			typeName,
			x,
			y,
			isBoss,
			spawnAt: runTime + spawnWarningLeadSeconds
		});
		return true;
	}

	function spawnEnemyOfType(typeName, x, y) {
		const maxPerType = ENEMY_SPAWN_LIMITS.maxPerType;
		const currentCount = enemies.filter(e => !e.isBoss && e.type === typeName).length;
		if (currentCount >= maxPerType) return null;
		const typeData = (ENEMY_TYPES[typeName] || ENEMY_TYPES.basic);
		if (typeName === 'sniper') {
			const maxCount = typeData.maxCount ?? 5;
			if (currentCount >= maxCount) {
				return null;
			}
		}
		const hpScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.hp);
		const damageScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.damage);
		const maxHp = Math.max(1, typeData.maxHp * hpScale);
		const contactDamage = typeData.contactDamage * damageScale;
		const xpDropValue = typeData.xpDropValue ?? ENEMY_XP_DROP.defaultValue;
		
		const enemy = new Enemy({
			id: `enemy-${nextEnemyId++}`,
			x,
			y,
			type: typeName,
			radius: typeData.radius,
			maxHp: maxHp,
			hp: maxHp,
			speed: typeData.speed,
			contactDamage: contactDamage,
			xpDropValue: xpDropValue
		});
		enemy.baseMaxHp = typeData.maxHp;
		enemy.baseContactDamage = typeData.contactDamage;
		enemy.baseSpeed = typeData.speed;
		enemy.spawnTime = runTime;
		enemy.lastDamagedAt = runTime;
		enemy.spawnGraceUntil = runTime + spawnGraceSeconds;
		
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
			enemy.healRadius = typeData.healRadius;
			enemy.healAmount = typeData.healAmount;
			enemy.healCooldown = typeData.healCooldown;
			enemy.healPercent = typeData.healPercent;
			enemy.lastHealAt = 0;
		} else if (typeName === 'tank') {
			enemy.swarmBurstCount = typeData.swarmBurstCount;
			enemy.swarmBurstCooldown = typeData.swarmBurstCooldown;
			enemy.swarmBurstSpread = typeData.swarmBurstSpread;
			enemy.lastSwarmBurst = 0;
		}
		
		enemies.push(enemy);
		return enemy;
	}

	function spawnBossOfType(bossType, x, y) {
		const bossData = BOSS_TYPES[bossType] || BOSS_TYPES.titan;
		const hpScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.hp);
		const damageScale = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.damage);
		const maxHp = Math.max(1, bossData.maxHp * hpScale);
		const contactDamage = bossData.contactDamage * damageScale;
		const xpDropValue = bossData.xpDropValue ?? ENEMY_XP_DROP.defaultValue;
		
		const boss = new Enemy({
			id: `boss-${bossType}-${nextEnemyId++}`,
			x,
			y,
			type: bossType,
			radius: bossData.radius,
			maxHp: maxHp,
			hp: maxHp,
			speed: bossData.speed,
			contactDamage: contactDamage,
			xpDropValue: xpDropValue
		});
		boss.baseMaxHp = bossData.maxHp;
		boss.baseContactDamage = bossData.contactDamage;
		boss.baseSpeed = bossData.speed;
		boss.spawnTime = runTime;
		boss.spawnGraceUntil = runTime + spawnGraceSeconds;
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
		} else if (bossType === 'titan') {
			boss.chargeSpeed = bossData.chargeSpeed;
			boss.chargeCooldown = bossData.chargeCooldown;
			boss.chargeDistance = bossData.chargeDistance;
			boss.lastChargeTime = 0;
			boss.isCharging = false;
			boss.chargeTargetX = 0;
			boss.chargeTargetY = 0;
		}
		
		enemies.push(boss);
		return boss;
	}

	function processPendingEnemySpawns(economyDeltas) {
		for (let i = pendingEnemySpawns.length - 1; i >= 0; i--) {
			const pending = pendingEnemySpawns[i];
			const timeRemaining = pending.spawnAt - runTime;
			if (timeRemaining <= 0) {
				if (pending.isBoss) {
					const currentBossCount = enemies.filter(e => e.isBoss && e.type === pending.typeName).length;
					if (currentBossCount < ENEMY_SPAWN_LIMITS.maxPerType) {
						spawnBossOfType(pending.typeName, pending.x, pending.y);
						economyDeltas.gameMessages.push({
							text: "SwarmBlitz!",
							duration: 2.5
						});
					}
				} else {
					spawnEnemyOfType(pending.typeName, pending.x, pending.y);
				}
				pendingEnemySpawns.splice(i, 1);
				continue;
			}
			
			const typeData = pending.isBoss
				? (BOSS_TYPES[pending.typeName] || BOSS_TYPES.titan)
				: (ENEMY_TYPES[pending.typeName] || ENEMY_TYPES.basic);
			economyDeltas.enemySpawnWarnings.push({
				x: pending.x,
				y: pending.y,
				radius: typeData.radius || 12,
				timeRemaining
			});
		}
	}

	function applyEnemyDamageToPlayer(player, enemy, baseDamage, deltas, deadList) {
		if (!player || !enemy || baseDamage <= 0) return 0;
		let damage = baseDamage;
		
		const inTerritory = player.territory && player.territory.length >= 3 &&
			pointInPolygon({ x: player.x, y: player.y }, player.territory);
		if (inTerritory) {
			const reduction = consts.TERRITORY_DAMAGE_REDUCTION ?? 0.5;
			damage *= (1 - reduction);
		}
		
		const playerStats = player.derivedStats || {};
		
		if (playerStats.hasPhaseShift) {
			if (player.phaseShiftCooldown === undefined) player.phaseShiftCooldown = 0;
			if (player.phaseShiftCooldown <= 0) {
				player.phaseShiftCooldown = UPGRADE_KNOBS.PHASE_SHIFT.cooldownSeconds;
				deltas.phaseShiftEvents.push({
					playerNum: player.num,
					x: player.x,
					y: player.y
				});
				enemy.lastHitAt = runTime;
				return 0;
			}
		}
		
		if (playerStats.hasLastStand && player.hp < player.maxHp * UPGRADE_KNOBS.LAST_STAND.hpThreshold) {
			damage *= (1 - UPGRADE_KNOBS.LAST_STAND.damageReduction);
		}
		
		const damageReduction = playerStats.damageReduction || 0;
		damage *= (1 - damageReduction);
		
		const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
		const hpPerLevel = consts.HP_PER_LEVEL || 10;
		const level = player.level || 1;
		const levelBonusHp = (level - 1) * hpPerLevel;
		const flatMaxHp = playerStats.flatMaxHp || 0;
		const maxHpMult = playerStats.maxHpMult || 1.0;
		player.maxHp = (baseMaxHp + levelBonusHp + flatMaxHp) * maxHpMult;
		
		player.hp -= damage;
		if (player.hp < 0) player.hp = 0;
		enemy.lastHitAt = runTime;
		
		if (playerStats.thornsMult > 0) {
			const reflectDamage = damage * playerStats.thornsMult;
			enemy.hp -= reflectDamage;
			markEnemyHit(enemy);
			if (enemy.hp <= 0) {
				handleEnemyDeath(enemy, player);
			}
		}
		
		if (playerStats.hasAdrenaline) {
			const wasActive = player.adrenalineTimer > 0;
			player.adrenalineTimer = UPGRADE_KNOBS.ADRENALINE.durationSeconds;
			if (!wasActive) {
				deltas.adrenalineEvents.push({
					playerNum: player.num,
					duration: UPGRADE_KNOBS.ADRENALINE.durationSeconds
				});
			}
		}
		
		if (player.hp <= 0 && !player.dead) {
			player.die();
			if (deadList) deadList.push(player);
			deltas.killEvents.push({
				killerNum: -1,
				victimNum: player.num,
				victimName: player.name || "Player",
				killType: "enemy"
			});
		}
		
		return damage;
	}
	
	// Upgrade system pause state
	let gamePaused = false;
	let pendingUpgradeOffer = null; // { playerNum, choices: [...] }
	let pendingDroneOffer = null;   // { playerNum, droneIndex, choices: [...] }

	this.id = id;
	
	// Reset game state for new run (called when player joins/restarts)
	function resetGameState() {
		// Clear projectiles
		projectiles.length = 0;
		pendingProjectileSpawns.length = 0;
		nextProjectileId = 1;
		
		// Clear all enemies
		enemies.length = 0;
		nextEnemyId = 0;
		pendingEnemySpawns.length = 0;
		
		// Clear all coins/XP pickups
		coins.length = 0;
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
		pendingDroneOffer = null;
		
		// Clear new upgrade systems
		focusedFireStacks.clear();
		stickyCharges.length = 0;
		missiles.length = 0;
		nextMissileId = 1;
		
		console.log(`[${new Date()}] Game state reset for new run.`);
	}
	
	this.addPlayer = (client, name) => {
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
		
		// Initialize upgrade system
		initPlayerUpgrades(p);
		
		players.push(p);
		nextInd++;
		initPlayer(p);
		p._territoryDirty = true;
		
		// Drone system - drones scale with level interval (start with 1)
		// First drone is always Assault type by default
		// NOTE: Must be AFTER initPlayer so player has a valid position for drone orbit calculation
		p.droneTypes = ['assault'];
		p.droneCount = getDroneCountForLevel(p.level);
		p.drones = [];
		rebuildDronesArray(p, p.droneCount);
		
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
		data.droneTypes = player.droneTypes || ['assault'];
		data.drones = (player.drones || []).map(d => ({
			id: d.id,
			ownerId: d.ownerId,
			x: d.x,
			y: d.y,
			hp: d.hp,
			maxHp: d.maxHp,
			targetId: d.targetId,
			// Drone type info
			typeId: d.typeId || 'assault',
			typeName: d.typeName || 'Assault',
			typeColor: d.typeColor || '#FF6B6B',
			attackType: d.attackType || 'bullet'
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
		if (enemy.type === 'sniper') {
			data.healRadius = enemy.healRadius;
		}
		if (enemy.healGlowUntil) {
			data.healGlowUntil = enemy.healGlowUntil;
		}
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

	function getEnemyStats() {
		const bossCount = enemies.filter(e => e.isBoss).length;
		const hpMult = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.hp);
		const dmgMult = getEnemyScalingMultiplier(runTime, ENEMY_SCALING.damage);
		const basicEnemyBaseHp = ENEMY_TYPES.basic?.maxHp || 30;
		
		// Calculate territory XP multiplier for debug display
		// Use first active player's level or default to level 1
		const activePlayer = players.find(p => !p.dead);
		const sampleLevel = activePlayer ? (activePlayer.level || 1) : 1;
		const xpNeeded = getXpForLevel(sampleLevel);
		const baseXpNeeded = getXpForLevel(1);
		const levelRatio = baseXpNeeded > 0 ? (xpNeeded / baseXpNeeded) : 1;
		// Freeze at cap time value (matches actual calculation)
		const scaleCapMin = consts.TERRITORY_XP_SCALE_CAP_MIN ?? 5;
		const minutes = runTime / 60;
		let levelScale;
		if (scaleCapMin > 0 && minutes >= scaleCapMin && activePlayer?._frozenTerritoryScale !== undefined) {
			levelScale = activePlayer._frozenTerritoryScale;
		} else {
			levelScale = Math.sqrt(levelRatio);
		}
		const territoryXpScale = consts.TERRITORY_XP_SCALE ?? 1.0;
		const territoryXpMult = levelScale * territoryXpScale;
		
		return {
			runTime,
			spawnInterval: enemySpawner.spawnInterval,
			enemies: enemies.length,
			kills: enemyKills,
			unlockedTypes: enemySpawner.getUnlockedTypes(),
			bossCount,
			bossInterval: enemySpawner.getBossInterval(),
			nextBossIn: Math.max(0, enemySpawner.nextBossAt - runTime),
			// Scaling debug info
			hpMult,
			dmgMult,
			territoryXpMult,
			timeSpeed: timeSpeedMultiplier,
			sampleSpawnHp: Math.round(basicEnemyBaseHp * hpMult)
		};
	}
	
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
		
		// Clear the pending upgrade offer
		pendingUpgradeOffer = null;
		
		// Check if there's a pending drone unlock - if so, show drone choice
		if (checkPendingDroneUnlock(player)) {
			// Game stays paused, drone offer sent
			player._forceXpUpdate = true;
			return { ok: true, upgradeId, newStacks, pendingDroneChoice: true };
		}
		
		// No pending drone - resume game
		gamePaused = false;
		
		// Force an XP update to sync derived stats
		player._forceXpUpdate = true;
		
		return { ok: true, upgradeId, newStacks };
	};
	
	this.handleDronePick = (player, droneTypeId) => {
		// Validate that this player has a pending drone offer
		if (!gamePaused || !pendingDroneOffer || pendingDroneOffer.playerNum !== player.num) {
			console.warn(`[DRONE] Invalid drone pick from ${player.name} - no pending offer`);
			return { ok: false, error: "No pending drone offer." };
		}
		
		// Validate that the drone type is one of the offered choices
		const validChoice = pendingDroneOffer.choices.find(c => c.id === droneTypeId);
		if (!validChoice) {
			console.warn(`[DRONE] Invalid drone pick from ${player.name} - ${droneTypeId} not in choices`);
			return { ok: false, error: "Invalid drone type selection." };
		}
		
		const newDroneIndex = pendingDroneOffer.droneIndex;
		
		// Add the chosen type to player's droneTypes array
		if (!player.droneTypes) {
			player.droneTypes = ['assault'];
		}
		// Ensure array is long enough
		while (player.droneTypes.length <= newDroneIndex) {
			player.droneTypes.push('assault'); // Fill gaps with assault
		}
		player.droneTypes[newDroneIndex] = droneTypeId;
		
		// Now actually add the drone
		player.droneCount = player._pendingDroneUnlock;
		player._pendingDroneUnlock = null;
		rebuildDronesArray(player, player.droneCount);
		
		if (DEBUG_LEVELING_LOGS) {
			console.log(`[DRONE] ${player.name} selected ${validChoice.name} drone for slot ${newDroneIndex}`);
		}
		
		// Clear the pending offer and resume game
		pendingDroneOffer = null;
		gamePaused = false;
		
		// Force an XP update to sync new drone
		player._forceXpUpdate = true;
		
		return { ok: true, droneTypeId, droneIndex: newDroneIndex };
	};
	
	// Handle pause request from client (for settings menu)
	this.handlePause = (player, paused) => {
		// Only allow pause if no upgrade/drone selection is pending
		if (pendingUpgradeOffer || pendingDroneOffer) {
			return; // Can't override upgrade/drone selection pause
		}
		gamePaused = !!paused;
	};
	
	// Handle dev commands for testing/debugging
	this.handleDevCommand = (player, payload) => {
		if (!payload || !payload.cmd) return;
		
		const cmd = payload.cmd;
		console.log(`[DEV] Player ${player.name} executed: ${cmd}`, payload);
		
		switch (cmd) {
			case 'giveXP': {
				// Give XP to the player
				const amount = parseInt(payload.amount) || 100;
				player.xp = (player.xp || 0) + amount;
				
				// Check for level ups
				let xpNeeded = getXpForLevel(player.level || 1);
				while (player.xp >= xpNeeded) {
					player.xp -= xpNeeded;
					player.level = (player.level || 1) + 1;
					player.updateSizeScale();
					
					// Add a drone for the new level
					if (!player.droneTypes) player.droneTypes = ['assault'];
					rebuildDronesArray(player, player.level);
					
					console.log(`[DEV] ${player.name} leveled up to ${player.level}!`);
					xpNeeded = getXpForLevel(player.level);
				}
				// Force client update
				player._forceXpUpdate = true;
				break;
			}
			
			case 'setLevel': {
				// Set player level directly
				const level = Math.max(1, parseInt(payload.level) || 1);
				player.level = level;
				player.xp = 0;
				player.updateSizeScale();
				
				// Recalculate max HP based on level (base HP + 10 per level above 1)
				const baseMaxHp = consts.PLAYER_MAX_HP || 100;
				const hpPerLevel = consts.HP_PER_LEVEL || 10;
				const stats = player.derivedStats || {};
				const flatMaxHp = stats.flatMaxHp || 0;
				const maxHpMult = stats.maxHpMult || 1.0;
				player.maxHp = ((baseMaxHp + (level - 1) * hpPerLevel) + flatMaxHp) * maxHpMult;
				player.hp = player.maxHp; // Full heal on level set
				
				// Rebuild drones for new level
				if (!player.droneTypes) player.droneTypes = ['assault'];
				rebuildDronesArray(player, player.level);
				
				// Force client update
				player._forceXpUpdate = true;
				console.log(`[DEV] ${player.name} set to level ${level} (maxHp: ${player.maxHp})`);
				break;
			}
			
			case 'giveUpgrade': {
				// Give a specific upgrade
				const upgradeId = payload.upgradeId;
				if (upgradeId) {
					const newStacks = selectUpgrade(player, upgradeId);
					// Force client update (upgrades affect derived stats which affect HP/etc)
					player._forceXpUpdate = true;
					console.log(`[DEV] ${player.name} got upgrade ${upgradeId} (now ${newStacks} stacks)`);
				}
				break;
			}
			
			case 'heal': {
				// Full heal - recalculate max HP based on level
				const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
				const hpPerLevel = consts.HP_PER_LEVEL || 10;
				const stats = player.derivedStats || {};
				const flatMaxHp = stats.flatMaxHp || 0;
				const maxHpMult = stats.maxHpMult || 1.0;
				const level = player.level || 1;
				player.maxHp = ((baseMaxHp + (level - 1) * hpPerLevel) + flatMaxHp) * maxHpMult;
				player.hp = player.maxHp;
				player.stamina = player.maxStamina || 100;
				player.isExhausted = false;
				player.exhaustedTime = 0;
				// Force client update
				player._forceXpUpdate = true;
				console.log(`[DEV] ${player.name} healed to full (maxHp: ${player.maxHp})`);
				break;
			}
			
			case 'godMode': {
				// Toggle god mode (massive HP)
				player.godMode = !player.godMode;
				if (player.godMode) {
					player.hp = 999999;
					player.maxHp = 999999;
					player.stamina = 999999;
					player.maxStamina = 999999;
				} else {
					// Reset to normal - recalculate based on level
					recalculateDerivedStats(player);
					const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
					const hpPerLevel = consts.HP_PER_LEVEL || 10;
					const level = player.level || 1;
					const stats = player.derivedStats || {};
					player.maxHp = ((baseMaxHp + (level - 1) * hpPerLevel) + (stats.flatMaxHp || 0)) * (stats.maxHpMult || 1.0);
					player.hp = Math.min(player.hp, player.maxHp);
					const baseMaxStamina = consts.PLAYER_MAX_STAMINA || 100;
					const flatMaxStamina = stats.flatMaxStamina || 0;
					player.maxStamina = (baseMaxStamina * (stats.maxStaminaMult || 1.0)) + flatMaxStamina;
					player.stamina = Math.min(player.stamina, player.maxStamina);
				}
				// Force client update
				player._forceXpUpdate = true;
				console.log(`[DEV] ${player.name} god mode: ${player.godMode}`);
				break;
			}
			
			case 'addDrone': {
				// Add a drone of the specified type
				const droneTypeId = payload.droneTypeId || 'assault';
				const droneType = getDroneType(droneTypeId);
				if (!droneType) {
					console.warn(`[DEV] Unknown drone type: ${droneTypeId}`);
					break;
				}
				
				// Add to player's drone types array
				if (!player.droneTypes) player.droneTypes = [];
				player.droneTypes.push(droneTypeId);
				
				// Rebuild drones with the new count
				const newCount = player.droneTypes.length;
				player.droneCount = newCount;
				rebuildDronesArray(player, newCount);
				
				// Force client update
				player._forceXpUpdate = true;
				console.log(`[DEV] ${player.name} added drone: ${droneType.name} (now ${newCount} drones)`);
				break;
			}
			
			case 'clearDrones': {
				// Clear all drones except the first one
				player.droneTypes = ['assault']; // Reset to default
				player.droneCount = 1;
				rebuildDronesArray(player, 1);
				
				// Force client update
				player._forceXpUpdate = true;
				console.log(`[DEV] ${player.name} cleared all drones`);
				break;
			}
			
			case 'setTimeSpeed': {
				// Set the time speed multiplier (affects runTime for enemy scaling/spawning, not simulation)
				const multiplier = parseFloat(payload.multiplier);
				if (isFinite(multiplier) && multiplier >= 0.25 && multiplier <= 20) {
					timeSpeedMultiplier = multiplier;
					console.log(`[DEV] ${player.name} set time speed to ${multiplier}x`);
				} else {
					console.warn(`[DEV] Invalid time speed multiplier: ${payload.multiplier}`);
				}
				break;
			}
			
			case 'spawnEnemy': {
				const typeName = payload.type || 'basic';
				const count = Math.max(1, Math.min(50, parseInt(payload.count, 10) || 1));
				const spawnRadiusMin = 80;
				const spawnRadiusMax = 140;
				
				for (let i = 0; i < count; i++) {
					const angle = Math.random() * Math.PI * 2;
					const radius = spawnRadiusMin + Math.random() * (spawnRadiusMax - spawnRadiusMin);
					const x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, player.x + Math.cos(angle) * radius));
					const y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, player.y + Math.sin(angle) * radius));
					queueEnemySpawn(typeName, x, y);
				}
				break;
			}
		}
	};
	
	// Expose pause state for external queries
	this.isPaused = () => gamePaused;

	this.sendFullState = player => {
		if (!player || !player.client) return;
		player.frame = frame;

		const splayers = [serializePlayer(player, player.num)];
		const senemies = enemies.map(serializeEnemy);
		player.client.sendPacket(MSG.INIT, {
			"num": player.num,
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
		
		// Stamina boost spawning (near player, outside territory)
		coinSpawnCooldown -= deltaSeconds;
		const activePlayer = players.find(p => !p.dead && !p.disconnected) || null;
		// Count only stamina/heal boost orbs (not enemy XP orbs)
		const boostOrbCount = coins.filter(c => c.type === "stamina" || c.type === "heal").length;
		const maxBoostOrbs = consts.MAX_BOOST_ORBS ?? 15;
		if (coinSpawnCooldown <= 0 && boostOrbCount < maxBoostOrbs && activePlayer) {
			// Try to spawn stamina boost near player but outside their territory
			const spawnRadius = consts.BOOST_SPAWN_RADIUS || 300;
			const minDist = consts.BOOST_SPAWN_MIN_DIST || 100;
			let spawnX = null, spawnY = null;
			
			for (let attempt = 0; attempt < 10; attempt++) {
				const angle = Math.random() * Math.PI * 2;
				const dist = minDist + Math.random() * (spawnRadius - minDist);
				const tryX = activePlayer.x + Math.cos(angle) * dist;
				const tryY = activePlayer.y + Math.sin(angle) * dist;
				
				// Clamp to map bounds
				const x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, tryX));
				const y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, tryY));
				
				// Check if outside player's territory
				const inPlayerTerritory = activePlayer.territory && activePlayer.territory.length >= 3 &&
					pointInPolygon({ x, y }, activePlayer.territory);
				
				if (!inPlayerTerritory) {
					spawnX = x;
					spawnY = y;
					break;
				}
			}
			
			if (spawnX !== null && spawnY !== null) {
				const newCoin = {
					id: nextCoinId++,
					x: spawnX,
					y: spawnY,
					type: "stamina",
					value: consts.STAMINA_BOOST_AMOUNT || 20,
					spawnTime: runTime
				};
				coins.push(newCoin);
				economyDeltas.coinSpawns.push(newCoin);
			}
			coinSpawnCooldown = consts.BOOST_SPAWN_INTERVAL_SEC ?? 3.0;
		}
		
		const droneUpdateEveryTicks = consts.DRONE_UPDATE_EVERY_TICKS ?? 5;
		const shouldSendDroneUpdates = simFrame % droneUpdateEveryTicks === 0;
		
		// Run game simulation
		update(economyDeltas, deltaSeconds, shouldSendDroneUpdates);
		
		mergeEconomyDeltas(pendingDeltas, economyDeltas);
		simFrame++;
	}
	
	function flushFrame() {
		// Singleplayer update packets (no AOI filtering)
		for (const p of players) {
			if (p.disconnected || p.dead) continue;

			const moves = [{
				num: p.num,
				left: !!p.disconnected || p.dead,
				targetAngle: p.targetAngle,
				x: p.x,
				y: p.y
			}];

			const data = {
				frame: frame + 1,
				moves
			};

			if (pendingDeltas.coinSpawns.length > 0) data.coinSpawns = pendingDeltas.coinSpawns;
			if (pendingDeltas.coinRemovals.length > 0) data.coinRemovals = pendingDeltas.coinRemovals;
			if (pendingDeltas.coinUpdates.length > 0) data.coinUpdates = pendingDeltas.coinUpdates;
			if (pendingDeltas.boostPickups.length > 0) data.boostPickups = pendingDeltas.boostPickups;
			if (pendingDeltas.gameMessages.length > 0) data.gameMessages = pendingDeltas.gameMessages;
			if (pendingDeltas.xpUpdates.length > 0) data.xpUpdates = pendingDeltas.xpUpdates;
			if (pendingDeltas.levelUps.length > 0) data.levelUps = pendingDeltas.levelUps;
			if (pendingDeltas.hitscanEvents.length > 0) data.hitscanEvents = pendingDeltas.hitscanEvents;
			if (pendingDeltas.captureEvents.length > 0) data.captureEvents = pendingDeltas.captureEvents;
			if (pendingDeltas.droneUpdates.length > 0) data.droneUpdates = pendingDeltas.droneUpdates;
			if (pendingDeltas.killEvents.length > 0) data.killEvents = pendingDeltas.killEvents;
			data.enemySpawnWarnings = pendingDeltas.enemySpawnWarnings;
			// Projectile data for client-side rendering of traveling projectiles
			if (pendingDeltas.projectileSpawns.length > 0) data.projectileSpawns = pendingDeltas.projectileSpawns;
			if (pendingDeltas.projectileUpdates.length > 0) data.projectileUpdates = pendingDeltas.projectileUpdates;
			if (pendingDeltas.projectileRemovals.length > 0) data.projectileRemovals = pendingDeltas.projectileRemovals;
			
			// Heal pack data (Support drone passive)
			if (pendingDeltas.healPackSpawns && pendingDeltas.healPackSpawns.length > 0) data.healPackSpawns = pendingDeltas.healPackSpawns;
			if (pendingDeltas.healPackUpdates && pendingDeltas.healPackUpdates.length > 0) data.healPackUpdates = pendingDeltas.healPackUpdates;
			if (pendingDeltas.healPackRemovals && pendingDeltas.healPackRemovals.length > 0) data.healPackRemovals = pendingDeltas.healPackRemovals;
			if (pendingDeltas.healPackPickups && pendingDeltas.healPackPickups.length > 0) data.healPackPickups = pendingDeltas.healPackPickups;
			
			// Acid pool data (Acid drone passive)
			if (pendingDeltas.acidPoolSpawns && pendingDeltas.acidPoolSpawns.length > 0) data.acidPoolSpawns = pendingDeltas.acidPoolSpawns;
			if (pendingDeltas.acidPoolUpdates && pendingDeltas.acidPoolUpdates.length > 0) data.acidPoolUpdates = pendingDeltas.acidPoolUpdates;
			if (pendingDeltas.acidPoolRemovals && pendingDeltas.acidPoolRemovals.length > 0) data.acidPoolRemovals = pendingDeltas.acidPoolRemovals;
			
			// Upgrade visual/sound events
			if (pendingDeltas.phaseShiftEvents.length > 0) data.phaseShiftEvents = pendingDeltas.phaseShiftEvents;
			if (pendingDeltas.adrenalineEvents.length > 0) data.adrenalineEvents = pendingDeltas.adrenalineEvents;
			if (pendingDeltas.momentumEvents.length > 0) data.momentumEvents = pendingDeltas.momentumEvents;
			
			// New upgrade effects
			if (pendingDeltas.missileSpawns.length > 0) data.missileSpawns = pendingDeltas.missileSpawns;
			if (pendingDeltas.missileUpdates.length > 0) data.missileUpdates = pendingDeltas.missileUpdates;
			if (pendingDeltas.missileRemovals.length > 0) data.missileRemovals = pendingDeltas.missileRemovals;
			if (pendingDeltas.stickyChargeDetonations.length > 0) data.stickyChargeDetonations = pendingDeltas.stickyChargeDetonations;
			if (pendingDeltas.arcBarrageBursts.length > 0) data.arcBarrageBursts = pendingDeltas.arcBarrageBursts;
			if (pendingDeltas.shockwaveEvents.length > 0) data.shockwaveEvents = pendingDeltas.shockwaveEvents;

			if (p._territoryDirty) {
				data.territoryUpdates = [{
					num: p.num,
					territory: p.territory
				}];
			}

			data.enemies = enemies.map(serializeEnemy);
			data.enemyStats = getEnemyStats();

			p.client.sendPacket(MSG.FRAME, data);
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
		runTime += deltaSeconds * timeSpeedMultiplier;
		
		const activePlayer = players.find(p => !p.dead && !p.disconnected) || null;
		const frameScale = deltaSeconds / (1 / 60);
		
		// Track HP at start of frame for change detection (life steal, vampire, etc.)
		const frameStartHp = new Map();
		for (const p of players) {
			if (!p.dead) frameStartHp.set(p.num, p.hp);
		}
		
		const spawnEnemyXp = (x, y, value, isDoubleDrop = false, type = "enemy") => {
			const newCoin = {
				id: nextCoinId++,
				x: Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, x)),
				y: Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, y)),
				value: value ?? ENEMY_XP_DROP.defaultValue,
				type,
				isDoubleDrop: isDoubleDrop,
				spawnTime: runTime
			};
			coins.push(newCoin);
			economyDeltas.coinSpawns.push(newCoin);
		};

		const applyBossOrbReward = (player) => {
			if (!player) return null;
			if (!player.bossBonus) {
				player.bossBonus = { flatMaxHp: 0, flatMaxStamina: 0, damageMult: 0, attackSpeedMult: 0 };
			}
			
			const rewards = [
				{
					id: "max_hp",
					label: "+40 HP",
					apply: () => { player.bossBonus.flatMaxHp += 40; }
				},
				{
					id: "max_stamina",
					label: "+20 Stamina",
					apply: () => { player.bossBonus.flatMaxStamina += 20; }
				},
				{
					id: "damage",
					label: "+10% Damage",
					apply: () => { player.bossBonus.damageMult += 0.10; }
				},
				{
					id: "attack_speed",
					label: "+10% Attack Speed",
					apply: () => { player.bossBonus.attackSpeedMult += 0.10; }
				}
			];
			
			const reward = rewards[Math.floor(Math.random() * rewards.length)];
			if (!reward) return null;
			
			const prevMaxHp = player.maxHp;
			const prevMaxStamina = player.maxStamina;
			
			reward.apply();
			recalculateDerivedStats(player);
			
			// Recalculate max HP/stamina to reflect new bonuses immediately
			const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
			const hpPerLevel = consts.HP_PER_LEVEL || 10;
			const level = player.level || 1;
			const levelBonusHp = (level - 1) * hpPerLevel;
			const stats = player.derivedStats || {};
			const flatMaxHp = stats.flatMaxHp || 0;
			const maxHpMult = stats.maxHpMult || 1.0;
			player.maxHp = (baseMaxHp + levelBonusHp + flatMaxHp) * maxHpMult;
			
			const baseMaxStamina = consts.PLAYER_MAX_STAMINA || 100;
			const maxStaminaMult = stats.maxStaminaMult || 1.0;
			const flatMaxStamina = stats.flatMaxStamina || 0;
			player.maxStamina = (baseMaxStamina * maxStaminaMult) + flatMaxStamina;
			
			// Heal by the gained max values
			if (player.hp !== undefined) {
				player.hp = Math.min(player.maxHp, player.hp + (player.maxHp - prevMaxHp));
			}
			if (player.stamina !== undefined) {
				player.stamina = Math.min(player.maxStamina, player.stamina + (player.maxStamina - prevMaxStamina));
			}
			
			player._forceXpUpdate = true;
			return reward.label;
		};
		
		const handleEnemyDeath = (enemy, killer) => {
			if (enemy.dead) return;
			enemy.dead = true;
			enemyKills += 1;
			
			// Spawn XP orb(s) - Scavenger upgrade gives 10% chance for double drops
			const stats = killer?.derivedStats || {};
			if (enemy.isBoss) {
				spawnEnemyXp(enemy.x, enemy.y, enemy.xpDropValue, false, "boss");
			} else {
				const shouldDoubleSpawn = stats.hasScavenger && Math.random() < 0.10;
				spawnEnemyXp(enemy.x, enemy.y, enemy.xpDropValue);
				if (shouldDoubleSpawn) {
					// Spawn second orb slightly offset
					spawnEnemyXp(
						enemy.x + (Math.random() - 0.5) * 20,
						enemy.y + (Math.random() - 0.5) * 20,
						enemy.xpDropValue,
						true
					);
				}
			}
			
			if (killer) {
				// Soul Collector: Track kills and grant bonus HP
				if (stats.hasSoulCollector) {
					killer.soulCollectorKills = (killer.soulCollectorKills || 0) + 1;
					const killsPerBonus = UPGRADE_KNOBS.SOUL_COLLECTOR.killsPerHpBonus;
					const maxBonus = UPGRADE_KNOBS.SOUL_COLLECTOR.maxBonusHp;
					const newBonus = Math.min(maxBonus, Math.floor(killer.soulCollectorKills / killsPerBonus));
					if (newBonus > (killer.soulCollectorBonus || 0)) {
						killer.soulCollectorBonus = newBonus;
						// Recalculate stats to apply new HP bonus
						recalculateDerivedStats(killer);
					}
				}
				
				// Vampire: Heal % max HP on kill (no passive regen handled elsewhere)
				if (stats.hasVampire) {
					const healAmount = killer.maxHp * UPGRADE_KNOBS.VAMPIRE.healOnKillPercent;
					killer.hp = Math.min(killer.maxHp, killer.hp + healAmount);
					// Visual feedback for vampire heal
					economyDeltas.boostPickups = economyDeltas.boostPickups || [];
					economyDeltas.boostPickups.push({
						type: "vampire",
						amount: Math.round(healAmount * 10) / 10,
						x: enemy.x,
						y: enemy.y,
						playerNum: killer.num
					});
				}
				
				economyDeltas.killEvents.push({
					killerNum: killer.num,
					victimNum: -1,
					victimName: enemy.type || "Enemy",
					killType: "enemy"
				});
			}
		};
		
		// ===== PROJECTILE SYSTEM FUNCTIONS =====
		
		/**
		 * Calculate player's aim position (inside the player circle, on the aim indicator dot)
		 */
		function getPlayerAimPosition(player) {
			const scaledRadius = (consts.CELL_WIDTH / 2) * (player.sizeScale || 1.0);
			const aimAngle = player.targetAngle !== undefined ? player.targetAngle : player.angle;
			// Match the visual aim indicator dot position (inside player at 0.6 * radius)
			const aimDist = scaledRadius * 0.6;
			return {
				x: player.x + Math.cos(aimAngle) * aimDist,
				y: player.y + Math.sin(aimAngle) * aimDist
			};
		}

		function getPrecisionRoundsBonus(dist, rangeCap) {
			const minConfig = UPGRADE_KNOBS.PRECISION_ROUNDS.minDistanceForBonus;
			const maxConfig = UPGRADE_KNOBS.PRECISION_ROUNDS.maxDistanceBonus;
			const cappedRange = Math.max(1, rangeCap);
			let minDist = Math.min(minConfig, cappedRange);
			let maxDist = Math.max(minDist + 1, Math.min(maxConfig, cappedRange));

			// If range is shorter than the configured minimum, allow bonus within range
			if (cappedRange <= minConfig) {
				minDist = cappedRange * 0.5;
				maxDist = cappedRange;
			}

			if (dist <= minDist) return 1;
			const distFactor = Math.min(1, (dist - minDist) / (maxDist - minDist));
			return 1 + (distFactor * UPGRADE_KNOBS.PRECISION_ROUNDS.maxDamageBonus);
		}

		function clamp01(value) {
			return Math.max(0, Math.min(1, value));
		}

		function getDroneAccuracy(drone, droneType) {
			return clamp01(drone.accuracy ?? droneType.accuracy ?? 1);
		}

		function getInaccurateAimPoint(originX, originY, target, accuracy, maxRange) {
			const targetRadius = target.radius || 10;
			const hitRoll = Math.random() < accuracy;
			if (hitRoll) {
				return { x: target.x, y: target.y, missDist: 0 };
			}

			const baseRange = maxRange || 150;
			const minMiss = targetRadius * 1.2;
			const maxMiss = Math.max(minMiss, baseRange * 0.35 * (1 - accuracy) + targetRadius);
			const dist = Math.sqrt(Math.random()) * (maxMiss - minMiss) + minMiss;
			const angle = Math.random() * Math.PI * 2;
			return {
				x: target.x + Math.cos(angle) * dist,
				y: target.y + Math.sin(angle) * dist,
				missDist: dist
			};
		}
		
		/**
		 * Create a new projectile from a drone attack
		 * @param {Object} drone - The drone firing
		 * @param {Object} target - The target enemy
		 * @param {number} damage - Damage to deal
		 * @param {boolean} isCrit - Whether this is a critical hit
		 * @param {Object} owner - The player who owns the drone
		 * @param {Object} stats - Additional stats (slow, life on hit, etc.)
		 * @param {Object} originOverride - Optional {x, y} to override projectile origin
		 * @param {string} colorOverride - Optional color to use instead of drone color
		 */
		function createProjectile(drone, target, damage, isCrit, owner, stats, originOverride, colorOverride) {
			const droneType = DRONE_TYPES_BY_ID[drone.typeId] || DRONE_TYPES_BY_ID['assault'];
			const projectileOpacity = droneType.opacity ?? 1.0;
			const projectileLifetime = droneType.projectileLifetime ?? 0;
			const procCoefficient = drone.procCoefficient ?? droneType.procCoefficient ?? (PROC_COEFFICIENTS.default ?? 1.0);
			
			// Get owner stats for range and lifetime upgrades
			const ownerStats = owner.derivedStats || {};
			const rangeMult = ownerStats.rangeMult || 1.0;
			const projectileLifetimeMult = ownerStats.projectileLifetimeMult || 1.0;
			
			// Use override position if provided (for player's aim shot), otherwise use drone position
			const originX = originOverride ? originOverride.x : drone.x;
			const originY = originOverride ? originOverride.y : drone.y;
			
			// Calculate direction to target
			const accuracy = getDroneAccuracy(drone, droneType);
			const aimPoint = getInaccurateAimPoint(originX, originY, target, accuracy, drone.range);
			const dx = aimPoint.x - originX;
			const dy = aimPoint.y - originY;
			const dist = Math.hypot(dx, dy) || 1;
			const dirX = dx / dist;
			const dirY = dy / dist;
			
			// Scale projectile size with player size
			const ownerSizeScale = owner.sizeScale || 1.0;
			const baseProjectileSize = droneType.projectileSize || 4;
			const scaledProjectileSize = baseProjectileSize * ownerSizeScale;
			
			const projectile = {
				id: nextProjectileId++,
				ownerId: owner.num,
				droneId: drone.id,
				droneTypeId: drone.typeId,
				x: originX,
				y: originY,
				originX: originX,
				originY: originY,
				vx: dirX * droneType.projectileSpeed,
				vy: dirY * droneType.projectileSpeed,
				damage: damage,
				isCrit: isCrit,
				attackType: drone.attackType,
				typeColor: colorOverride || drone.typeColor,
				opacity: projectileOpacity,
				isPlayerShot: !!originOverride, // Track if this came from player (first drone)
				pierceCount: droneType.pierceCount || 0,
				piercedEnemies: new Set(),
				size: scaledProjectileSize,
				maxRange: drone.range * 1.5 * rangeMult,
				distanceTraveled: 0,
				appliesSlow: droneType.appliesSlow || false,
				slowAmount: droneType.slowAmount || 0,
				slowDuration: droneType.slowDuration || (consts.SLOW_DURATION_DEFAULT ?? 1.5),
				spawnTime: runTime,
				lifetimeSeconds: projectileLifetime > 0 ? projectileLifetime * projectileLifetimeMult : null,
				lifeOnHitPercent: stats.lifeOnHitPercent || 0,
				procCoefficient: procCoefficient,
				// Track total damage dealt for heal pack passive
				totalDamageDealt: 0,
				// PASSIVE flags from drone type
				pierceDamageScaling: droneType.pierceDamageScaling || false,
				pierceDamageBonusPerEnemy: droneType.pierceDamageBonusPerEnemy || 0.25,
				blackHolePull: droneType.blackHolePull || false,
				blackHolePullRadius: droneType.blackHolePullRadius || 80,
				blackHolePullStrength: droneType.blackHolePullStrength || 120,
				blackHolePulseInterval: droneType.blackHolePulseInterval ?? 0.35,
				blackHolePulseRadiusMult: droneType.blackHolePulseRadiusMult ?? 0.5,
				blackHolePulseDamageMult: droneType.blackHolePulseDamageMult ?? 0.25,
				blackHolePulseMin: droneType.blackHolePulseMin ?? 0.25,
				blackHolePulseMax: droneType.blackHolePulseMax ?? 0.9,
				blackHolePulseSpeed: droneType.blackHolePulseSpeed ?? 5,
				dropsHealPack: droneType.dropsHealPack || false,
				healPackPercent: droneType.healPackPercent || 0.05,
				healPackMin: droneType.healPackMin || 10,
				healPackMax: droneType.healPackMax || 200,
				appliesBleed: droneType.appliesBleed || false,
				bleedDamagePerStack: droneType.bleedDamagePerStack || 1,
				bleedDuration: droneType.bleedDuration || 2.0,
				bleedMaxStacks: droneType.bleedMaxStacks || 10,
				appliesBurn: droneType.appliesBurn || false,
				burnDamagePerStack: droneType.burnDamagePerStack || 1,
				burnDuration: droneType.burnDuration || 2.0,
				burnMaxStacks: droneType.burnMaxStacks || 10,
				rampsTargetDamage: droneType.rampsTargetDamage || false,
				rampDamagePerStack: droneType.rampDamagePerStack || 0.15,
				rampMaxStacks: droneType.rampMaxStacks || 5,
				rampDecayTime: droneType.rampDecayTime || 1.5,
				// PASSIVE: Acid - Creates acid pools on impact
				createsAcidPool: droneType.createsAcidPool || false,
				acidPoolRadius: droneType.acidPoolRadius || 60,
				acidPoolDuration: droneType.acidPoolDuration || 4.0,
				acidPoolDamagePerTick: droneType.acidPoolDamagePerTick || 8,
				acidPoolTickRate: droneType.acidPoolTickRate || 0.5,
				// PASSIVE: Acid - Applies poison DOT
				appliesPoison: droneType.appliesPoison || false,
				poisonDamagePerStack: droneType.poisonDamagePerStack || 3,
				poisonDuration: droneType.poisonDuration || 3.0,
				poisonMaxStacks: droneType.poisonMaxStacks || 5,
				// PASSIVE: Boomerang - Returns to player
				isBoomerang: droneType.isBoomerang || false,
				boomerangReturnSpeed: droneType.boomerangReturnSpeed || 400,
				boomerangMaxDistance: droneType.boomerangMaxDistance || 250,
				isReturning: false // Track boomerang return state
			};
			
			projectiles.push(projectile);
			return projectile;
		}

		function tryMissilePodProc(owner, target, hitDamage, origin, procCoefficient, deltas) {
			if (!owner || !target || target.dead || target.hp <= 0) return;
			const stats = owner.derivedStats || {};
			if (!stats.hasMissilePod) return;
			const baseChance = UPGRADE_KNOBS.MISSILE_POD.procChance;
			if (!rollProcChance(baseChance, procCoefficient)) return;
			
			const missileDamage = hitDamage * UPGRADE_KNOBS.MISSILE_POD.missileDamagePercent;
			const fromX = origin?.x ?? owner.x;
			const fromY = origin?.y ?? owner.y;
			
			const dx = target.x - fromX;
			const dy = target.y - fromY;
			const dist = Math.hypot(dx, dy) || 1;
			const speed = UPGRADE_KNOBS.MISSILE_POD.missileSpeed;
			
			const missile = {
				id: nextMissileId++,
				x: fromX,
				y: fromY,
				vx: (dx / dist) * speed,
				vy: (dy / dist) * speed,
				ownerId: owner.num,
				damage: missileDamage,
				lifetime: UPGRADE_KNOBS.MISSILE_POD.missileLifetime,
				targetId: target.id,
				radius: UPGRADE_KNOBS.MISSILE_POD.missileRadius
			};
			missiles.push(missile);
			deltas.missileSpawns.push({
				id: missile.id,
				x: missile.x,
				y: missile.y,
				vx: missile.vx,
				vy: missile.vy,
				ownerId: missile.ownerId,
				targetId: missile.targetId
			});
		}

		function emitProjectileSpawn(proj, deltas) {
			deltas.projectileSpawns.push({
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
				blackHolePull: proj.blackHolePull || false
			});
		}

		function processPendingProjectileSpawns(deltas) {
			if (pendingProjectileSpawns.length === 0) return;
			for (let i = pendingProjectileSpawns.length - 1; i >= 0; i--) {
				const pending = pendingProjectileSpawns[i];
				if (runTime < pending.fireAt) continue;
				
				pendingProjectileSpawns.splice(i, 1);
				
				const owner = pending.owner;
				if (!owner || owner.dead || owner.disconnected) continue;
				
				const target = enemies.find(e => e.id === pending.targetId && !e.dead && e.hp > 0);
				if (!target) continue;
				
				const proj = createProjectile(
					pending.drone,
					target,
					pending.damage,
					pending.isCrit,
					owner,
					pending.stats,
					pending.originOverride,
					pending.colorOverride
				);
				emitProjectileSpawn(proj, deltas);
			}
		}
		
		/**
		 * Update all projectiles - movement and collision detection
		 */
		function updateProjectiles(deltaSec) {
			const toRemove = [];
			
			for (const proj of projectiles) {
				const moveX = proj.vx * deltaSec;
				const moveY = proj.vy * deltaSec;
				proj.x += moveX;
				proj.y += moveY;
				proj.distanceTraveled += Math.hypot(moveX, moveY);
				
				// PASSIVE: Black hole pull (apply before checking removal)
				if (proj.blackHolePull) {
					for (const enemy of enemies) {
						if (enemy.dead || enemy.hp <= 0) continue;
						const pullDist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
						if (pullDist < proj.blackHolePullRadius && pullDist > 5) {
							// Pull enemy toward projectile
							const pullStrength = proj.blackHolePullStrength * deltaSec;
							const pullDirX = (proj.x - enemy.x) / pullDist;
							const pullDirY = (proj.y - enemy.y) / pullDist;
							enemy.x += pullDirX * pullStrength;
							enemy.y += pullDirY * pullStrength;
						}
					}
					
					// Pulsing damage aura around the singularity
					const pulseInterval = proj.blackHolePulseInterval ?? 0.35;
					if (!proj.lastBlackHolePulse) proj.lastBlackHolePulse = runTime;
					if (runTime - proj.lastBlackHolePulse >= pulseInterval) {
						proj.lastBlackHolePulse = runTime;
						const pulsePhase = (runTime - proj.spawnTime) * (proj.blackHolePulseSpeed ?? 5);
						const pulseMin = proj.blackHolePulseMin ?? 0.25;
						const pulseMax = proj.blackHolePulseMax ?? 0.9;
						const pulse = pulseMin + (pulseMax - pulseMin) * (0.5 + 0.5 * Math.sin(pulsePhase));
						const pulseDamage = proj.damage * (proj.blackHolePulseDamageMult ?? 0.25) * pulse;
						const pulseRadius = proj.blackHolePullRadius * (proj.blackHolePulseRadiusMult ?? 0.5);
						
						if (!economyDeltas.hitscanEvents) economyDeltas.hitscanEvents = [];
						for (const enemy of enemies) {
							if (enemy.dead || enemy.hp <= 0) continue;
							const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
							if (dist > pulseRadius) continue;
							
							enemy.hp -= pulseDamage;
							if (enemy.hp < 0) enemy.hp = 0;
							markEnemyHit(enemy);
							
							economyDeltas.hitscanEvents.push({
								fromX: proj.x,
								fromY: proj.y,
								toX: enemy.x,
								toY: enemy.y,
								ownerId: proj.ownerId,
								targetEnemyId: enemy.id,
								damage: pulseDamage,
								remainingHp: enemy.hp,
								isCrit: false,
								attackType: proj.attackType,
								typeColor: proj.typeColor,
								isProjectileHit: true
							});
							
							if (enemy.hp <= 0) {
								const owner = players.find(p => p.num === proj.ownerId);
								handleEnemyDeath(enemy, owner);
							}
						}
					}
				}
				
				// PASSIVE: Boomerang - Return to player after max distance
				if (proj.isBoomerang) {
					const owner = players.find(p => p.num === proj.ownerId);
					if (owner && !owner.dead) {
						// Check if should start returning
						if (!proj.isReturning && proj.distanceTraveled >= proj.boomerangMaxDistance) {
							proj.isReturning = true;
							// Clear pierced enemies so it can hit them again on return
							proj.piercedEnemies.clear();
						}
						
						// If returning, home toward owner
						if (proj.isReturning) {
							const dx = owner.x - proj.x;
							const dy = owner.y - proj.y;
							const distToOwner = Math.hypot(dx, dy);
							
							// Remove if close to owner
							if (distToOwner < 30) {
								toRemove.push(proj);
								continue;
							}
							
							// Update velocity to home toward owner
							const returnSpeed = proj.boomerangReturnSpeed || 400;
							proj.vx = (dx / distToOwner) * returnSpeed;
							proj.vy = (dy / distToOwner) * returnSpeed;
						}
					} else {
						// Owner gone, remove boomerang
						toRemove.push(proj);
						continue;
					}
				}
				
				// PASSIVE: Acid - Convert to pool after 0.5 seconds of flight
				if (proj.createsAcidPool && !proj.convertedToPool) {
					const acidFlightTime = 0.5; // seconds before converting to pool
					if ((runTime - proj.spawnTime) >= acidFlightTime) {
						proj.convertedToPool = true;
						
						// Create the acid pool at projectile position
						const maxPools = consts.MAX_ACID_POOLS || 50;
						if (acidPools.length < maxPools) {
							const pool = {
								id: nextAcidPoolId++,
								x: proj.x,
								y: proj.y,
								radius: proj.acidPoolRadius,
								damagePerTick: proj.acidPoolDamagePerTick,
								tickRate: proj.acidPoolTickRate,
								duration: proj.acidPoolDuration,
								ownerId: proj.ownerId,
								spawnTime: runTime,
								lastTickTime: runTime,
								appliesPoison: proj.appliesPoison,
								poisonDamagePerStack: proj.poisonDamagePerStack,
								poisonDuration: proj.poisonDuration,
								poisonMaxStacks: proj.poisonMaxStacks
							};
							acidPools.push(pool);
							economyDeltas.acidPoolSpawns.push({
								id: pool.id,
								x: pool.x,
								y: pool.y,
								radius: pool.radius,
								duration: pool.duration,
								ownerId: pool.ownerId
							});
						}
						
						// Remove the projectile
						toRemove.push(proj);
						continue;
					}
				}
				
				// Check max range (skip for returning boomerangs)
				if (!proj.isReturning && proj.distanceTraveled > proj.maxRange) {
					toRemove.push(proj);
					continue;
				}
				
				if (proj.lifetimeSeconds && (runTime - proj.spawnTime) > proj.lifetimeSeconds) {
					toRemove.push(proj);
					continue;
				}
				
				if (proj.x < 0 || proj.x > mapSize || proj.y < 0 || proj.y > mapSize) {
					toRemove.push(proj);
					continue;
				}
				
				let hitSomething = false;
				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;
					if (proj.piercedEnemies.has(enemy.id)) continue;
					
					const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
					const hitRadius = (enemy.radius || 15) + proj.size;
					
					if (dist < hitRadius) {
						proj.piercedEnemies.add(enemy.id);
						
						const owner = players.find(p => p.num === proj.ownerId);
						const ownerStats = owner?.derivedStats || {};
						const baseProcCoefficient = proj.procCoefficient ?? (PROC_COEFFICIENTS.default ?? 1.0);
						const procOrigin = {
							x: proj.originX ?? owner?.x ?? proj.x,
							y: proj.originY ?? owner?.y ?? proj.y
						};
						
						// Execute: Enemies below threshold HP are instantly killed
						if (ownerStats.hasExecute && enemy.hp > 0 && enemy.hp < enemy.maxHp * UPGRADE_KNOBS.EXECUTE.hpThreshold) {
							enemy.hp = 0;
							markEnemyHit(enemy);
							handleEnemyDeath(enemy, owner);
							if (proj.piercedEnemies.size > proj.pierceCount) {
								hitSomething = true;
							}
							continue;
						}
						
						// Calculate damage with Hunter bonus
						// Note: proj.damage already includes player's damageMult (with Territorial/Berserker) from creation time
						let finalDamage = proj.damage;
						if (proj.blackHolePull) {
							const pulse = 0.75 + 0.25 * Math.sin((runTime - proj.spawnTime) * 4);
							finalDamage *= pulse;
						}
						if (ownerStats.hasHunter && enemy.hp < enemy.maxHp * UPGRADE_KNOBS.HUNTER.enemyHpThreshold) {
							finalDamage *= (1 + UPGRADE_KNOBS.HUNTER.damageBonus);
						}
						
						// PASSIVE: Sniper - Pierce damage scaling
						if (proj.pierceDamageScaling) {
							const enemiesPierced = proj.piercedEnemies.size - 1; // -1 because current enemy is already added
							const pierceBonus = 1 + (enemiesPierced * proj.pierceDamageBonusPerEnemy);
							finalDamage *= pierceBonus;
						}
						
						// PASSIVE: Assault - Ramp damage on same target
						if (proj.rampsTargetDamage && owner) {
							if (!assaultRampStacks.has(owner.num)) {
								assaultRampStacks.set(owner.num, new Map());
							}
							const ownerRamps = assaultRampStacks.get(owner.num);
							let rampData = ownerRamps.get(enemy.id);
							
							if (!rampData || (runTime - rampData.lastHitTime) > proj.rampDecayTime) {
								// Reset stacks
								rampData = { stacks: 0, lastHitTime: runTime };
							}
							
							// Apply ramp bonus (before incrementing)
							const rampBonus = 1 + (rampData.stacks * proj.rampDamagePerStack);
							finalDamage *= rampBonus;
							
							// Increment stacks for next hit
							rampData.stacks = Math.min(rampData.stacks + 1, proj.rampMaxStacks);
							rampData.lastHitTime = runTime;
							ownerRamps.set(enemy.id, rampData);
						}
						
						// UPGRADE: Focused Fire - damage bonus for consecutive hits on same target
						if (ownerStats.hasFocusedFire && owner) {
							if (!focusedFireStacks.has(owner.num)) {
								focusedFireStacks.set(owner.num, { targetId: null, stacks: 0, lastHitTime: 0 });
							}
							const ffData = focusedFireStacks.get(owner.num);
							const decayTime = UPGRADE_KNOBS.FOCUSED_FIRE.decayTime;
							
							if (ffData.targetId !== enemy.id || (runTime - ffData.lastHitTime) > decayTime) {
								ffData.targetId = enemy.id;
								ffData.stacks = 0;
							}
							
							const ffBonus = 1 + (ffData.stacks * UPGRADE_KNOBS.FOCUSED_FIRE.damagePerHitOnSameTarget);
							finalDamage *= ffBonus;
							
							ffData.stacks = Math.min(ffData.stacks + 1, UPGRADE_KNOBS.FOCUSED_FIRE.maxStacks);
							ffData.lastHitTime = runTime;
						}
						
						// UPGRADE: Precision Rounds - bonus damage at distance
						if (ownerStats.hasPrecisionRounds && owner) {
							// Use projectile origin (stored or calculated from owner)
							const originX = proj.originX ?? owner.x;
							const originY = proj.originY ?? owner.y;
							const dist = Math.hypot(enemy.x - originX, enemy.y - originY);
							const rangeCap = proj.maxRange || UPGRADE_KNOBS.PRECISION_ROUNDS.maxDistanceBonus;
							finalDamage *= getPrecisionRoundsBonus(dist, rangeCap);
						}
						
						enemy.hp -= finalDamage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);
						
						// Track total damage for Support heal pack
						proj.totalDamageDealt = (proj.totalDamageDealt || 0) + finalDamage;
						
						// Life steal
						if (owner && proj.lifeOnHitPercent > 0 && (owner.lifeOnHitCooldown || 0) <= 0) {
							const healAmount = owner.maxHp * proj.lifeOnHitPercent;
							owner.hp = Math.min(owner.maxHp, owner.hp + healAmount);
							owner.lifeOnHitCooldown = 0.1;
							// Visual feedback for life steal
							economyDeltas.boostPickups = economyDeltas.boostPickups || [];
							economyDeltas.boostPickups.push({
								type: "lifesteal",
								amount: Math.round(healAmount * 10) / 10,
								x: enemy.x,
								y: enemy.y,
								playerNum: owner.num
							});
						}
						
						// PASSIVE: Apply slow
						if (proj.appliesSlow && proj.slowAmount > 0) {
							enemy.slowAmount = proj.slowAmount;
							enemy.slowExpires = runTime + proj.slowDuration;
						}
						
						// PASSIVE: Swarm - Apply bleed stacks
						if (proj.appliesBleed) {
							applyBleedStacks(enemy, owner?.num, {
								bleedMaxStacks: proj.bleedMaxStacks,
								bleedDuration: proj.bleedDuration,
								bleedDamagePerStack: proj.bleedDamagePerStack
							});
						}

						// PASSIVE: Flame - Apply burn stacks
						if (proj.appliesBurn) {
							applyBurnStacks(enemy, owner?.num, {
								burnMaxStacks: proj.burnMaxStacks,
								burnDuration: proj.burnDuration,
								burnDamagePerStack: proj.burnDamagePerStack
							});
						}

						// PASSIVE: Acid - Apply poison stacks
						if (proj.appliesPoison) {
							applyPoisonStacks(enemy, owner?.num, {
								poisonMaxStacks: proj.poisonMaxStacks,
								poisonDuration: proj.poisonDuration,
								poisonDamagePerStack: proj.poisonDamagePerStack
							});
						}

						// PASSIVE: Acid - Create acid pool on impact (only on first hit)
						if (proj.createsAcidPool && proj.piercedEnemies.size === 1) {
							const maxPools = consts.MAX_ACID_POOLS || 50;
							if (acidPools.length < maxPools) {
								const pool = {
									id: nextAcidPoolId++,
									x: enemy.x,
									y: enemy.y,
									radius: proj.acidPoolRadius,
									damagePerTick: proj.acidPoolDamagePerTick,
									tickRate: proj.acidPoolTickRate,
									duration: proj.acidPoolDuration,
									ownerId: proj.ownerId,
									spawnTime: runTime,
									lastTickTime: runTime,
									// Also applies poison to enemies in pool
									appliesPoison: proj.appliesPoison,
									poisonDamagePerStack: proj.poisonDamagePerStack,
									poisonDuration: proj.poisonDuration,
									poisonMaxStacks: proj.poisonMaxStacks
								};
								acidPools.push(pool);
								economyDeltas.acidPoolSpawns.push({
									id: pool.id,
									x: pool.x,
									y: pool.y,
									radius: pool.radius,
									duration: pool.duration,
									ownerId: pool.ownerId
								});
							}
						}

						// UPGRADE: Bleeding Rounds - proc chance to apply bleed stacks
						if (ownerStats.hasBleedingRounds && owner && !enemy.dead) {
							const stacks = owner.upgrades?.bleeding_rounds || 0;
							const baseChance = UPGRADE_KNOBS.BLEEDING_ROUNDS.procChance ?? 0.15;
							const procChance = baseChance * Math.max(1, stacks);
							if (rollProcChance(procChance, baseProcCoefficient)) {
								applyBleedStacks(enemy, owner.num, {
									damagePerStack: UPGRADE_KNOBS.BLEEDING_ROUNDS.damagePerStack,
									durationSeconds: UPGRADE_KNOBS.BLEEDING_ROUNDS.durationSeconds,
									maxBleedStacks: UPGRADE_KNOBS.BLEEDING_ROUNDS.maxBleedStacks
								});
							}
						}
						
						economyDeltas.hitscanEvents.push({
							fromX: proj.x,
							fromY: proj.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: proj.ownerId,
							targetEnemyId: enemy.id,
							damage: finalDamage,
							remainingHp: enemy.hp,
							isCrit: proj.isCrit,
							attackType: proj.attackType,
							typeColor: proj.typeColor,
							isProjectileHit: true
						});
						
						if (enemy.hp <= 0) {
							handleEnemyDeath(enemy, owner);
						}
						
						// UPGRADE: Missile Pod - chance to fire homing missile
						tryMissilePodProc(owner, enemy, finalDamage, procOrigin, baseProcCoefficient, economyDeltas);
						
						// Explosive Rounds: Hits explode for % damage to nearby enemies
						if (ownerStats.hasExplosive) {
							const explosionRadius = UPGRADE_KNOBS.EXPLOSIVE_ROUNDS.explosionRadius;
							const explosionDamage = finalDamage * UPGRADE_KNOBS.EXPLOSIVE_ROUNDS.explosionDamagePercent;
							economyDeltas.hitscanEvents.push({
								fromX: enemy.x,
								fromY: enemy.y,
								toX: enemy.x,
								toY: enemy.y,
								ownerId: proj.ownerId,
								targetEnemyId: enemy.id,
								damage: explosionDamage,
								remainingHp: enemy.hp,
								isExplosion: true,
								typeColor: '#FF9F1C'
							});
							for (const nearbyEnemy of enemies) {
								if (nearbyEnemy === enemy || nearbyEnemy.dead || nearbyEnemy.hp <= 0) continue;
								if (proj.piercedEnemies.has(nearbyEnemy.id)) continue;
								const nearDist = Math.hypot(nearbyEnemy.x - enemy.x, nearbyEnemy.y - enemy.y);
								if (nearDist < explosionRadius) {
									nearbyEnemy.hp -= explosionDamage;
									if (nearbyEnemy.hp <= 0) {
										handleEnemyDeath(nearbyEnemy, owner);
									}
									const aoeProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.explosiveRounds ?? 0.25);
									tryMissilePodProc(owner, nearbyEnemy, explosionDamage, procOrigin, aoeProcCoeff, economyDeltas);
								}
							}
						}
						
						// Chain Lightning: Bounce to nearby enemies at % damage
						if (ownerStats.hasChainLightning) {
							const hitEnemies = new Set([enemy.id]);
							let chainTarget = enemy;
							let chainDamage = finalDamage * UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceDamagePercent;
							
							for (let bounce = 0; bounce < UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceCount; bounce++) {
								let nextTarget = null;
								let nextDist = UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceRange;
								
								for (const e of enemies) {
									if (e.dead || e.hp <= 0 || hitEnemies.has(e.id)) continue;
									const d = Math.hypot(e.x - chainTarget.x, e.y - chainTarget.y);
									if (d < nextDist) {
										nextDist = d;
										nextTarget = e;
									}
								}
								
								if (!nextTarget) break;
								
								hitEnemies.add(nextTarget.id);
								nextTarget.hp -= chainDamage;
								if (nextTarget.hp < 0) nextTarget.hp = 0;
								
								economyDeltas.hitscanEvents.push({
									fromX: chainTarget.x,
									fromY: chainTarget.y,
									toX: nextTarget.x,
									toY: nextTarget.y,
									ownerId: proj.ownerId,
									targetEnemyId: nextTarget.id,
									damage: chainDamage,
									remainingHp: nextTarget.hp,
									isChain: true,
									typeColor: '#00BFFF'
								});
								
								if (nextTarget.hp <= 0) {
									handleEnemyDeath(nextTarget, owner);
								}
								
								const chainProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.chainLightning ?? 0.35);
								tryMissilePodProc(owner, nextTarget, chainDamage, procOrigin, chainProcCoeff, economyDeltas);
								
								chainTarget = nextTarget;
							}
						}
						
						// UPGRADE: Sticky Charges - apply charges that detonate after delay
						if (ownerStats.hasStickyCharges && owner && !enemy.dead) {
							let chargeEntry = stickyCharges.find(c => c.enemyId === enemy.id && c.ownerId === owner.num);
							if (!chargeEntry) {
								chargeEntry = {
									enemyId: enemy.id,
									ownerId: owner.num,
									charges: 0,
									detonationTime: runTime + UPGRADE_KNOBS.STICKY_CHARGES.detonationDelay,
									baseDamage: finalDamage
								};
								stickyCharges.push(chargeEntry);
							}
							chargeEntry.charges = Math.min(
								chargeEntry.charges + UPGRADE_KNOBS.STICKY_CHARGES.chargesPerHit,
								UPGRADE_KNOBS.STICKY_CHARGES.maxChargesPerEnemy
							);
							chargeEntry.detonationTime = runTime + UPGRADE_KNOBS.STICKY_CHARGES.detonationDelay;
							chargeEntry.baseDamage = Math.max(chargeEntry.baseDamage, finalDamage);
						}
						
						// Missile Pod handled by tryMissilePodProc above.
						
						if (proj.piercedEnemies.size > proj.pierceCount) {
							hitSomething = true;
							break;
						}
					}
				}
				
				if (hitSomething) {
					toRemove.push(proj);
				}
			}
			
			for (const proj of toRemove) {
				const idx = projectiles.indexOf(proj);
				if (idx !== -1) {
					projectiles.splice(idx, 1);
					economyDeltas.projectileRemovals.push(proj.id);
					
					// PASSIVE: Support - Drop heal pack on projectile death
					if (proj.dropsHealPack && proj.totalDamageDealt > 0) {
						const healAmount = Math.max(
							proj.healPackMin,
							Math.min(proj.healPackMax, proj.totalDamageDealt * proj.healPackPercent)
						);
						const healPack = {
							id: nextHealPackId++,
							x: proj.x,
							y: proj.y,
							healAmount: healAmount,
							ownerId: proj.ownerId,
							spawnTime: runTime,
							lifetime: consts.HEAL_PACK_LIFETIME || 20
						};
						healPacks.push(healPack);
						economyDeltas.healPackSpawns = economyDeltas.healPackSpawns || [];
						economyDeltas.healPackSpawns.push({
							id: healPack.id,
							x: healPack.x,
							y: healPack.y,
							healAmount: healPack.healAmount,
							ownerId: healPack.ownerId
						});
					}
				}
			}
			
			if (projectiles.length > 0) {
				economyDeltas.projectileUpdates = projectiles.map(p => ({
					id: p.id,
					x: p.x,
					y: p.y,
					vx: p.vx,
					vy: p.vy,
					attackType: p.attackType,
					typeColor: p.typeColor,
					size: p.size
				}));
			}
		}
		
		/**
		 * Update sticky charges - check for detonation
		 */
		function updateStickyCharges(economyDeltas) {
			const toRemove = [];
			
			for (const charge of stickyCharges) {
				if (runTime >= charge.detonationTime) {
					toRemove.push(charge);
					
					// Find the enemy
					const enemy = enemies.find(e => e.id === charge.enemyId);
					if (!enemy || enemy.dead || enemy.hp <= 0) continue;
					
					// Calculate explosion damage (scale with sticky charge upgrade stacks)
					const owner = players.find(p => p.num === charge.ownerId);
					const stickyStacks = Math.max(1, owner?.derivedStats?.stickyChargesStacks || 1);
					const totalDamage = charge.baseDamage * UPGRADE_KNOBS.STICKY_CHARGES.damagePerCharge * stickyStacks * charge.charges;
					enemy.hp -= totalDamage;
					if (enemy.hp < 0) enemy.hp = 0;
					markEnemyHit(enemy);

					// Find owner for kill credit
					const procOrigin = owner ? { x: owner.x, y: owner.y } : { x: enemy.x, y: enemy.y };
					const directProcCoeff = PROC_COEFFICIENTS.stickyCharge ?? 0.25;
					tryMissilePodProc(owner, enemy, totalDamage, procOrigin, directProcCoeff, economyDeltas);
					
					// Visual feedback
					economyDeltas.stickyChargeDetonations.push({
						x: enemy.x,
						y: enemy.y,
						damage: totalDamage,
						charges: charge.charges,
						ownerId: charge.ownerId
					});
					
					// AOE damage to nearby enemies
					const explosionRadius = UPGRADE_KNOBS.STICKY_CHARGES.explosionRadius;
					for (const nearbyEnemy of enemies) {
						if (nearbyEnemy === enemy || nearbyEnemy.dead || nearbyEnemy.hp <= 0) continue;
						const dist = Math.hypot(nearbyEnemy.x - enemy.x, nearbyEnemy.y - enemy.y);
						if (dist < explosionRadius) {
							const aoeDamage = totalDamage * 0.5; // 50% of direct damage to nearby
							nearbyEnemy.hp -= aoeDamage;
							markEnemyHit(nearbyEnemy);
							const splashProcCoeff = PROC_COEFFICIENTS.stickyChargeSplash ?? 0.15;
							tryMissilePodProc(owner, nearbyEnemy, aoeDamage, procOrigin, splashProcCoeff, economyDeltas);
							if (nearbyEnemy.hp <= 0 && owner) {
								handleEnemyDeath(nearbyEnemy, owner);
							}
						}
					}
					
					if (enemy.hp <= 0 && owner) {
						handleEnemyDeath(enemy, owner);
					}
				}
			}
			
			// Remove detonated charges
			for (const charge of toRemove) {
				const idx = stickyCharges.indexOf(charge);
				if (idx !== -1) stickyCharges.splice(idx, 1);
			}
		}
		
		/**
		 * Update missiles - movement, homing, collision
		 */
		function updateMissiles(deltaSec, economyDeltas) {
			const toRemove = [];
			
			for (const missile of missiles) {
				// Reduce lifetime
				missile.lifetime -= deltaSec;
				if (missile.lifetime <= 0) {
					toRemove.push(missile);
					continue;
				}
				
				// Try to home toward target
				const target = enemies.find(e => e.id === missile.targetId);
				if (target && !target.dead && target.hp > 0) {
					const dx = target.x - missile.x;
					const dy = target.y - missile.y;
					const dist = Math.hypot(dx, dy);
					if (dist > 0) {
						const speed = UPGRADE_KNOBS.MISSILE_POD.missileSpeed;
						// Gradually turn toward target (homing behavior)
						const turnRate = 3.0; // radians per second
						const currentAngle = Math.atan2(missile.vy, missile.vx);
						const targetAngle = Math.atan2(dy, dx);
						let angleDiff = targetAngle - currentAngle;
						// Normalize angle difference to [-PI, PI]
						while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
						while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
						const turn = Math.max(-turnRate * deltaSec, Math.min(turnRate * deltaSec, angleDiff));
						const newAngle = currentAngle + turn;
						missile.vx = Math.cos(newAngle) * speed;
						missile.vy = Math.sin(newAngle) * speed;
					}
				}
				
				// Move missile
				missile.x += missile.vx * deltaSec;
				missile.y += missile.vy * deltaSec;
				
				// Check bounds
				if (missile.x < 0 || missile.x > mapSize || missile.y < 0 || missile.y > mapSize) {
					toRemove.push(missile);
					continue;
				}
				
				// Check collision with enemies
				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;
					const dist = Math.hypot(enemy.x - missile.x, enemy.y - missile.y);
					const hitRadius = enemy.radius + missile.radius;
					if (dist < hitRadius) {
						// Hit!
						enemy.hp -= missile.damage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);
						
						const owner = players.find(p => p.num === missile.ownerId);
						
						// Visual feedback
						economyDeltas.hitscanEvents.push({
							fromX: missile.x,
							fromY: missile.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: missile.ownerId,
							targetEnemyId: enemy.id,
							damage: missile.damage,
							remainingHp: enemy.hp,
							isCrit: false,
							attackType: 'bullet',
							typeColor: '#FF4500',
							isMissile: true
						});
						
						if (enemy.hp <= 0 && owner) {
							handleEnemyDeath(enemy, owner);
						}
						
						toRemove.push(missile);
						break;
					}
				}
			}
			
			// Remove expired/hit missiles
			for (const missile of toRemove) {
				const idx = missiles.indexOf(missile);
				if (idx !== -1) {
					missiles.splice(idx, 1);
					economyDeltas.missileRemovals.push(missile.id);
				}
			}
			
			// Send missile updates
			if (missiles.length > 0) {
				economyDeltas.missileUpdates = missiles.map(m => ({
					id: m.id,
					x: m.x,
					y: m.y,
					vx: m.vx,
					vy: m.vy
				}));
			}
		}
		
		// ===== END PROJECTILE SYSTEM =====
		
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
	
	// Count existing enemies by type (for spawn limit)
	const enemyCountByType = new Map();
	for (const enemy of enemies) {
		if (enemy.isBoss) continue; // Don't count bosses toward regular enemy limit
		const type = enemy.type || 'basic';
		enemyCountByType.set(type, (enemyCountByType.get(type) || 0) + 1);
	}
	
	// Spawn regular enemies
	for (const spawn of enemySpawns) {
		const typeName = spawn.type || 'basic';
		const typeData = ENEMY_TYPES[typeName] || ENEMY_TYPES.basic;
		if (typeName === 'sniper') {
			const maxCount = typeData.maxCount ?? 5;
			const currentCount = enemyCountByType.get(typeName) || 0;
			if (currentCount >= maxCount) {
				continue;
			}
		}
		const spawnCount = typeName === 'swarm' ? (typeData.swarmSpawnCount || 1) : 1;
		const spawnSpread = typeName === 'swarm' ? (typeData.swarmSpawnSpread || 0) : 0;
		
		for (let s = 0; s < spawnCount; s++) {
			// Check if we've hit the limit for this type
			const currentCount = enemyCountByType.get(typeName) || 0;
			if (currentCount >= ENEMY_SPAWN_LIMITS.maxPerType) {
				break; // Skip additional spawns for this type
			}
			
			const angle = spawnSpread > 0 ? Math.random() * Math.PI * 2 : 0;
			const radius = spawnSpread > 0 ? Math.random() * spawnSpread : 0;
			const spawnX = spawn.x + Math.cos(angle) * radius;
			const spawnY = spawn.y + Math.sin(angle) * radius;
			
			queueEnemySpawn(typeName, spawnX, spawnY);
			// Update count for this type
			enemyCountByType.set(typeName, (enemyCountByType.get(typeName) || 0) + 1);
		}
	}
		
	// Count existing bosses by type (for spawn limit)
	const bossCountByType = new Map();
	for (const enemy of enemies) {
		if (!enemy.isBoss) continue;
		const type = enemy.type || 'titan';
		bossCountByType.set(type, (bossCountByType.get(type) || 0) + 1);
	}
	
	// Spawn bosses
	for (const spawn of bossSpawns) {
		const bossType = spawn.type || 'titan';
		
		// Check if we've hit the limit for this boss type
		const currentCount = bossCountByType.get(bossType) || 0;
		if (currentCount >= ENEMY_SPAWN_LIMITS.maxPerType) {
			continue; // Skip spawning this boss
		}
		
		queueEnemySpawn(bossType, spawn.x, spawn.y, true);
		// Update count for this boss type
		bossCountByType.set(bossType, (bossCountByType.get(bossType) || 0) + 1);
	}
	
	// Spawn pending enemies and emit warning indicators
	processPendingEnemySpawns(economyDeltas);
	
	if (activePlayer && !activePlayer.dead) {
			const playerRadius = activePlayer.getScaledRadius ? activePlayer.getScaledRadius() : PLAYER_RADIUS;
			const hitCooldown = 0.35;
			for (const enemy of enemies) {
				if (enemy.dead) continue;
				applyEnemyScaling(enemy);
				const dx = activePlayer.x - enemy.x;
				const dy = activePlayer.y - enemy.y;
				const dist = Math.hypot(dx, dy);
				const norm = dist > 0 ? 1 / dist : 0;
				
				if (!enemy.isBoss) {
					if (enemy.lastDamagedAt === undefined) {
						enemy.lastDamagedAt = runTime;
					}
					if (runTime - enemy.lastDamagedAt >= enemyLifetimeSeconds
						&& dist >= enemyDespawnDistance) {
						enemy.dead = true;
						continue;
					}
				}
				
				// Check if enemy is stunned (skip all movement if stunned)
				if (enemy.stunExpires && runTime < enemy.stunExpires) {
					enemy.vx = 0;
					enemy.vy = 0;
					// Still process DOT effects below, but skip movement and contact damage
				}
				const isStunned = enemy.stunExpires && runTime < enemy.stunExpires;
				const isSpawnGrace = enemy.spawnGraceUntil && runTime < enemy.spawnGraceUntil;
				if (isSpawnGrace) {
					enemy.vx = 0;
					enemy.vy = 0;
				}
				const isImmobilized = isStunned || isSpawnGrace;
				
				// Apply slow debuff if active
				let effectiveSpeed = enemy.speed;
				let slowMult = 1.0;
				if (enemy.slowExpires && runTime < enemy.slowExpires) {
					slowMult = 1 - (enemy.slowAmount || 0);
					effectiveSpeed *= slowMult;
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
					
					if (enemy.type === 'sniper') {
						const minSep = enemy.minSeparation || 120;
						let sepX = 0;
						let sepY = 0;
						let sepCount = 0;
						for (const other of enemies) {
							if (other === enemy || other.dead || other.type !== 'sniper') continue;
							const ox = enemy.x - other.x;
							const oy = enemy.y - other.y;
							const d = Math.hypot(ox, oy);
							if (d > 0 && d < minSep) {
								const push = (minSep - d) / minSep;
								sepX += (ox / d) * push;
								sepY += (oy / d) * push;
								sepCount++;
							}
						}
						if (sepCount > 0) {
							const mag = Math.hypot(sepX, sepY);
							if (mag > 0) {
								sepX /= mag;
								sepY /= mag;
								const blend = 0.5;
								moveX = moveX * (1 - blend) + sepX * blend;
								moveY = moveY * (1 - blend) + sepY * blend;
							}
						}
					}
					
					// Summoner: spawn minions periodically
					if (enemy.type === 'summoner' && enemy.summonCooldown) {
						if ((runTime - (enemy.lastSummonTime || 0)) >= enemy.summonCooldown) {
							enemy.lastSummonTime = runTime;
							// Spawn minions around the summoner (2 + minutes)
							const minutes = Math.floor(runTime / 60);
							const summonCount = Math.max(1, (enemy.summonCount || 2) + minutes);
							for (let s = 0; s < summonCount; s++) {
								const angle = (s / summonCount) * Math.PI * 2;
								const spawnDist = enemy.radius + 20;
								const minionX = enemy.x + Math.cos(angle) * spawnDist;
								const minionY = enemy.y + Math.sin(angle) * spawnDist;
								spawnSwarmEnemyAt(minionX, minionY);
							}
						}
					}
					
					if (enemy.type === 'sniper') {
						const healRadius = enemy.healRadius || 240;
						const healAmount = enemy.healAmount || 2.5;
						const healPercent = enemy.healPercent || 0.10;
						const healCooldown = enemy.healCooldown || 0.8;
						if ((runTime - (enemy.lastHealAt || 0)) >= healCooldown) {
							enemy.lastHealAt = runTime;
							const healGlowDuration = 0.6;
							for (const target of enemies) {
								if (target.dead || target === enemy) continue;
								const healDist = Math.hypot(target.x - enemy.x, target.y - enemy.y);
								if (healDist > healRadius) continue;
								const beforeHp = target.hp;
								const healTotal = healAmount + target.maxHp * healPercent;
								target.hp = Math.min(target.maxHp, target.hp + healTotal);
								if (target.hp > beforeHp) {
									markEnemyHit(target);
									target.healGlowUntil = runTime + healGlowDuration;
								}
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
				
				if (enemy.type === 'tank' && enemy.swarmBurstCooldown) {
					const burstReady = (runTime - (enemy.lastSwarmBurst || 0)) >= enemy.swarmBurstCooldown;
					if (burstReady) {
						enemy.lastSwarmBurst = runTime;
						const burstCount = enemy.swarmBurstCount || 5;
						const spread = enemy.swarmBurstSpread || 24;
						for (let s = 0; s < burstCount; s++) {
							const angle = (s / burstCount) * Math.PI * 2;
							const radius = enemy.radius + Math.random() * spread;
							const minionX = enemy.x + Math.cos(angle) * radius;
							const minionY = enemy.y + Math.sin(angle) * radius;
							spawnSwarmEnemyAt(minionX, minionY);
						}
					}
				}
				// Basic, tank, swarm, titan all use default "move toward player" behavior
				
				if (enemy.type === 'swarm') {
					if (enemy.spawnTime === undefined) enemy.spawnTime = runTime;
					const rampSeconds = ENEMY_TYPES.swarm.chaseRampSeconds || 7;
					const capMult = ENEMY_TYPES.swarm.chaseSpeedCapMult || 1.01;
					const playerSpeed = getPlayerMoveSpeed(activePlayer, runTime);
					const capSpeed = playerSpeed * capMult;
					const startSpeed = Math.min(enemy.speed, capSpeed);
					const t = rampSeconds > 0 ? Math.min(1, (runTime - enemy.spawnTime) / rampSeconds) : 1;
					effectiveSpeed = (startSpeed + (capSpeed - startSpeed) * t) * slowMult;
				}
				
				// Only apply movement if not stunned
				if (!isImmobilized) {
					enemy.vx = moveX * effectiveSpeed;
					enemy.vy = moveY * effectiveSpeed;
					enemy.x += enemy.vx * deltaSeconds;
					enemy.y += enemy.vy * deltaSeconds;
					
					enemy.x = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, enemy.x));
					enemy.y = Math.max(consts.BORDER_WIDTH, Math.min(mapSize - consts.BORDER_WIDTH, enemy.y));
				}
				
				// PASSIVE: Swarm - Process bleed damage ticks
				if (enemy.bleedStacks > 0 && enemy.bleedExpires && runTime < enemy.bleedExpires) {
					// Initialize bleed tick timer if not set
					if (!enemy.lastBleedTick) enemy.lastBleedTick = runTime;
					
					const bleedTickRate = consts.BLEED_TICK_RATE || 0.25;
					if (runTime - enemy.lastBleedTick >= bleedTickRate) {
						enemy.lastBleedTick = runTime;
						const bleedDamage = enemy.bleedStacks * (enemy.bleedDamagePerStack || 1);
						enemy.hp -= bleedDamage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);
						
						// Visual feedback for bleed tick (subtle red flash)
						economyDeltas.hitscanEvents.push({
							fromX: enemy.x,
							fromY: enemy.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: enemy.bleedOwnerId || -1,
							targetEnemyId: enemy.id,
							damage: bleedDamage,
							remainingHp: enemy.hp,
							isCrit: false,
							attackType: 'bleed',
							typeColor: '#8B0000', // Dark red for bleed
							isBleedTick: true
						});
						
						if (enemy.hp <= 0) {
							const bleedOwner = players.find(p => p.num === enemy.bleedOwnerId);
							handleEnemyDeath(enemy, bleedOwner);
						}
					}
				} else if (enemy.bleedStacks > 0 && runTime >= enemy.bleedExpires) {
					// Bleed expired, clear stacks
					enemy.bleedStacks = 0;
					enemy.bleedExpires = 0;
				}

				// PASSIVE: Flame - Process burn damage ticks
				if (enemy.burnStacks > 0 && enemy.burnExpires && runTime < enemy.burnExpires) {
					if (!enemy.lastBurnTick) enemy.lastBurnTick = runTime;

					const burnTickRate = consts.BURN_TICK_RATE || 0.35;
					if (runTime - enemy.lastBurnTick >= burnTickRate) {
						enemy.lastBurnTick = runTime;
						const burnDamage = enemy.burnStacks * (enemy.burnDamagePerStack || 1);
						enemy.hp -= burnDamage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);

						economyDeltas.hitscanEvents.push({
							fromX: enemy.x,
							fromY: enemy.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: enemy.burnOwnerId || -1,
							targetEnemyId: enemy.id,
							damage: burnDamage,
							remainingHp: enemy.hp,
							isCrit: false,
							attackType: 'burn',
							typeColor: '#FF7A1A',
							isBurnTick: true
						});

						if (enemy.hp <= 0) {
							const burnOwner = players.find(p => p.num === enemy.burnOwnerId);
							handleEnemyDeath(enemy, burnOwner);
						}
					}
				} else if (enemy.burnStacks > 0 && runTime >= enemy.burnExpires) {
					enemy.burnStacks = 0;
					enemy.burnExpires = 0;
				}

				// PASSIVE: Acid - Process poison damage ticks
				if (enemy.poisonStacks > 0 && enemy.poisonExpires && runTime < enemy.poisonExpires) {
					if (!enemy.lastPoisonTick) enemy.lastPoisonTick = runTime;

					const poisonTickRate = consts.POISON_TICK_RATE || 0.5;
					if (runTime - enemy.lastPoisonTick >= poisonTickRate) {
						enemy.lastPoisonTick = runTime;
						const poisonDamage = enemy.poisonStacks * (enemy.poisonDamagePerStack || 3);
						enemy.hp -= poisonDamage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);

						economyDeltas.hitscanEvents.push({
							fromX: enemy.x,
							fromY: enemy.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: enemy.poisonOwnerId || -1,
							targetEnemyId: enemy.id,
							damage: poisonDamage,
							remainingHp: enemy.hp,
							isCrit: false,
							attackType: 'poison',
							typeColor: '#7FFF00', // Bright green for poison
							isPoisonTick: true
						});

						if (enemy.hp <= 0) {
							const poisonOwner = players.find(p => p.num === enemy.poisonOwnerId);
							handleEnemyDeath(enemy, poisonOwner);
						}
					}
				} else if (enemy.poisonStacks > 0 && runTime >= enemy.poisonExpires) {
					enemy.poisonStacks = 0;
					enemy.poisonExpires = 0;
				}
				
				// Contact damage check (skip if stunned)
				if (!isImmobilized) {
					const hitDx = activePlayer.x - enemy.x;
					const hitDy = activePlayer.y - enemy.y;
					const hitDist = Math.hypot(hitDx, hitDy);
					const hitRadius = playerRadius + enemy.radius;
					
					if (hitDist < hitRadius && (runTime - enemy.lastHitAt) >= hitCooldown) {
						applyEnemyDamageToPlayer(activePlayer, enemy, enemy.contactDamage, economyDeltas, dead);
					}
				}
			}
		}
		
		for (let i = enemies.length - 1; i >= 0; i--) {
			if (enemies[i].dead) {
				enemies.splice(i, 1);
			}
		}
		
		// ===== HEAL PACK UPDATE (Support drone passive) =====
		// Process heal pack collection and expiration
		const healPacksToRemove = [];
		const healPackPickupRadius = consts.HEAL_PACK_RADIUS || 12;
		const healPackLifetime = consts.HEAL_PACK_LIFETIME || 20;
		
		for (const healPack of healPacks) {
			// Check expiration
			if (runTime - healPack.spawnTime >= healPackLifetime) {
				healPacksToRemove.push(healPack);
				continue;
			}
			
			// Check collection by any player
			for (const p of players) {
				if (p.dead || p.disconnected) continue;
				
				const distToPlayer = Math.hypot(p.x - healPack.x, p.y - healPack.y);
				const pickupDist = healPackPickupRadius + (p.getScaledRadius ? p.getScaledRadius() : 20);
				
				if (distToPlayer < pickupDist) {
					// Collect heal pack
					p.hp = Math.min(p.maxHp || 100, p.hp + healPack.healAmount);
					healPacksToRemove.push(healPack);
					
					// Notify client of pickup
					economyDeltas.healPackPickups = economyDeltas.healPackPickups || [];
					economyDeltas.healPackPickups.push({
						id: healPack.id,
						playerNum: p.num,
						healAmount: healPack.healAmount
					});
					break;
				}
			}
		}
		
		// Remove collected/expired heal packs
		for (const healPack of healPacksToRemove) {
			const idx = healPacks.indexOf(healPack);
			if (idx !== -1) {
				healPacks.splice(idx, 1);
				economyDeltas.healPackRemovals = economyDeltas.healPackRemovals || [];
				economyDeltas.healPackRemovals.push(healPack.id);
			}
		}
		
		// Send heal pack updates
		if (healPacks.length > 0) {
			const blinkTime = consts.HEAL_PACK_BLINK_TIME || 5;
			economyDeltas.healPackUpdates = healPacks.map(hp => ({
				id: hp.id,
				x: hp.x,
				y: hp.y,
				healAmount: hp.healAmount,
				timeRemaining: healPackLifetime - (runTime - hp.spawnTime),
				isBlinking: (healPackLifetime - (runTime - hp.spawnTime)) <= blinkTime
			}));
		}
		
		// ===== ACID POOL UPDATE (Acid drone passive) =====
		// Process acid pool damage to enemies and expiration
		const acidPoolsToRemove = [];
		
		for (const pool of acidPools) {
			// Check expiration
			if (runTime - pool.spawnTime >= pool.duration) {
				acidPoolsToRemove.push(pool);
				continue;
			}
			
			// Check for tick damage
			const tickRate = pool.tickRate || 0.5;
			if (runTime - pool.lastTickTime >= tickRate) {
				pool.lastTickTime = runTime;
				
				// Damage all enemies in the pool
				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;
					
					const dist = Math.hypot(enemy.x - pool.x, enemy.y - pool.y);
					if (dist < pool.radius) {
						// Deal pool damage
						const poolDamage = pool.damagePerTick;
						enemy.hp -= poolDamage;
						if (enemy.hp < 0) enemy.hp = 0;
						markEnemyHit(enemy);
						
						// Apply poison if pool has it
						if (pool.appliesPoison) {
							applyPoisonStacks(enemy, pool.ownerId, {
								poisonMaxStacks: pool.poisonMaxStacks,
								poisonDuration: pool.poisonDuration,
								poisonDamagePerStack: pool.poisonDamagePerStack
							});
						}
						
						// Visual feedback for acid pool damage
						economyDeltas.hitscanEvents.push({
							fromX: pool.x,
							fromY: pool.y,
							toX: enemy.x,
							toY: enemy.y,
							ownerId: pool.ownerId,
							targetEnemyId: enemy.id,
							damage: poolDamage,
							remainingHp: enemy.hp,
							isCrit: false,
							attackType: 'acid',
							typeColor: '#7FFF00', // Bright green
							isAcidPoolTick: true
						});
						
						if (enemy.hp <= 0) {
							const poolOwner = players.find(p => p.num === pool.ownerId);
							handleEnemyDeath(enemy, poolOwner);
						}
					}
				}
			}
		}
		
		// Remove expired acid pools
		for (const pool of acidPoolsToRemove) {
			const idx = acidPools.indexOf(pool);
			if (idx !== -1) {
				acidPools.splice(idx, 1);
				economyDeltas.acidPoolRemovals.push(pool.id);
			}
		}
		
		// Send acid pool updates (for client to render fade effects)
		for (const pool of acidPools) {
			economyDeltas.acidPoolUpdates.push({
				id: pool.id,
				x: pool.x,
				y: pool.y,
				radius: pool.radius,
				timeRemaining: pool.duration - (runTime - pool.spawnTime)
			});
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
							killer.updateSizeScale();
							
							// Rebuild drones for new level
							rebuildDronesArray(killer, getDroneCountForLevel(killer.level));
							
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
							droneCount: killer.drones.length,
							upgrades: killer.upgrades || {}
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
			let attackSpeedMult = stats.attackSpeedMult || 1.0;
			let damageMult = stats.damageMult || 1.0;
			const critChance = stats.critChance || 0;
			const critMult = stats.critMult || 2.0;
			const lifeOnHitPercent = stats.lifeStealPercent || 0;
			const extraProjectiles = stats.extraProjectiles || 0;
			const multishotDamageDecay = UPGRADE_KNOBS.MULTISHOT.damageDecay ?? 0.75;
			
			// Berserker: Below threshold HP, gain attack speed and damage
			const berserkerMaxHp = Math.max(1, p.maxHp || (consts.PLAYER_MAX_HP ?? 100));
			const berserkerActive = stats.hasBerserker && p.hp <= berserkerMaxHp * UPGRADE_KNOBS.BERSERKER.hpThreshold;
			p.berserkerActive = berserkerActive;
			if (berserkerActive) {
				attackSpeedMult *= (1 + UPGRADE_KNOBS.BERSERKER.attackSpeedBonus);
				damageMult += UPGRADE_KNOBS.BERSERKER.damageBonus;
			}
			
			// Territorial: Bonus damage while in own territory
			if (stats.hasTerritorial && inTerritory) {
				damageMult += UPGRADE_KNOBS.TERRITORIAL.damageBonus;
			}
			
			// Get Away: Bonus damage per enemy within drone range
			if (stats.hasGetAway) {
				// Calculate scaled drone range (same as targeting logic)
				const baseRange = consts.DRONE_RANGE || 200;
				const playerSizeScale = p.sizeScale || 1.0;
				const rangeMult = stats.rangeMult || 1.0;
				const scaledRange = baseRange * playerSizeScale * rangeMult;
				
				// Count enemies within range
				let enemiesInRange = 0;
				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;
					const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
					if (dist <= scaledRange) {
						enemiesInRange++;
					}
				}
				
				// Apply damage bonus
				const getAwayStacks = Math.max(1, stats.getAwayStacks || 1);
				damageMult += enemiesInRange * UPGRADE_KNOBS.GET_AWAY.damagePerEnemy * getAwayStacks;
				p.getAwayEnemyCount = enemiesInRange; // Store for UI/debugging
			}
			
			// Update timers
			if (p.phaseShiftCooldown > 0) p.phaseShiftCooldown -= deltaSeconds;
			if (p.adrenalineTimer > 0) p.adrenalineTimer -= deltaSeconds;
			if (p.momentumStacks === undefined) p.momentumStacks = 0;
			
			// Momentum: Outside territory, gain speed per second (max capped)
			if (stats.hasMomentum) {
				const maxStacks = UPGRADE_KNOBS.MOMENTUM.maxSpeedBonus / UPGRADE_KNOBS.MOMENTUM.speedPerSecond;
				if (!inTerritory) {
					const wasZero = p.momentumStacks <= 0;
					p.momentumStacks = Math.min(maxStacks, p.momentumStacks + deltaSeconds);
					if (wasZero) {
						economyDeltas.momentumEvents.push({ playerNum: p.num });
					}
				} else {
					p.momentumStacks = 0; // Reset when entering territory
				}
			}
			
			// Overcharge Core: Drain HP over time (stops at minimum)
			if (stats.hasOverchargeCore) {
				const drainPerSec = UPGRADE_KNOBS.OVERCHARGE_CORE.hpDrainPerSecond;
				const minHp = p.maxHp * UPGRADE_KNOBS.OVERCHARGE_CORE.minHpPercent;
				if (p.hp > minHp) {
					const drain = p.maxHp * drainPerSec * deltaSeconds;
					p.hp = Math.max(minHp, p.hp - drain);
				}
			}
			
			// Arc Barrage: Periodic burst around player
			if (stats.hasArcBarrage) {
				if (p.arcBarrageCooldown === undefined) p.arcBarrageCooldown = 0;
				p.arcBarrageCooldown -= deltaSeconds;
				if (p.arcBarrageCooldown <= 0) {
					p.arcBarrageCooldown = UPGRADE_KNOBS.ARC_BARRAGE.burstInterval;
					const burstRadius = UPGRADE_KNOBS.ARC_BARRAGE.burstRadius;
					const baseDamage = consts.DRONE_DAMAGE || 10;
					const burstDamage = baseDamage * damageMult * UPGRADE_KNOBS.ARC_BARRAGE.burstDamagePercent;
					const procCoeff = PROC_COEFFICIENTS.arcBarrage ?? 0.25;
					let hitCount = 0;
					const hits = [];
					const maxHits = UPGRADE_KNOBS.ARC_BARRAGE.maxEnemiesHit;
					
					for (const enemy of enemies) {
						if (enemy.dead || enemy.hp <= 0 || hitCount >= maxHits) continue;
						const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
						if (dist < burstRadius) {
							enemy.hp -= burstDamage;
							if (enemy.hp < 0) enemy.hp = 0;
							markEnemyHit(enemy);
							hitCount++;
							hits.push({
								x: enemy.x,
								y: enemy.y,
								damage: burstDamage
							});
							tryMissilePodProc(p, enemy, burstDamage, { x: p.x, y: p.y }, procCoeff, economyDeltas);
							if (enemy.hp <= 0) {
								handleEnemyDeath(enemy, p);
							}
						}
					}
					
					// Visual feedback - ALWAYS show the burst, even if no enemies hit
					economyDeltas.arcBarrageBursts.push({
						x: p.x,
						y: p.y,
						radius: burstRadius,
						playerNum: p.num,
						damage: burstDamage,
						hitCount: hitCount,
						hits
					});
				}
			}
			
			// Heatseeker Drones: Passive attack nearby enemies
			if (stats.hasHeatseekerDrones) {
				if (p.heatseekerCooldown === undefined) p.heatseekerCooldown = 0;
				p.heatseekerCooldown -= deltaSeconds;
				if (p.heatseekerCooldown <= 0) {
					p.heatseekerCooldown = UPGRADE_KNOBS.HEATSEEKER_DRONES.attackCooldown;
					const range = UPGRADE_KNOBS.HEATSEEKER_DRONES.attackRange;
					const baseDamage = consts.DRONE_DAMAGE || 10;
					const droneDamage = baseDamage * damageMult * UPGRADE_KNOBS.HEATSEEKER_DRONES.damagePercent;
					const droneCount = UPGRADE_KNOBS.HEATSEEKER_DRONES.droneCount;
					const procCoeff = PROC_COEFFICIENTS.heatseekerDrones ?? 0.45;
					
					// Find closest enemies for each drone
					const targets = [];
					for (const enemy of enemies) {
						if (enemy.dead || enemy.hp <= 0) continue;
						const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
						if (dist < range) {
							targets.push({ enemy, dist });
						}
					}
					targets.sort((a, b) => a.dist - b.dist);
					
					for (let i = 0; i < Math.min(droneCount, targets.length); i++) {
						const target = targets[i].enemy;
						target.hp -= droneDamage;
						if (target.hp < 0) target.hp = 0;
						markEnemyHit(target);
						
						tryMissilePodProc(p, target, droneDamage, { x: p.x, y: p.y }, procCoeff, economyDeltas);
						
						// Visual feedback - show as hitscan from player to enemy
						economyDeltas.hitscanEvents.push({
							fromX: p.x,
							fromY: p.y,
							toX: target.x,
							toY: target.y,
							ownerId: p.num,
							targetEnemyId: target.id,
							damage: droneDamage,
							remainingHp: target.hp,
							isCrit: false,
							attackType: 'laser',
							typeColor: '#00FF88',
							isHeatseekerDrone: true
						});
						
						if (target.hp <= 0) {
							handleEnemyDeath(target, p);
						}
					}
				}
			}
			
			// Update life on hit cooldown
			if ((p.lifeOnHitCooldown || 0) > 0) {
				p.lifeOnHitCooldown -= deltaSeconds;
			}
			
			// Update each drone
			for (const drone of p.drones) {
				// Get drone type multipliers (default to 1.0 if not set)
				const droneCooldownMult = drone.cooldownMult || 1.0;
				const droneDamageMult = drone.damageMult || 1.0;
				
				// Reduce cooldown (modified by attack speed and drone type)
				if (drone.cooldownRemaining > 0) {
					// Lower cooldownMult = faster fire, so we divide by it
					drone.cooldownRemaining -= deltaSeconds * attackSpeedMult / droneCooldownMult;
				}
				
				// Drones are disabled when owner is snipped (can't target or fire)
				if (p.isSnipped) {
					drone.targetId = null;
					continue; // Skip targeting and firing
				}
				
				// Find target (nearest enemy to this specific drone, within range of player)
				let target = null;
				let minDist = Infinity;
				const ownerX = p.x;
				const ownerY = p.y;
				// Scale drone range with player size and rangeMult upgrade
				const playerSizeScale = p.sizeScale || 1.0;
				const playerRangeMult = stats.rangeMult || 1.0;
				const scaledRange = drone.range * playerSizeScale * playerRangeMult;

				for (const enemy of enemies) {
					if (enemy.dead || enemy.hp <= 0) continue;

					// Check if enemy is within range of player (range is measured from player center)
					const distToPlayer = Math.hypot(enemy.x - ownerX, enemy.y - ownerY);
					if (distToPlayer > scaledRange) continue;

					// Target the enemy closest to THIS drone (not the player)
					// This spreads out targeting so drones don't all shoot the same enemy
					const distToDrone = Math.hypot(enemy.x - drone.x, enemy.y - drone.y);
					if (distToDrone < minDist) {
						minDist = distToDrone;
						target = enemy;
					}
				}
				
				drone.targetId = target ? target.id : null;
				
				// PASSIVE: Skirmisher - Track fire rate ramp state
				const currentDroneType = DRONE_TYPES_BY_ID[drone.typeId] || DRONE_TYPES_BY_ID['assault'];
				if (currentDroneType.rampsFireRate) {
					// Initialize ramp tracking if not present
					if (drone.fireRateRampProgress === undefined) drone.fireRateRampProgress = 0;
					if (drone.timeSinceLastShot === undefined) drone.timeSinceLastShot = 0;
					
					const resetTime = currentDroneType.fireRateResetTime || 0.6;
					
					if (!target) {
						// No target - track time without shooting
						drone.timeSinceLastShot += deltaSeconds;
						if (drone.timeSinceLastShot >= resetTime) {
							// Reset ramp after no enemies for reset time
							drone.fireRateRampProgress = 0;
						}
					}
				}
				
				// Fire if ready and has target
				if (target && drone.cooldownRemaining <= 0) {
					// Calculate cooldown with Skirmisher fire rate ramp
					let baseCooldown = consts.DRONE_COOLDOWN || 0.5;
					if (currentDroneType.rampsFireRate) {
						const rampMax = currentDroneType.fireRateRampMax || 2.0;
						const fireRateMult = 1 + (rampMax - 1) * (drone.fireRateRampProgress || 0);
						baseCooldown = baseCooldown / fireRateMult;
						
						// Progress the ramp
						const rampTime = currentDroneType.fireRateRampTime || 3.0;
						drone.fireRateRampProgress = Math.min(1, (drone.fireRateRampProgress || 0) + (deltaSeconds / rampTime) * 2);
						drone.timeSinceLastShot = 0; // Reset idle timer on shot
					}
					drone.cooldownRemaining = baseCooldown;
					
					// Execute: Enemies below threshold HP are instantly killed
					if (stats.hasExecute && target.hp > 0 && target.hp < target.maxHp * UPGRADE_KNOBS.EXECUTE.hpThreshold) {
						target.hp = 0;
						handleEnemyDeath(target, p);
						continue; // Skip normal attack, enemy is dead
					}
					
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
					
					// Apply drone type multiplier AND player damage multiplier (includes Territorial/Berserker)
					let damage = baseDmg * droneDamageMult * damageMult;
					
					// Hunter: Bonus damage vs enemies below threshold HP
					if (stats.hasHunter && target.hp < target.maxHp * UPGRADE_KNOBS.HUNTER.enemyHpThreshold) {
						damage *= (1 + UPGRADE_KNOBS.HUNTER.damageBonus);
					}
					
					// Check for critical hit
					const isCrit = Math.random() < critChance;
					if (isCrit) {
						damage *= critMult;
					}
					
					// Check if this drone uses hitscan or projectile
					const droneType = DRONE_TYPES_BY_ID[drone.typeId] || DRONE_TYPES_BY_ID['assault'];
					const isHitscan = droneType.isHitscan;
					
					// PASSIVE: Commando - Grant speed boost to owner when shooting
					if (droneType.grantsSpeedBoost) {
						const speedBoostPercent = droneType.speedBoostPercent || 0.15;
						const speedBoostDuration = droneType.speedBoostDuration || 1.0;
						p.commandoSpeedBoost = speedBoostPercent;
						p.commandoSpeedBoostExpires = runTime + speedBoostDuration;
					}
					
					// PASSIVE: Shockwave - AoE stomp attack with stun
					if (droneType.isShockwave) {
						const shockwaveRadius = droneType.shockwaveRadius || 100;
						const stunDuration = droneType.shockwaveStunDuration || 1.0;
						const baseProcCoefficient = drone.procCoefficient ?? droneType.procCoefficient ?? 0.4;
						let shockwaveHits = 0;
						let shockwaveDamageTotal = 0;
						
						// Hit all enemies in radius around the drone
						for (const enemy of enemies) {
							if (enemy.dead || enemy.hp <= 0) continue;
							const dist = Math.hypot(enemy.x - drone.x, enemy.y - drone.y);
							if (dist < shockwaveRadius) {
								// Apply damage
								enemy.hp -= damage;
								if (enemy.hp < 0) enemy.hp = 0;
								markEnemyHit(enemy);
								
								// Apply stun
								applyStun(enemy, stunDuration);
								
								// Visual feedback
								economyDeltas.hitscanEvents.push({
									fromX: drone.x,
									fromY: drone.y,
									toX: enemy.x,
									toY: enemy.y,
									ownerId: p.num,
									targetEnemyId: enemy.id,
									damage: damage,
									remainingHp: enemy.hp,
									isCrit: isCrit,
									attackType: 'shockwave',
									typeColor: droneType.color || '#8B4513',
									isShockwave: true
								});
								
								if (enemy.hp <= 0) {
									handleEnemyDeath(enemy, p);
								}
								
								shockwaveHits += 1;
								shockwaveDamageTotal += damage;
								
								// Proc missile pod
								const procOrigin = { x: drone.x, y: drone.y };
								const aoeProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.shockwave ?? 0.3);
								tryMissilePodProc(p, enemy, damage, procOrigin, aoeProcCoeff, economyDeltas);
							}
						}
						
						// Emit shockwave effect event for client rendering
						if (shockwaveHits > 0) {
							economyDeltas.shockwaveEvents.push({
								x: drone.x,
								y: drone.y,
								radius: shockwaveRadius,
								ownerId: p.num,
								damage: shockwaveDamageTotal
							});
						}
						
						continue; // Skip normal hitscan/projectile logic
					}
					
					if (isHitscan) {
						// HITSCAN: Instant hit (lasers, pulse beams)
						// First drone (index 0) fires from player's aim position, others fire from drone
						const isFirstDrone = droneIndex === 0;
						const hitscanOrigin = isFirstDrone ? getPlayerAimPosition(p) : null;
						
						applyHitscanDamage(p, drone, target, damage, isCrit, economyDeltas, hitscanOrigin, true);
						
						// Multi-shot: fire at additional nearby enemies (only for hitscan)
						if (extraProjectiles > 0) {
							const nearbyEnemies = enemies.filter(e => 
								e !== target && !e.dead && e.hp > 0 &&
								Math.hypot(e.x - ownerX, e.y - ownerY) < scaledRange
							);
							nearbyEnemies.sort((a, b) => 
								Math.hypot(a.x - ownerX, a.y - ownerY) - Math.hypot(b.x - ownerX, b.y - ownerY)
							);
							for (let i = 0; i < Math.min(extraProjectiles, nearbyEnemies.length); i++) {
								const multiTarget = nearbyEnemies[i];
								const extraDamage = damage * Math.pow(multishotDamageDecay, i + 1);
								applyHitscanDamage(p, drone, multiTarget, extraDamage, isCrit, economyDeltas, hitscanOrigin, true);
							}
						}
						
						// Chain lightning is handled in applyHitscanDamage
					} else {
						// PROJECTILE: Spawn a traveling projectile (bullets, plasma, railgun)
						// First drone (index 0) fires from player's aim position, others fire from drone
						const isFirstDrone = droneIndex === 0;
						const originPos = isFirstDrone ? getPlayerAimPosition(p) : null;
						// First drone uses player's color instead of drone color
						const playerColor = isFirstDrone ? colorToHex(p.baseColor) : null;
						
						const proj = createProjectile(drone, target, damage, isCrit, p, {
							lifeOnHitPercent: lifeOnHitPercent
						}, originPos, playerColor);
						
						// Send projectile spawn event for client
						emitProjectileSpawn(proj, economyDeltas);
						
						// Multi-shot for projectiles: spawn additional projectiles
						if (extraProjectiles > 0) {
							const multishotDelayMs = UPGRADE_KNOBS.MULTISHOT.projectileDelayMs || 0;
							const nearbyEnemies = enemies.filter(e => 
								e !== target && !e.dead && e.hp > 0 &&
								Math.hypot(e.x - ownerX, e.y - ownerY) < scaledRange
							);
							nearbyEnemies.sort((a, b) => 
								Math.hypot(a.x - ownerX, a.y - ownerY) - Math.hypot(b.x - ownerX, b.y - ownerY)
							);
							for (let i = 0; i < Math.min(extraProjectiles, nearbyEnemies.length); i++) {
								const multiTarget = nearbyEnemies[i];
								const extraDamage = damage * Math.pow(multishotDamageDecay, i + 1);
								const delaySec = multishotDelayMs > 0 ? (multishotDelayMs * (i + 1)) / 1000 : 0;
								
								if (delaySec > 0) {
									pendingProjectileSpawns.push({
										fireAt: runTime + delaySec,
										drone,
										targetId: multiTarget.id,
										damage: extraDamage,
										isCrit,
										owner: p,
										stats: { lifeOnHitPercent: lifeOnHitPercent },
										originOverride: originPos,
										colorOverride: playerColor
									});
								} else {
									const extraProj = createProjectile(drone, multiTarget, extraDamage, isCrit, p, {
										lifeOnHitPercent: lifeOnHitPercent
									}, originPos, playerColor); // Extra projectiles also come from same origin with player color
									emitProjectileSpawn(extraProj, economyDeltas);
								}
							}
						}
					}
				}
			}
		}
		
		// Spawn any delayed multishot projectiles
		processPendingProjectileSpawns(economyDeltas);
		
		// Update projectiles (movement and collision)
		updateProjectiles(deltaSeconds);
		
		// Update sticky charges (detonation timer)
		updateStickyCharges(economyDeltas);
		
		// Update missiles (movement and homing)
		updateMissiles(deltaSeconds, economyDeltas);
		
		// Helper function to apply hitscan damage with all effects
		// originOverride: optional {x, y} for first drone to fire from player's aim position
		// skipBaseDamageMult: if true, don't multiply by stats.damageMult (already applied by caller)
		function applyHitscanDamage(player, drone, target, damage, isCrit, deltas, originOverride, skipBaseDamageMult = false) {
			const stats = player.derivedStats || {};
			const lifeOnHitPct = stats.lifeStealPercent || 0;
			const droneType = DRONE_TYPES_BY_ID[drone.typeId] || DRONE_TYPES_BY_ID['assault'];
			const baseProcCoefficient = drone.procCoefficient ?? droneType.procCoefficient ?? (PROC_COEFFICIENTS.default ?? 1.0);
			const procOrigin = originOverride ? originOverride : { x: drone.x, y: drone.y };
			const accuracy = getDroneAccuracy(drone, droneType);
			const aimPoint = getInaccurateAimPoint(procOrigin.x, procOrigin.y, target, accuracy, drone.range);
			const targetRadius = target.radius || 10;
			const didHit = aimPoint.missDist <= targetRadius;

			if (!didHit) {
				deltas.hitscanEvents.push({
					fromX: procOrigin.x,
					fromY: procOrigin.y,
					toX: aimPoint.x,
					toY: aimPoint.y,
					ownerId: player.num,
					targetEnemyId: target.id,
					damage: 0,
					remainingHp: target.hp,
					isCrit: false,
					attackType: drone.attackType || 'bullet',
					typeColor: drone.typeColor || '#FF6B6B'
				});
				return;
			}

			// Execute: Enemies below threshold HP are instantly killed (hitscan)
			if (stats.hasExecute && target.hp > 0) {
				const executeThreshold = (target.maxHp || target.hp) * UPGRADE_KNOBS.EXECUTE.hpThreshold;
				if (target.hp < executeThreshold) {
					const executeDamage = target.hp;
					target.hp = 0;

					// Use override position if provided (for first drone), otherwise use drone position
					const fromX = originOverride ? originOverride.x : drone.x;
					const fromY = originOverride ? originOverride.y : drone.y;
					deltas.hitscanEvents.push({
						fromX: fromX,
						fromY: fromY,
						toX: target.x,
						toY: target.y,
						ownerId: player.num,
						targetEnemyId: target.id,
						damage: executeDamage,
						remainingHp: target.hp,
						isCrit: false,
						attackType: drone.attackType || 'bullet',
						typeColor: drone.typeColor || '#FF6B6B'
					});

					handleEnemyDeath(target, player);
					return;
				}
			}
			
			// PASSIVE: Assault - Ramp damage on same target
			// Only apply base damageMult if not already applied by caller (skipBaseDamageMult)
			let finalDamage = skipBaseDamageMult ? damage : damage * (stats.damageMult || 1.0);
			if (droneType.rampsTargetDamage) {
				if (!assaultRampStacks.has(player.num)) {
					assaultRampStacks.set(player.num, new Map());
				}
				const ownerRamps = assaultRampStacks.get(player.num);
				let rampData = ownerRamps.get(target.id);
				
				const rampDecayTime = droneType.rampDecayTime || 1.5;
				if (!rampData || (runTime - rampData.lastHitTime) > rampDecayTime) {
					rampData = { stacks: 0, lastHitTime: runTime };
				}
				
				// Apply ramp bonus (before incrementing)
				const rampDamagePerStack = droneType.rampDamagePerStack || 0.15;
				const rampMaxStacks = droneType.rampMaxStacks || 5;
				const rampBonus = 1 + (rampData.stacks * rampDamagePerStack);
				finalDamage *= rampBonus;
				
				// Increment stacks for next hit
				rampData.stacks = Math.min(rampData.stacks + 1, rampMaxStacks);
				rampData.lastHitTime = runTime;
				ownerRamps.set(target.id, rampData);
			}
			
			// UPGRADE: Focused Fire - damage bonus for consecutive hits on same target
			if (stats.hasFocusedFire) {
				if (!focusedFireStacks.has(player.num)) {
					focusedFireStacks.set(player.num, { targetId: null, stacks: 0, lastHitTime: 0 });
				}
				const ffData = focusedFireStacks.get(player.num);
				const decayTime = UPGRADE_KNOBS.FOCUSED_FIRE.decayTime;
				
				if (ffData.targetId !== target.id || (runTime - ffData.lastHitTime) > decayTime) {
					// New target or decay, reset stacks
					ffData.targetId = target.id;
					ffData.stacks = 0;
				}
				
				// Apply bonus
				const ffBonus = 1 + (ffData.stacks * UPGRADE_KNOBS.FOCUSED_FIRE.damagePerHitOnSameTarget);
				finalDamage *= ffBonus;
				
				// Increment stacks
				ffData.stacks = Math.min(ffData.stacks + 1, UPGRADE_KNOBS.FOCUSED_FIRE.maxStacks);
				ffData.lastHitTime = runTime;
			}
			
			// UPGRADE: Precision Rounds - bonus damage at distance
			if (stats.hasPrecisionRounds) {
				const fromX = originOverride ? originOverride.x : drone.x;
				const fromY = originOverride ? originOverride.y : drone.y;
				const dist = Math.hypot(target.x - fromX, target.y - fromY);
				const rangeCap = drone.range * (player.sizeScale || 1.0) * (stats.rangeMult || 1.0);
				finalDamage *= getPrecisionRoundsBonus(dist, rangeCap);
			}
			
			// Apply damage
			target.hp -= finalDamage;
			if (target.hp < 0) target.hp = 0;
			markEnemyHit(target);
			
			// Life on hit (with internal cooldown)
			if (lifeOnHitPct > 0 && (player.lifeOnHitCooldown || 0) <= 0) {
				const healAmount = player.maxHp * lifeOnHitPct;
				player.hp = Math.min(player.maxHp, player.hp + healAmount);
				player.lifeOnHitCooldown = 0.1; // 0.1s cooldown
				// Visual feedback for life steal
				deltas.boostPickups = deltas.boostPickups || [];
				deltas.boostPickups.push({
					type: "lifesteal",
					amount: Math.round(healAmount * 10) / 10,
					x: target.x,
					y: target.y,
					playerNum: player.num
				});
			}
			
			// PASSIVE: Swarm - Apply bleed stacks
			if (droneType.appliesBleed) {
				applyBleedStacks(target, player.num, {
					bleedMaxStacks: droneType.bleedMaxStacks,
					bleedDuration: droneType.bleedDuration,
					bleedDamagePerStack: droneType.bleedDamagePerStack
				});
			}

			// PASSIVE: Flame - Apply burn stacks
			if (droneType.appliesBurn) {
				applyBurnStacks(target, player.num, {
					burnMaxStacks: droneType.burnMaxStacks,
					burnDuration: droneType.burnDuration,
					burnDamagePerStack: droneType.burnDamagePerStack
				});
			}

			// UPGRADE: Bleeding Rounds - proc chance to apply bleed stacks
			if (stats.hasBleedingRounds && !target.dead) {
				const stacks = player.upgrades?.bleeding_rounds || 0;
				const baseChance = UPGRADE_KNOBS.BLEEDING_ROUNDS.procChance ?? 0.15;
				const procChance = baseChance * Math.max(1, stacks);
				if (rollProcChance(procChance, baseProcCoefficient)) {
					applyBleedStacks(target, player.num, {
						damagePerStack: UPGRADE_KNOBS.BLEEDING_ROUNDS.damagePerStack,
						durationSeconds: UPGRADE_KNOBS.BLEEDING_ROUNDS.durationSeconds,
						maxBleedStacks: UPGRADE_KNOBS.BLEEDING_ROUNDS.maxBleedStacks
					});
				}
			}
			
			if (DEBUG_HITSCAN_LOGS) {
				console.log(`[HITSCAN] Drone ${drone.id} (owner: ${player.name}) hit enemy ${target.id} for ${finalDamage.toFixed(1)} dmg${isCrit ? ' (CRIT!)' : ''}. HP: ${target.hp}/${target.maxHp}`);
			}
			
			// Use override position if provided (for first drone), otherwise use drone position
			const fromX = originOverride ? originOverride.x : drone.x;
			const fromY = originOverride ? originOverride.y : drone.y;
			
			// Send hitscan event for visual feedback
			deltas.hitscanEvents.push({
				fromX: fromX,
				fromY: fromY,
				toX: target.x,
				toY: target.y,
				ownerId: player.num,
				targetEnemyId: target.id,
				damage: finalDamage,
				remainingHp: target.hp,
				isCrit: isCrit,
				attackType: drone.attackType || 'bullet',
				typeColor: drone.typeColor || '#FF6B6B'
			});
			
			// Check for death
			if (target.hp <= 0) {
				handleEnemyDeath(target, player);
			}
			
			// UPGRADE: Missile Pod - chance to fire homing missile
			tryMissilePodProc(player, target, finalDamage, procOrigin, baseProcCoefficient, deltas);
			
			// PASSIVE: Rapid - Chain hits nearby enemies for 15% damage
			if (droneType.chainHitsNearby && !target.dead) {
				const chainPercent = droneType.chainHitPercent || 0.15;
				const chainRadius = droneType.chainHitRadius || 60;
				const chainDamage = finalDamage * chainPercent;
				
				for (const nearbyEnemy of enemies) {
					if (nearbyEnemy === target || nearbyEnemy.dead || nearbyEnemy.hp <= 0) continue;
					const dist = Math.hypot(nearbyEnemy.x - target.x, nearbyEnemy.y - target.y);
					if (dist < chainRadius) {
						nearbyEnemy.hp -= chainDamage;
						if (nearbyEnemy.hp < 0) nearbyEnemy.hp = 0;
						markEnemyHit(nearbyEnemy);
						
						// Visual feedback for chain hit
						deltas.hitscanEvents.push({
							fromX: target.x,
							fromY: target.y,
							toX: nearbyEnemy.x,
							toY: nearbyEnemy.y,
							ownerId: player.num,
							targetEnemyId: nearbyEnemy.id,
							damage: chainDamage,
							remainingHp: nearbyEnemy.hp,
							isCrit: false,
							attackType: 'laser',
							typeColor: droneType.color || '#4ECDC4',
							isChainHit: true
						});
						
						if (nearbyEnemy.hp <= 0) {
							handleEnemyDeath(nearbyEnemy, player);
						}
						
						const chainProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.rapidChainHit ?? 0.25);
						tryMissilePodProc(player, nearbyEnemy, chainDamage, procOrigin, chainProcCoeff, deltas);
					}
				}
			}
			
			// PASSIVE: Electric - Chain to one nearby enemy for 75% damage
			if (droneType.chainsToEnemy && !target.dead) {
				const chainPercent = droneType.chainDamagePercent || 0.75;
				const chainRadius = droneType.chainRange || 120;
				const chainDamage = finalDamage * chainPercent;
				
				// Find the closest enemy within range
				let closestEnemy = null;
				let closestDist = chainRadius;
				
				for (const nearbyEnemy of enemies) {
					if (nearbyEnemy === target || nearbyEnemy.dead || nearbyEnemy.hp <= 0) continue;
					const dist = Math.hypot(nearbyEnemy.x - target.x, nearbyEnemy.y - target.y);
					if (dist < closestDist) {
						closestDist = dist;
						closestEnemy = nearbyEnemy;
					}
				}
				
				if (closestEnemy) {
					closestEnemy.hp -= chainDamage;
					if (closestEnemy.hp < 0) closestEnemy.hp = 0;
					markEnemyHit(closestEnemy);
					
					// Visual feedback - purple electric chain
					deltas.hitscanEvents.push({
						fromX: target.x,
						fromY: target.y,
						toX: closestEnemy.x,
						toY: closestEnemy.y,
						ownerId: player.num,
						targetEnemyId: closestEnemy.id,
						damage: chainDamage,
						remainingHp: closestEnemy.hp,
						isCrit: false,
						attackType: 'electric',
						typeColor: '#9932CC', // Purple electric
						isChain: true
					});
					
					if (closestEnemy.hp <= 0) {
						handleEnemyDeath(closestEnemy, player);
					}
					
					const chainProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.electricChain ?? 0.35);
					tryMissilePodProc(player, closestEnemy, chainDamage, procOrigin, chainProcCoeff, deltas);
				}
			}
			
			// Explosive Rounds: Hits explode for % damage to nearby enemies
			if (stats.hasExplosive && !target.dead) {
				const explosionRadius = UPGRADE_KNOBS.EXPLOSIVE_ROUNDS.explosionRadius;
				const explosionDamage = finalDamage * UPGRADE_KNOBS.EXPLOSIVE_ROUNDS.explosionDamagePercent;
				deltas.hitscanEvents.push({
					fromX: target.x,
					fromY: target.y,
					toX: target.x,
					toY: target.y,
					ownerId: player.num,
					targetEnemyId: target.id,
					damage: explosionDamage,
					remainingHp: target.hp,
					isExplosion: true,
					typeColor: '#FF9F1C'
				});
				for (const nearbyEnemy of enemies) {
					if (nearbyEnemy === target || nearbyEnemy.dead || nearbyEnemy.hp <= 0) continue;
					const dist = Math.hypot(nearbyEnemy.x - target.x, nearbyEnemy.y - target.y);
					if (dist < explosionRadius) {
						nearbyEnemy.hp -= explosionDamage;
						markEnemyHit(nearbyEnemy);
						if (nearbyEnemy.hp <= 0) {
							handleEnemyDeath(nearbyEnemy, player);
						}
						const aoeProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.explosiveRounds ?? 0.25);
						tryMissilePodProc(player, nearbyEnemy, explosionDamage, procOrigin, aoeProcCoeff, deltas);
					}
				}
			}
			
			// Chain Lightning: Bounce to nearby enemies at % damage
			if (stats.hasChainLightning && !target.dead) {
				const hitEnemies = new Set([target.id]);
				let chainTarget = target;
				let chainDamage = finalDamage * UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceDamagePercent;
				
				for (let bounce = 0; bounce < UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceCount; bounce++) {
					let nextTarget = null;
					let nextDist = UPGRADE_KNOBS.CHAIN_LIGHTNING.bounceRange;
					
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
					nextTarget.hp -= chainDamage;
					if (nextTarget.hp < 0) nextTarget.hp = 0;
					markEnemyHit(nextTarget);
					
					deltas.hitscanEvents.push({
						fromX: chainTarget.x,
						fromY: chainTarget.y,
						toX: nextTarget.x,
						toY: nextTarget.y,
						ownerId: player.num,
						targetEnemyId: nextTarget.id,
						damage: chainDamage,
						remainingHp: nextTarget.hp,
						isChain: true,
						typeColor: '#00BFFF' // Chain lightning color
					});
					
					if (nextTarget.hp <= 0) {
						handleEnemyDeath(nextTarget, player);
					}
					
					const chainProcCoeff = baseProcCoefficient * (PROC_COEFFICIENTS.chainLightning ?? 0.35);
					tryMissilePodProc(player, nextTarget, chainDamage, procOrigin, chainProcCoeff, deltas);
					
					chainTarget = nextTarget;
				}
			}
			
			// UPGRADE: Sticky Charges - apply charges that detonate after delay
			if (stats.hasStickyCharges && !target.dead) {
				// Find existing charge entry for this enemy
				let chargeEntry = stickyCharges.find(c => c.enemyId === target.id && c.ownerId === player.num);
				if (!chargeEntry) {
					chargeEntry = {
						enemyId: target.id,
						ownerId: player.num,
						charges: 0,
						detonationTime: runTime + UPGRADE_KNOBS.STICKY_CHARGES.detonationDelay,
						baseDamage: finalDamage
					};
					stickyCharges.push(chargeEntry);
				}
				// Add charges (capped)
				chargeEntry.charges = Math.min(
					chargeEntry.charges + UPGRADE_KNOBS.STICKY_CHARGES.chargesPerHit,
					UPGRADE_KNOBS.STICKY_CHARGES.maxChargesPerEnemy
				);
				// Reset detonation timer and update base damage
				chargeEntry.detonationTime = runTime + UPGRADE_KNOBS.STICKY_CHARGES.detonationDelay;
				chargeEntry.baseDamage = Math.max(chargeEntry.baseDamage, finalDamage);
			}
			
			// Missile Pod handled by tryMissilePodProc above.
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
						killer.updateSizeScale();
						
						// Rebuild drones for new level
						rebuildDronesArray(killer, getDroneCountForLevel(killer.level));
						
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
						droneCount: killer.drones.length,
						upgrades: killer.upgrades || {}
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
		
		// Expire boost orbs regardless of player state
		const boostOrbLifetime = consts.BOOST_ORB_LIFETIME_SEC ?? 15;
		for (let i = coins.length - 1; i >= 0; i--) {
			const coin = coins[i];
			if (coin.type !== "stamina" && coin.type !== "heal") continue;
			if (coin.spawnTime == null) coin.spawnTime = runTime;
			if (runTime - coin.spawnTime >= boostOrbLifetime) {
				economyDeltas.coinRemovals.push(coin.id);
				coins.splice(i, 1);
			}
		}
		
		// Expire XP orbs after lifetime (0 = never expire)
		const xpOrbLifetime = consts.XP_ORB_LIFETIME_SEC ?? 30;
		if (xpOrbLifetime > 0) {
			for (let i = coins.length - 1; i >= 0; i--) {
				const coin = coins[i];
				if (coin.type !== "enemy" && coin.type !== "boss") continue;
				if (coin.spawnTime == null) coin.spawnTime = runTime;
				if (runTime - coin.spawnTime >= xpOrbLifetime) {
					economyDeltas.coinRemovals.push(coin.id);
					coins.splice(i, 1);
				}
			}
		}
		
		// Process alive players economy (XP/Leveling)
		for (const p of players) {
			if (p.dead) continue;
			
			let changed = false;
			// Use HP from start of frame to detect combat changes (life steal, vampire, etc.)
			const prevHp = frameStartHp.get(p.num) ?? p.hp;
			const prevMaxHp = p.maxHp;

			// 0. Pull enemy XP orbs toward player when inside territory
			const inTerritory = p.territory && p.territory.length >= 3 &&
				pointInPolygon({ x: p.x, y: p.y }, p.territory);
			if (inTerritory && coins.length > 0) {
				const maxPullSpeed = (consts.SPEED || 4) * (consts.XP_ORB_PULL_SPEED_MULT ?? 0.4);
				const pullAccel = maxPullSpeed * (consts.XP_ORB_PULL_ACCEL_MULT ?? 1.0);
				for (const coin of coins) {
					if (coin.type !== "enemy" && coin.type !== "boss") continue;
					if (!pointInPolygon({ x: coin.x, y: coin.y }, p.territory)) continue;
					
					const dx = p.x - coin.x;
					const dy = p.y - coin.y;
					const dist = Math.hypot(dx, dy);
					if (dist <= 0.01) continue;
					
					coin.pullSpeed = Math.min(maxPullSpeed, (coin.pullSpeed || 0) + pullAccel * deltaSeconds);
					const maxStep = coin.pullSpeed * frameScale;
					const step = Math.min(maxStep, dist);
					const nx = dx / dist;
					const ny = dy / dist;
					
					coin.x += nx * step;
					coin.y += ny * step;
					economyDeltas.coinUpdates.push({ id: coin.id, x: coin.x, y: coin.y });
				}
			}

			// Check for exhaustion death (HP drained due to stamina depletion)
			if (p.hp <= 0 && !p.dead) {
				p.die();
				economyDeltas.killEvents.push({
					killerNum: -1,
					victimNum: p.num,
					victimName: p.name || "Player",
					killType: "exhaustion"
				});
				changed = true;
			}

			// 1. XP pickups (coins) and boost pickups
			// Pickup radius is based on drone orbit radius (where drones circle), scaled with player size
			const droneOrbitRadius = consts.DRONE_ORBIT_RADIUS || 55;
			const playerSizeScale = p.sizeScale || 1.0;
			const pickupRadiusMult = (p.derivedStats && p.derivedStats.pickupRadiusMult) || 1.0;
		const effectivePickupRadius = droneOrbitRadius * playerSizeScale * pickupRadiusMult;
			for (let i = coins.length - 1; i >= 0; i--) {
				const coin = coins[i];
				const dist = Math.hypot(p.x - coin.x, p.y - coin.y);
				if (dist < effectivePickupRadius) {
					// Handle different boost/orb types
					if (coin.type === "stamina") {
						// Stamina boost: add temporary stamina (clamped to max)
						const boostAmount = coin.value || consts.STAMINA_BOOST_AMOUNT || 20;
						p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + boostAmount);
						economyDeltas.boostPickups = economyDeltas.boostPickups || [];
						economyDeltas.boostPickups.push({
							type: "stamina",
							amount: boostAmount,
							x: coin.x,
							y: coin.y,
							playerNum: p.num
						});
					} else if (coin.type === "heal") {
						// Heal boost: heal for 20*(minutes+1)
						const minutes = Math.floor(runTime / 60);
						const healBase = consts.HEAL_BOOST_BASE || 20;
						const healAmount = healBase * (minutes + 1);
						p.hp = Math.min(p.maxHp || 100, (p.hp || 0) + healAmount);
						economyDeltas.boostPickups = economyDeltas.boostPickups || [];
						economyDeltas.boostPickups.push({
							type: "heal",
							amount: healAmount,
							x: coin.x,
							y: coin.y,
							playerNum: p.num
						});
					} else {
						// XP orbs (enemy, boss, default)
						p.xp += coin.value;
						if (coin.type === "boss") {
							const rewardText = applyBossOrbReward(p);
							if (rewardText) {
								economyDeltas.gameMessages.push({
									text: rewardText,
									duration: 2.0
								});
							}
						}
					}
					economyDeltas.coinRemovals.push(coin.id);
					coins.splice(i, 1);
					changed = true;
				}
			}

			// 2. Territory rewards -> convert stamina boosts to heal boosts
			if (p._pendingTerritoryAreaGained > 0) {
				// Convert stamina boosts inside newly claimed territory to heal boosts
				if (p.territory && p.territory.length >= 3) {
					for (let i = coins.length - 1; i >= 0; i--) {
						const coin = coins[i];
						// Skip enemy/boss XP orbs - they don't convert
						if (coin.type === "enemy" || coin.type === "boss") continue;
						// Skip heal boosts - already converted
						if (coin.type === "heal") continue;
						
						if (pointInPolygon({ x: coin.x, y: coin.y }, p.territory)) {
							if (coin.type === "stamina") {
								// Convert stamina boost to heal boost
								coin.type = "heal";
								// Update the value for heal scaling (base heal amount)
								coin.value = consts.HEAL_BOOST_BASE || 20;
								// Reset lifetime timer on conversion
								coin.spawnTime = runTime;
								// Notify client of the type change
								economyDeltas.coinUpdates.push({
									id: coin.id,
									x: coin.x,
									y: coin.y,
									type: "heal",
									value: coin.value,
									spawnTime: coin.spawnTime
								});
							}
							// Note: we no longer auto-collect gold coins since they're now stamina boosts
						}
					}
				}

				const baseTerritoryXpPerArea = consts.TERRITORY_XP_PER_AREA || 0.00025;
				const territoryXpScale = consts.TERRITORY_XP_SCALE ?? 1.0;
				// Scale with sqrt of level ratio, freeze at cap time value
				const scaleCapMin = consts.TERRITORY_XP_SCALE_CAP_MIN ?? 5;
				const minutes = runTime / 60;
				const xpNeeded = getXpForLevel(p.level || 1);
				const baseXpNeeded = getXpForLevel(1);
				const levelRatio = baseXpNeeded > 0 ? (xpNeeded / baseXpNeeded) : 1;
				let levelScale;
				if (scaleCapMin > 0 && minutes >= scaleCapMin) {
					// Freeze at the value when cap was reached
					if (p._frozenTerritoryScale === undefined) {
						p._frozenTerritoryScale = Math.sqrt(levelRatio);
					}
					levelScale = p._frozenTerritoryScale;
				} else {
					levelScale = Math.sqrt(levelRatio);
				}
				const territoryXpPerArea = baseTerritoryXpPerArea * levelScale * territoryXpScale;

				p._territoryCoinCarry = (p._territoryCoinCarry || 0) + p._pendingTerritoryAreaGained * territoryXpPerArea;
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

			const hpChanged = (p.hp !== prevHp) || (p.maxHp !== prevMaxHp);
			if (changed || p._forceXpUpdate || hpChanged) {
				economyDeltas.xpUpdates.push({
					num: p.num,
					level: p.level,
					xp: p.xp,
					xpPerLevel: getXpForLevel(p.level),
					sizeScale: p.sizeScale,
					droneCount: p.droneCount || 1,
					hp: p.hp,
					maxHp: p.maxHp,
					stamina: p.stamina,
					maxStamina: p.maxStamina,
					derivedStats: p.derivedStats || null,
					upgrades: p.upgrades || {},
					getAwayEnemyCount: p.getAwayEnemyCount || 0
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
						targetId: d.targetId,
						// Include type info for rendering
						typeId: d.typeId || 'assault',
						typeName: d.typeName || 'Assault',
						typeColor: d.typeColor || '#FF6B6B',
						attackType: d.attackType || 'bullet'
					}))
				});
			}
		}
	}
	
	/**
	 * Apply level-up benefits: check for drone unlock and update player size.
	 * Note: Drone is NOT added here - it's added after player picks the drone type.
	 * Returns true if a new drone slot was unlocked (pending choice needed).
	 */
	function applyLevelBenefits(player) {
		// Update size scale based on new level
		player.updateSizeScale();
		
		// Recalculate max HP to include the new level bonus
		const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
		const hpPerLevel = consts.HP_PER_LEVEL || 10;
		const level = player.level || 1;
		const levelBonusHp = (level - 1) * hpPerLevel;
		const stats = player.derivedStats || {};
		const flatMaxHp = stats.flatMaxHp || 0;
		const maxHpMult = stats.maxHpMult || 1.0;
		player.maxHp = (baseMaxHp + levelBonusHp + flatMaxHp) * maxHpMult;
		
		// Heal the player for the HP gained from leveling
		player.hp = Math.min(player.hp + hpPerLevel, player.maxHp);
		
		// Check if this level unlocks a new drone slot
		const newDroneCount = getDroneCountForLevel(player.level);
		
		if (newDroneCount > (player.droneCount || 1)) {
			// Mark that a drone unlock is pending (don't add drone yet)
			player._pendingDroneUnlock = newDroneCount;
			return true; // Drone unlock pending
		}
		
		return false; // No drone unlock
	}
	
	/**
	 * Check if player has pending drone unlock and trigger drone choice flow
	 */
	function checkPendingDroneUnlock(player) {
		if (!player._pendingDroneUnlock) return false;
		
		const newDroneIndex = player._pendingDroneUnlock - 1; // 0-indexed slot for the new drone
		
		// Roll 3 drone type choices
		const choices = rollDroneChoices();
		
		pendingDroneOffer = {
			playerNum: player.num,
			droneIndex: newDroneIndex,
			choices: choices
		};
		gamePaused = true;
		
		// Send drone offer to the player
		player.client.sendPacket(MSG.DRONE_OFFER, {
			choices: choices,
			droneIndex: newDroneIndex,
			newDroneCount: player._pendingDroneUnlock
		});
		
		if (DEBUG_LEVELING_LOGS) {
			console.log(`[DRONE] Offering drone types to ${player.name}:`, choices.map(c => c.name).join(', '));
		}
		
		return true;
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
