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
		maxHp: 50,
		speed: 55,
		contactDamage: 8,
		xpDropValue: 1,
		spawnWeight: 50      // Higher = more common
	},
	charger: {
		unlockTime: 15,      // Unlocks at 15 seconds
		radius: 12,
		maxHp: 25,
		speed: 45,           // Base speed (slower), but charges fast
		contactDamage: 15,
		chargeSpeed: 200,    // Speed when charging
		chargeCooldown: 3,   // Seconds between charges
		chargeDistance: 180, // Distance to trigger charge
		xpDropValue: 2,
		spawnWeight: 30
	},
	tank: {
		unlockTime: 35,      // Unlocks at 35 seconds (15+20)
		radius: 18,
		maxHp: 100,
		speed: 30,           // Very slow
		contactDamage: 20,
		xpDropValue: 4,
		spawnWeight: 15
	},
	swarm: {
		unlockTime: 60,      // Unlocks at 60 seconds (35+25)
		radius: 6,
		maxHp: 8,
		speed: 85,           // Fast
		contactDamage: 6,
		xpDropValue: 1,
		spawnWeight: 60      // Very common when unlocked
	},
	sniper: {
		unlockTime: 90,      // Unlocks at 90 seconds (60+30)
		radius: 9,
		maxHp: 20,
		speed: 40,           // Moves to maintain distance
		contactDamage: 5,
		preferredDistance: 200,  // Distance it tries to maintain from player
		xpDropValue: 10,
		spawnWeight: 20
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
		speed: 20,
		contactDamage: 35,
		xpDropValue: 50,
		spawnWeight: 40
	},
	berserker: {
		// Medium boss that charges repeatedly
		radius: 28,
		maxHp: 750,
		speed: 35,
		contactDamage: 25,
		chargeSpeed: 250,
		chargeCooldown: 2,
		chargeDistance: 250,
		xpDropValue: 50,
		spawnWeight: 35
	},
	summoner: {
		// Boss that spawns minions
		radius: 32,
		maxHp: 1100,
		speed: 25,
		contactDamage: 15,
		summonCooldown: 4,    // Seconds between summons
		summonCount: 3,       // Enemies spawned per summon
		preferredDistance: 300, // Tries to stay away
		xpDropValue: 50,
		spawnWeight: 25
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
// TIME-BASED ENEMY SCALING
// ============================================================================

export const ENEMY_SCALING = {
	// Applies to new spawns based on run time (in seconds).
	// Multiplier = 1 + (minutesSinceStart * perMinute), clamped to maxMult.
	// Baseline: keep pace with player power growth without runaway stats.
	// Example: after 10 minutes, hp = 1 + (10 * 0.18) = 2.8x (clamped).
	// Damage is intentionally slower to reduce sudden difficulty spikes.
	hp: {
		enabled: true,
		startTime: 0,
		perMinute: .5,
		maxMult: 10.0
	},
	damage: {
		enabled: true,
		startTime: 0,
		perMinute: 0.15,
		maxMult: 5.0
	}
};
