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
		maxHp: 25,
		speed: 75,
		contactDamage: 8,
		xpDropValue: 3,
		spawnWeight: 50,     // Higher = more common
		color: "rgba(200, 60, 60, 0.9)",
		outline: "rgba(90, 20, 20, 0.9)"
	},
	charger: {
		unlockTime: 15,      // Unlocks at 15 seconds
		radius: 12,
		maxHp: 30,
		speed: 55,           // Base speed (slower), but charges fast
		contactDamage: 15,
		chargeSpeed: 200,    // Speed when charging
		chargeCooldown: 3,   // Seconds between charges
		chargeDistance: 180, // Distance to trigger charge
		xpDropValue: 4,
		spawnWeight: 30,
		color: "rgba(255, 140, 0, 0.9)",
		outline: "rgba(140, 70, 0, 0.9)"
	},
	tank: {
		unlockTime: 35,      // Unlocks at 35 seconds (15+20)
		radius: 18,
		maxHp: 120,
		speed: 55,           // Very slow
		contactDamage: 20,
		xpDropValue: 10,
		spawnWeight: 15,
		color: "rgba(100, 100, 180, 0.9)",
		outline: "rgba(40, 40, 100, 0.9)"
	},
	swarm: {
		unlockTime: 60,      // Unlocks at 60 seconds (35+25)
		radius: 6,
		maxHp: 5,
		speed: 200,           // Fast
		contactDamage: 6,
		xpDropValue: 1,
		spawnWeight: 60,     // Very common when unlocked
		color: "rgba(150, 220, 80, 0.9)",
		outline: "rgba(70, 120, 30, 0.9)"
	},
	sniper: {
		unlockTime: 90,      // Unlocks at 90 seconds (60+30)
		radius: 9,
		maxHp: 20,
		speed: 60,           // Moves to maintain distance
		contactDamage: 5,
		preferredDistance: 200,  // Distance it tries to maintain from player
		xpDropValue: 10,
		spawnWeight: 20,
		color: "rgba(180, 60, 180, 0.9)",
		outline: "rgba(90, 20, 90, 0.9)"
	}
};

// ============================================================================
// BOSS TYPE DEFINITIONS
// ============================================================================

export const BOSS_TYPES = {
	titan: {
		// Giant slow boss with massive HP
		radius: 40,
		maxHp: 1500,
		speed: 80,
		contactDamage: 45,
		xpDropValue: 50,
		spawnWeight: 40,
		color: "rgba(80, 80, 80, 0.95)",
		outline: "rgba(40, 40, 40, 0.95)"
	},
	berserker: {
		// Medium boss that charges repeatedly
		radius: 28,
		maxHp: 750,
		speed: 110,
		contactDamage: 25,
		chargeSpeed: 250,
		chargeCooldown: 2,
		chargeDistance: 250,
		xpDropValue: 50,
		spawnWeight: 35,
		color: "rgba(220, 50, 50, 0.95)",
		outline: "rgba(120, 20, 20, 0.95)"
	},
	summoner: {
		// Boss that spawns minions
		radius: 32,
		maxHp: 1100,
		speed: 125,
		contactDamage: 15,
		summonCooldown: 4,    // Seconds between summons
		summonCount: 3,       // Enemies spawned per summon
		preferredDistance: 300, // Tries to stay away
		xpDropValue: 50,
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
	maxPerType: 50
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
		startTime: 0,
		perMinute: 0.64,
		exponent: 1.6,
		maxMult: 9001.0
	},
	damage: {
		enabled: true,
		startTime: 0,
		perMinute: 0.15,
		exponent: 1.6,
		maxMult: 30.0
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
