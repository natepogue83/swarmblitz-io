/**
 * Drone Types Catalog - Data-driven drone type definitions for the unlock system.
 * 
 * Each drone type has:
 * - id: unique string identifier
 * - name: display name
 * - description: short description of the drone's role
 * - color: hex color for visual distinction
 * - opacity: visual opacity of projectiles/effects (0.0 to 1.0, default 1.0)
 * - damageMult: multiplier for drone damage
 * - cooldownMult: multiplier for fire cooldown (lower = faster)
 * - rangeMult: multiplier for targeting range
 * - orbitRadiusMult: multiplier for orbit distance from player
 * - orbitSpeedMult: multiplier for orbit rotation speed
 * - attackType: visual style of attack ('bullet', 'laser', 'railgun', 'plasma', 'pulse')
 * - isHitscan: true = instant hit, false = traveling projectile
 * - projectileSpeed: speed of projectile (only for non-hitscan)
 * - projectileLifetime: max projectile lifetime in seconds (0 = use range-based lifetime)
 * - pierceCount: how many enemies the projectile can pierce (0 = no pierce)
 * - projectileSize: visual size of the projectile
 * - procCoefficient: scaling factor for on-hit proc chances
 * 
 * PASSIVE ABILITIES (unique per drone type):
 * - Assault: rampsTargetDamage - successive hits on same target deal more damage
 * - Rapid: chainHitsNearby - hits splash to nearby enemies for % damage
 * - Sniper: pierceDamageScaling - damage increases per enemy pierced
 * - Guardian: blackHolePull - projectile pulls enemies toward it
 * - Skirmisher: rampsFireRate - fire rate increases while continuously shooting
 * - Support: dropsHealPack - projectile drops heal pack on end-of-life
 * - Swarm: appliesBleed - hits apply stacking bleed DOT
 */

// Attack type definitions for projectile visuals
export const ATTACK_TYPES = {
	bullet: { name: 'Bullet', duration: 0.15, width: 4, isHitscan: false },
	laser: { name: 'Laser', duration: 0.06, width: 2, isHitscan: true },
	railgun: { name: 'Railgun', duration: 0.5, width: 8, isHitscan: false },
	plasma: { name: 'Plasma', duration: 0.4, width: 12, isHitscan: false },
	pulse: { name: 'Pulse', duration: 0.3, width: 6, isHitscan: false }
};

export const DRONE_TYPES = [
	{
		id: 'assault',
		name: 'Assault',
		description: 'Balanced fighter. Successive hits on same target deal more damage.',
		color: '#FF6B6B',
		opacity: 1.0,             // Full opacity
		damageMult: 1.25,
		cooldownMult: 1.00,       // ~0.5s base cooldown
		rangeMult: 1.00,
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'bullet',
		isHitscan: false,
		projectileSpeed: 400,     // pixels per second
		projectileLifetime: 0,    // seconds (0 = use range-based lifetime)
		pierceCount: 0,
		projectileSize: 4,
		procCoefficient: 1.0,
		// PASSIVE: Ramps damage on same target
		rampsTargetDamage: true,
		rampDamagePerStack: 0.25,   // +15% damage per stack
		rampMaxStacks: 6,           // Max 5 stacks (+75% damage)
		rampDecayTime: 2          // Stacks decay after 1.5s without hitting target
	},
	{
		id: 'rapid',
		name: 'Rapid',
		description: 'Hitscan laser beams. Hits splash to nearby enemies for 15% damage.',
		color: '#4ECDC4',
		opacity: 0.8,             // Slightly transparent lasers
		damageMult: 0.4,         // Much lower damage per hit
		cooldownMult: 0.4,       // Very fast fire rate (~8 shots/sec)
		rangeMult: 0.90,
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'laser',
		isHitscan: true,          // Instant hit
		projectileSpeed: 0,
		projectileLifetime: 0,
		pierceCount: 0,
		projectileSize: .25,
		procCoefficient: 0.5,
		// PASSIVE: Chain hits nearby enemies
		chainHitsNearby: true,
		chainHitPercent: 0.15,      // 15% of original damage
		chainHitRadius: 60          // Radius to splash damage
	},
	{
		id: 'sniper',
		name: 'Sniper',
		description: 'Heavy railgun. Damage increases with each enemy pierced.',
		color: '#9B59B6',
		opacity: 1.0,             // Full opacity for heavy shots
		damageMult: 1.5,         // High damage per shot
		cooldownMult: 2.50,       // Very slow fire (~0.8 shots/sec)
		rangeMult: 2.5,             // Extra long range
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'railgun',
		isHitscan: false,
		projectileSpeed: 500,     // Fast projectile
		projectileLifetime: 0,
		pierceCount: 10,           // Pierce through 3 enemies
		projectileSize: 15,
		procCoefficient: 1.0,
		// PASSIVE: Pierce damage scaling
		pierceDamageScaling: true,
		pierceDamageBonusPerEnemy: 0.10  // +10% damage per enemy already pierced
	},
	{
		id: 'guardian',
		name: 'Guardian',
		description: 'Slow plasma orbs. Sucks in nearby enemies like a black hole.',
		color: '#3498DB',
		opacity: 0.3,            // Slightly glowy/transparent plasma
		damageMult: 1.6,         // High damage
		cooldownMult: 2.5,       // Slow fire rate
		rangeMult: 1.2,           // Short range
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'plasma',
		isHitscan: false,
		projectileSpeed: 100,     // Slow, chunky projectile
		projectileLifetime: 2,
		pierceCount: 10,
		projectileSize: 14,
		procCoefficient: 0.8,
		// PASSIVE: Black hole pull
		blackHolePull: true,
		blackHolePullRadius: 100,    // Radius of pull effect
		blackHolePullStrength: 70  // Pull strength (pixels per second)
	},
	{
		id: 'skirmisher',
		name: 'Skirmisher',
		description: 'Fast bullets that pierce 1 enemy. Fire rate ramps up to 2x while shooting.',
		color: '#F39C12',
		opacity: 1.0,             // Full opacity
		damageMult: 0.75,
		cooldownMult: 0.55,       // Fast fire rate
		rangeMult: 1.00,
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'bullet',
		isHitscan: false,
		projectileSpeed: 300,     // Fast projectiles
		projectileLifetime: 0,
		pierceCount: 1,
		projectileSize: 5,
		procCoefficient: 0.7,
		// PASSIVE: Ramping fire rate
		rampsFireRate: true,
		fireRateRampMax: 2.0,       // Max 2x fire rate
		fireRateRampTime: 3.0,      // Time to reach max ramp (seconds)
		fireRateResetTime: 0.6      // Time without shooting to reset ramp
	},
	{
		id: 'support',
		name: 'Support',
		description: 'Pulse beams that slow enemies. Drops heal packs on projectile death.',
		color: '#2ECC71',
		opacity: 0.4,             // More transparent pulse effect
		damageMult: 0.65,
		cooldownMult: 1.75,
		rangeMult: 1.30,          // Long range support
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'pulse',
		isHitscan: false,          // Not hitscan - projectile
		projectileSpeed: 150,      // Moderate speed projectile
		projectileLifetime: 3,
		pierceCount: 8,
		projectileSize: 15,
		procCoefficient: 0.9,
		appliesSlow: true,        // Special: applies slow debuff
		slowAmount: 0.60,         // 60% slow
		slowDuration: 1.5,        // Slow lasts 1.5 seconds
		// PASSIVE: Drop heal packs
		dropsHealPack: true,
		healPackPercent: 0.05,      // 5% of damage dealt becomes healing
		healPackMin: 10,            // Minimum heal amount
		healPackMax: 200            // Maximum heal amount
	},
	{
		id: 'swarm',
		name: 'Swarm',
		description: 'Tiny hitscan lasers. Applies stacking bleed damage over time.',
		color: '#E74C3C',
		opacity: 0.6,             // More transparent for swarm effect
		damageMult: 0.125,         // Very low damage per hit
		cooldownMult: 0.10,       // Extremely fast (~13 shots/sec)
		rangeMult: 0.85,          // Shorter range
		orbitRadiusMult: .8,
		orbitSpeedMult: .8,
		attackType: 'laser',
		isHitscan: true,          // Instant hit
		projectileSpeed: 0,
		projectileLifetime: 0,
		pierceCount: 0,
		projectileSize: 1.25,
		procCoefficient: 0.4,
		// PASSIVE: Stacking bleed
		appliesBleed: true,
		bleedDamagePerStack: 1,     // 1 damage per second per stack
		bleedDuration: 2.0,         // Each stack lasts 2 seconds (refreshed on hit)
		bleedMaxStacks: 10          // Max 10 stacks (10 DPS)
	}
];

// Index by ID for quick lookup
export const DRONE_TYPES_BY_ID = {};
for (const type of DRONE_TYPES) {
	DRONE_TYPES_BY_ID[type.id] = type;
}

/**
 * Get a drone type by ID
 * @param {string} typeId - The drone type ID
 * @returns {object|null} The drone type object or null if not found
 */
export function getDroneType(typeId) {
	return DRONE_TYPES_BY_ID[typeId] || null;
}

/**
 * Get the default drone type (Assault)
 * @returns {object} The default drone type
 */
export function getDefaultDroneType() {
	return DRONE_TYPES_BY_ID['assault'];
}

/**
 * Roll 3 unique drone type choices for a player
 * @param {Set<string>} excludeIds - Optional set of type IDs to exclude (already owned types, etc.)
 * @returns {Array<object>} Array of 3 drone type choices
 */
export function rollDroneChoices(excludeIds = new Set()) {
	const choices = [];
	const pickedIds = new Set();
	
	// Get available types (exclude any specified)
	const availableTypes = DRONE_TYPES.filter(t => !excludeIds.has(t.id));
	
	// Shuffle available types
	const shuffled = [...availableTypes].sort(() => Math.random() - 0.5);
	
	// Pick up to 3 unique types
	for (const type of shuffled) {
		if (choices.length >= 3) break;
		if (pickedIds.has(type.id)) continue;
		
		pickedIds.add(type.id);
		choices.push({
			id: type.id,
			name: type.name,
			description: type.description,
			color: type.color,
			attackType: type.attackType,
			isHitscan: type.isHitscan,
			// Include stat previews for UI
			stats: {
				damageMult: type.damageMult,
				cooldownMult: type.cooldownMult,
				rangeMult: type.rangeMult,
				orbitRadiusMult: type.orbitRadiusMult,
				orbitSpeedMult: type.orbitSpeedMult
			}
		});
	}
	
	// If we have fewer than 3 (shouldn't happen with 7 types), fill with duplicates
	while (choices.length < 3 && DRONE_TYPES.length > 0) {
		const randomType = DRONE_TYPES[Math.floor(Math.random() * DRONE_TYPES.length)];
		choices.push({
			id: randomType.id,
			name: randomType.name,
			description: randomType.description,
			color: randomType.color,
			attackType: randomType.attackType,
			isHitscan: randomType.isHitscan,
			stats: {
				damageMult: randomType.damageMult,
				cooldownMult: randomType.cooldownMult,
				rangeMult: randomType.rangeMult,
				orbitRadiusMult: randomType.orbitRadiusMult,
				orbitSpeedMult: randomType.orbitSpeedMult
			}
		});
	}
	
	return choices;
}

/**
 * Apply drone type multipliers to base drone stats
 * @param {object} drone - The drone object to modify
 * @param {string} typeId - The drone type ID to apply
 * @param {object} baseStats - Base stats from config (damage, cooldown, range, orbitRadius, orbitSpeed)
 */
export function applyDroneType(drone, typeId, baseStats) {
	const type = getDroneType(typeId) || getDefaultDroneType();
	
	drone.typeId = type.id;
	drone.typeName = type.name;
	drone.typeColor = type.color;
	drone.opacity = type.opacity ?? 1.0;  // Default to full opacity
	drone.attackType = type.attackType;
	drone.isHitscan = type.isHitscan;
	drone.projectileSpeed = type.projectileSpeed;
	drone.pierceCount = type.pierceCount;
	drone.projectileSize = type.projectileSize;
	drone.procCoefficient = type.procCoefficient ?? 1.0;
	
	// Special properties - Slow
	if (type.appliesSlow) {
		drone.appliesSlow = true;
		drone.slowAmount = type.slowAmount;
		drone.slowDuration = type.slowDuration ?? 1.5;
	}
	
	// PASSIVE: Assault - Ramps target damage
	if (type.rampsTargetDamage) {
		drone.rampsTargetDamage = true;
		drone.rampDamagePerStack = type.rampDamagePerStack ?? 0.15;
		drone.rampMaxStacks = type.rampMaxStacks ?? 5;
		drone.rampDecayTime = type.rampDecayTime ?? 1.5;
	}
	
	// PASSIVE: Rapid - Chain hits nearby
	if (type.chainHitsNearby) {
		drone.chainHitsNearby = true;
		drone.chainHitPercent = type.chainHitPercent ?? 0.15;
		drone.chainHitRadius = type.chainHitRadius ?? 60;
	}
	
	// PASSIVE: Sniper - Pierce damage scaling
	if (type.pierceDamageScaling) {
		drone.pierceDamageScaling = true;
		drone.pierceDamageBonusPerEnemy = type.pierceDamageBonusPerEnemy ?? 0.25;
	}
	
	// PASSIVE: Guardian - Black hole pull
	if (type.blackHolePull) {
		drone.blackHolePull = true;
		drone.blackHolePullRadius = type.blackHolePullRadius ?? 80;
		drone.blackHolePullStrength = type.blackHolePullStrength ?? 120;
	}
	
	// PASSIVE: Skirmisher - Ramping fire rate
	if (type.rampsFireRate) {
		drone.rampsFireRate = true;
		drone.fireRateRampMax = type.fireRateRampMax ?? 2.0;
		drone.fireRateRampTime = type.fireRateRampTime ?? 3.0;
		drone.fireRateResetTime = type.fireRateResetTime ?? 0.6;
		drone.fireRateRampProgress = 0; // Current ramp progress (0-1)
		drone.timeSinceLastShot = 0;    // Time since last shot
	}
	
	// PASSIVE: Support - Drops heal packs
	if (type.dropsHealPack) {
		drone.dropsHealPack = true;
		drone.healPackPercent = type.healPackPercent ?? 0.05;
		drone.healPackMin = type.healPackMin ?? 10;
		drone.healPackMax = type.healPackMax ?? 200;
	}
	
	// PASSIVE: Swarm - Stacking bleed
	if (type.appliesBleed) {
		drone.appliesBleed = true;
		drone.bleedDamagePerStack = type.bleedDamagePerStack ?? 2;
		drone.bleedDuration = type.bleedDuration ?? 2.0;
		drone.bleedMaxStacks = type.bleedMaxStacks ?? 50;
	}
	
	// Apply multipliers to base stats
	drone.damageMult = type.damageMult;
	drone.cooldownMult = type.cooldownMult;
	drone.rangeMult = type.rangeMult;
	drone.orbitRadiusMult = type.orbitRadiusMult;
	drone.orbitSpeedMult = type.orbitSpeedMult;
	
	// Calculate effective stats
	if (baseStats) {
		drone.range = (baseStats.range || 200) * type.rangeMult;
		drone.orbitRadius = (baseStats.orbitRadius || 55) * type.orbitRadiusMult;
	}
	
	return drone;
}
