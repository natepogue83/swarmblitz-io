/**
 * Enemy Knobs - Easy tuning for all enemy values.
 *
 * Adjust enemy stats, XP drops, and time-based scaling here without changing
 * core enemy logic.
 */

// ============================================================================
// ENEMY TYPE DEFINITIONS
// ============================================================================

// Enemy type definitions with their stats and unlock times
// Unlock schedule: 0s, 15s, 35s (15+20), 60s (35+25), 90s (60+30)
export const ENEMY_TYPES = {
	basic: {
		unlockTime: 0,       // Available from start
		radius: 10,
		maxHp: 20,
		speed: 75,
		contactDamage: 10,
		xpDropValue: 2.5,
		spawnWeight: 50,     // Higher = more common
		color: "rgba(200, 60, 60, 0.9)",
		outline: "rgba(90, 20, 20, 0.9)"
	},
	charger: {
		unlockTime: 20,      // Unlocks at 15 seconds
		radius: 12,
		maxHp: 30,
		speed: 55,           // Base speed (slower), but charges fast
		contactDamage: 15,
		chargeSpeed: 225,  // Speed when charging
		chargeCooldown: 2.5,   // Seconds between charges
		chargeDistance: 110,// Distance to trigger charge
		xpDropValue: 3.5,
		spawnWeight: 25,
		color: "rgba(255, 140, 0, 0.9)",
		outline: "rgba(140, 70, 0, 0.9)"
	},
	tank: {
		unlockTime: 45,      // Unlocks at 35 seconds (15+20)
		radius: 18,
		maxHp: 80,
		speed: 45,           // Very slow
		contactDamage: 20,
		swarmBurstCount: 2,   // Shoots out swarm enemies
		swarmBurstCooldown: 8, // Seconds between bursts
		swarmBurstSpread: 24,  // Spawn spread radius
		xpDropValue: 10,
		spawnWeight: 5,
		color: "rgba(100, 100, 180, 0.9)",
		outline: "rgba(40, 40, 100, 0.9)"
	},
	swarm: {
		unlockTime: 60,      // Unlocks at 60 seconds (35+25)
		radius: 6,
		maxHp: 2,
		speed: 200,           // Fast
		contactDamage: 6,
		swarmSpawnCount: 2,   // Spawn in large swarms
		swarmSpawnSpread: 28, // Cluster spread radius
		chaseRampSeconds: 12,  // Seconds to reach cap speed
		chaseSpeedCapMult: 1.10, // 101% of player speed
		xpDropValue: 1,
		spawnWeight: 30,     // Very common when unlocked
		color: "rgba(150, 220, 80, 0.9)",
		outline: "rgba(70, 120, 30, 0.9)"
	},
	sniper: {
		unlockTime: 90,      // Unlocks at 90 seconds (60+30)
		radius: 15,
		maxHp: 20,
		speed: 60,          // Moves to maintain distance
		contactDamage: 5,
		healRadius: 100,
		healAmount: 5,
		healPercent: 0.10,
		healCooldown: 2,
		maxCount: 3,
		minSeparation: 1000,
		preferredDistance: 150,// Distance it tries to maintain from player
		xpDropValue: 10,
		spawnWeight: 15,
		color: "rgba(220, 245, 255, 0.95)",
		outline: "rgba(30, 140, 80, 0.95)"
	}
};

// ============================================================================
// BOSS TYPE DEFINITIONS
// ============================================================================

export const BOSS_TYPES = {
	titan: {
		// Giant slow boss with massive HP
		radius: 40,
		maxHp: 450,
		speed: 50,
		contactDamage: 45,
		xpDropValue: 25,
		spawnWeight: 40,
		color: "rgba(80, 80, 80, 0.95)",
		outline: "rgba(40, 40, 40, 0.95)"
	},
	berserker: {
		// Medium boss that charges repeatedly
		radius: 28,
		maxHp: 300,
		speed: 75,
		contactDamage: 25,
		chargeSpeed: 250,
		chargeCooldown: 2,
		chargeDistance: 3250,
		xpDropValue: 25,
		spawnWeight: 35,
		color: "rgba(220, 50, 50, 0.95)",
		outline: "rgba(120, 20, 20, 0.95)"
	},
	summoner: {
		// Boss that spawns minions
		radius: 32,
		maxHp: 250,
		speed: 65,
		contactDamage: 15,
		summonCooldown: 3,    // Seconds between summons
		summonCount: 2,       // Base enemies per summon (scales with minutes)+1 per minute
		preferredDistance: 300, // Tries to stay away
		xpDropValue: 25,
		spawnWeight: 25,
		color: "rgba(100, 50, 150, 0.95)",
		outline: "rgba(50, 20, 80, 0.95)"
	}
};

// ============================================================================
// XP DROP DEFAULTS
// ============================================================================

export const ENEMY_XP_DROP = {
	defaultValue: 1
};

// ============================================================================
// GLOBAL SPAWN RATE
// ============================================================================

export const ENEMY_SPAWN_RATE = {
	// Global multiplier for enemy spawns. 1 = default, >1 = more spawns.
	multiplier: .7
};

// ============================================================================
// SPAWN LIMITS
// ============================================================================

export const ENEMY_SPAWN_LIMITS = {
	// Maximum number of enemies of each type that can be alive at once.
	// Prevents performance issues from excessive enemy buildup.
	maxPerType: 40
};

// ============================================================================
// TIME-BASED ENEMY SCALING
// ============================================================================

export const ENEMY_SCALING = {
	// Applies to new spawns based on run time (in seconds).
	// Multiplier = (1 + minutesSinceStart * perMinute) ^ exponent, clamped to maxMult.
	// Exponential curve (^1.7) for aggressive late-game scaling.
	// Example: after 10 min with perMinute=0.25, linear=3.5, actual=3.5^1.7 ≈ 8.4x
	// Damage is slightly slower but still aggressive (^1.6).
	hp: {
		enabled: true,
		startTime: 30,
		perMinute: 0.61,
		exponent: 1.55,
		maxMult: 9001.0
	},
	damage: {
		enabled: true,
		startTime: 30,
		perMinute: 0.25,
		exponent: 1.6,
		maxMult: 99999
	},
	speed: {
		enabled: true,
		startTime: 0,
		perMinute: 0.05, // ~25% faster at 5 minutes
		exponent: 1.0,
		softCap: 2,
		softCapFalloff: 0.35,
		maxMult: 2.5
	},
	// Extra "late-game ramp" that kicks in after a certain time
	lateGameRamp: {
		enabled: true,
		startMinute: 2,
		exponentRampPerMinute: 0.05 // Adds to the exponent every minute after startMinute
	}
};

// ============================================================================
// TIME-BASED ENEMY TYPE WEIGHTING
// ============================================================================

export const ENEMY_TYPE_WEIGHTING = {
	// Boost spawn weights for harder types over time (unlocked types only).
	// bonus = min(maxBonus, minutes * perMinute * difficultyFactor)
	// finalWeight = baseWeight * (1 + bonus)
	enabled: true,
	perMinute: 0.25,
	maxBonus: 1.5
};
