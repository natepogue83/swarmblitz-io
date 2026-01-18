/**
 * Upgrade Knobs - Easy tuning for all upgrade values.
 * 
 * This file contains all the numerical values for upgrades in one place.
 * Adjust these values to balance the game without modifying the core upgrade logic.
 */

// ============================================================================
// RARITY SYSTEM
// ============================================================================

export const RARITY_WEIGHTS = {
	basic: 60,          // 60% chance for basic upgrades
	rare: 35,           // 32% chance for rare upgrades
	legendary: 10       // 8% chance for legendary upgrades
};

export const RARITY_LIMITS = {
	legendaryPerOffer: 1
};

export const RARITY_COLORS = {
	basic: '#249f33',      // Gray
	rare: '#2196F3',       // Blue  
	legendary: '#FFD700'   // Gold
};

// ============================================================================
// STAT CAPS
// ============================================================================

export const STAT_CAPS = {
	critChance: 1.0,            // Max 100% crit chance
	damageReduction: 0.75       // Max 75% damage reduction
};

// ============================================================================
// PROC COEFFICIENTS (On-hit proc scaling)
// ============================================================================
// These scale proc chances for secondary/area hits to avoid over-proccing.
export const PROC_COEFFICIENTS = {
	default: 1.0,
	rapidChainHit: 0.25,
	explosiveRounds: 0.25,
	chainLightning: 0.25,
	arcBarrage: 0.25,
	heatseekerDrones: 0.35,
	stickyCharge: 0.05,
	stickyChargeSplash: 0.05,
	electricChain: 0.45,      // Electric drone chain to nearby enemy
	shockwave: 0.3,           // Shockwave AoE hits
	acidPool: 0.15            // Acid pool tick damage
};

// ============================================================================
// DIMINISHING RETURNS
// ============================================================================

// Diminishing returns formula coefficient
// Higher value = faster diminishing (stacks become less effective sooner)
// First stack is always at 100% effectiveness (no diminishing)
// Formula for 2+ stacks: baseValue + baseValue * (stacks-1) / (1 + COEFFICIENT * (stacks-1))
export const DIMINISHING_COEFFICIENT = 0.1;

// ============================================================================
// BASIC TIER UPGRADES (Stackable foundation upgrades)
// ============================================================================

export const VITALITY = {
	flatHpPerStack: 30          // +25 max HP per stack
};

export const SWIFT_FEET = {
	speedPerStack: 0.08,        // +10% move speed per stack (with diminishing returns)
	usesDiminishing: true
};

export const ENDURANCE = {
	maxStaminaPerStack: 0.20,   // +20% max stamina per stack
	usesDiminishing: true
};

export const QUICK_RECOVERY = {
	staminaRegenPerStack: 1,  // +100% stamina regen per stack
	maxStacks: 1
};

export const MULTISHOT = {
	projectilesPerStack: 1,     // +1 projectile per stack
	projectileDelayMs: 80,      // Stagger extra shots for visual clarity
	damageDecay: 0.75,          // Each extra projectile deals 75% of previous
	spreadOffset: 18            // Lateral offset in pixels for extra shots
};

export const CRITICAL_STRIKE = {
	critChancePerStack: 0.08,   // +08% crit chance per stack
	critDamageMultiplier: 2.0,  // 2x damage on crit (base, not from this upgrade)
	maxStacks: 13
};

export const LIFE_STEAL = {
	lifeStealPerStack: 0.0075,	  // +.75% HP on hit per stack (with diminishing returns)
	usesDiminishing: true
};

export const SCAVENGER = {
	pickupRadiusBonus: 1.0,     // +100% pickup radius
	doubleDropChance: 0.15,     // 15% chance for double enemy drops
	maxStacks: 3
};

// NEW BASIC UPGRADES
export const BASE_DAMAGE = {
	damagePerStack: 0.10        // +10% base damage per stack
};

export const ATTACK_SPEED = {
	attackSpeedPerStack: 0.12,  // +12% attack speed per stack
	usesDiminishing: true
};

export const CRIT_DAMAGE = {
	critMultPerStack: 0.25      // +25% crit damage per stack (additive to base 2x)
};

export const CRIT_MULTIPLIER = {
	critMultPerStack: 0.08      // +10% crit damage per stack (additive to base 2x)
};

export const FOCUSED_FIRE = {
	damagePerHitOnSameTarget: 0.15,  // +10% damage per consecutive hit on same target
	maxStacks: 8,                     // Cap at +80% bonus
	decayTime: 1.0,                    // Stacks decay after 2s without hitting target
	usesDiminishing: true
};

export const PRECISION_ROUNDS = {
	minDistanceForBonus: 150,   // Minimum distance for bonus to apply
	maxDistanceBonus: 350,      // Distance at which max bonus is reached
	maxDamageBonus: 0.40        // +35% damage at max distance
};

// ============================================================================
// RARE TIER UPGRADES (Unique mechanics)
// ============================================================================

export const SECOND_WIND = {
	hpThreshold: 0.30,              // Triggers below 30% HP
	healPercent: 0.25,              // Heal 25% max HP over duration
	healDurationSeconds: 5,         // Heal duration
	cooldownSeconds: 30,            // 30 second cooldown
	maxStacks: 1
};

export const MARATHON = {
	staminaDrainReduction: 0.15,    // 20% slower stamina drain outside territory
	maxStacks: 3
};

export const SOUL_COLLECTOR = {
	killsPerHpBonus: 20,            // +1 max HP per 20 kills
	maxBonusHp: 60,                 // Cap at +60 HP
	maxStacks: 3
};

export const BERSERKER = {
	hpThreshold: 0.40,              // Activates below 50% HP
	attackSpeedBonus: 0.40,         // +50% attack speed when active
	damageBonus: 0.20,              // +25% damage when active
	maxStacks: 1
};

export const HUNTER = {
	enemyHpThreshold: 0.60,         // Activates vs enemies below 50% HP
	damageBonus: 0.20,              // +20% damage when active
	maxStacks: Infinity
};

export const TERRITORIAL = {
	damageBonus: 0.15,              // +35% damage while in territory
	maxStacks: Infinity
};

export const THORNS = {
	reflectPercent: 0.75,           // Reflect 75% of damage taken back to attacker
};

export const LAST_STAND = {
	hpThreshold: 0.35,              // Activates below 25% HP
	damageReduction: 0.30,          // Take 40% less damage when active
	maxStacks: 1
};

export const ADRENALINE = {
	speedBonus: 0.30,               // +20% move speed when triggered
	durationSeconds: 1.5,             // 3 second duration
	maxStacks: 1
};

export const MOMENTUM = {
	speedPerSecond: 0.10,           // +15% move speed per second outside territory
	maxSpeedBonus: 0.30,            // Cap at +45% bonus
	maxStacks: 3
};

// NEW RARE UPGRADES
export const STICKY_CHARGES = {
	chargesPerHit: 1,               // Apply 1 charge per hit
	maxChargesPerEnemy: 3,          // Max 5 charges on single enemy
	detonationDelay: .5,           // Detonate after 5 seconds
	damagePerCharge: 0.20,          // Each charge deals 10% of original hit damage
	explosionRadius: 75,            // 50 pixel explosion radius
	maxStacks: 1
};

export const BLEEDING_ROUNDS = {
	procChance: 0.15,              // 15% chance on hit to apply bleed
	damagePerStack: 0.5,            // Bleed damage per stack per tick
	durationSeconds: 3.0,           // Each stack lasts 3 seconds
	maxBleedStacks: 12,             // Max bleed stacks applied by this upgrade
	maxStacks: 8
};

export const MISSILE_POD = {
	procChance: 0.10,               // 10% chance to fire missile on hit
	missileDamagePercent: 0.40,     // Missile deals 40% of hit damage
	missileSpeed: 300,              // Missile speed in pixels/sec
	missileRadius: 5,               // Missile collision/visual size
	missileLifetime: 2.0,           // Missile expires after 3 seconds
};

export const HEATSEEKER_DRONES = {
	droneCount: 2,                  // 2 passive drones
	attackRange: 200,               // Drones attack enemies within 250 pixels
	attackCooldown: 0.5,            // Attack every 0.5 seconds
	damagePercent: 0.2,            // Each attack deals 15% of player's base damage
};

// ============================================================================
// LEGENDARY TIER UPGRADES (Game-changers and tradeoffs)
// ============================================================================

export const GLASS_CANNON = {
	damageBonus: 1.0,               // +100% damage
	maxHpPenalty: 0.50,             // -50% max HP
	sizeScaleMult: 0.70,            // 30% smaller
};

export const JUGGERNAUT = {
	maxHpBonus: 1.0,                // +100% max HP
	speedPenalty: 0.25,             // -25% move speed
	sizeScaleMult: 1.25,            // 25% bigger
};

export const EXECUTE = {
	hpThreshold: 0.20,              // Instant kill enemies below 20% HP
	maxStacks: 1
};

export const EXPLOSIVE_ROUNDS = {
	explosionDamagePercent: 0.20,   // 40% damage to nearby enemies
	explosionRadius: 75,            // 75 pixel radius
	maxStacks: 1
};

export const PHASE_SHIFT = {
	cooldownSeconds: 3,             // First hit every 3 seconds deals no damage
	maxStacks: 1
};

export const VAMPIRE = {
	healOnKillPercent: 0.004,        // Heal .4% max HP on kill
	disablesPassiveRegen: true,     // No passive HP regeneration
	maxStacks: 1
};

export const CHAIN_LIGHTNING = {
	bounceCount: 2,                 // Bounces to 2 nearby enemies
	bounceDamagePercent: 0.3,      // 20% damage per bounce
	bounceRange: 175,               // 150 pixel bounce range
};

// NEW LEGENDARY UPGRADES
export const ARC_BARRAGE = {
	burstInterval: 2,             // Burst every 2 seconds
	burstRadius: 350,               // 350 pixel radius around player
	burstDamagePercent: 2,       // 400% of player's base damage per burst
	maxEnemiesHit: 20,               // Max 20 enemies per burst
};

export const OVERCHARGE_CORE = {
	damageBonus: 0.60,              // +60% damage
	attackSpeedBonus: 0.40,         // +40% attack speed
	hpDrainPerSecond: 0.03,         // Lose 2% max HP per second
	minHpPercent: 0.10,             // Drain stops at 10% HP
	maxStacks: 1
};

// ============================================================================
// DRONE RANGE UPGRADES
// ============================================================================

export const EXTENDED_ANTENNAE = {
	rangePerStack: 0.10,            // +10% drone range per stack
	maxStacks: Infinity
};

export const SIGNAL_BOOSTERS = {
	rangePerStack: 0.15,            // +15% drone range per stack
	projectileLifetimePerStack: 0.1, // +10% projectile lifetime per stack
	maxStacks: Infinity
};

export const GET_AWAY = {
	damagePerEnemy: 0.02,           // +2% damage per enemy within drone range
	maxStacks: Infinity
};

// ============================================================================
// HELPER: Get all knobs as a single object (for debugging/inspector)
// ============================================================================

export const ALL_UPGRADE_KNOBS = {
	// System
	RARITY_WEIGHTS,
	RARITY_LIMITS,
	RARITY_COLORS,
	STAT_CAPS,
	DIMINISHING_COEFFICIENT,
	
	// Basic
	VITALITY,
	SWIFT_FEET,
	ENDURANCE,
	QUICK_RECOVERY,
	MULTISHOT,
	CRITICAL_STRIKE,
	LIFE_STEAL,
	SCAVENGER,
	BASE_DAMAGE,
	ATTACK_SPEED,
	CRIT_DAMAGE,
	FOCUSED_FIRE,
	PRECISION_ROUNDS,
	
	// Rare
	SECOND_WIND,
	MARATHON,
	SOUL_COLLECTOR,
	BERSERKER,
	HUNTER,
	TERRITORIAL,
	THORNS,
	LAST_STAND,
	ADRENALINE,
	MOMENTUM,
	STICKY_CHARGES,
	BLEEDING_ROUNDS,
	MISSILE_POD,
	HEATSEEKER_DRONES,
	
	// Legendary
	GLASS_CANNON,
	JUGGERNAUT,
	EXECUTE,
	EXPLOSIVE_ROUNDS,
	PHASE_SHIFT,
	VAMPIRE,
	CHAIN_LIGHTNING,
	ARC_BARRAGE,
	OVERCHARGE_CORE,
	
	// Drone Range
	EXTENDED_ANTENNAE,
	SIGNAL_BOOSTERS,
	GET_AWAY
};
