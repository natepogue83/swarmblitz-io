/**
 * Upgrade Catalog - Data-driven upgrade definitions for the level-up system.
 * 
 * Each upgrade has:
 * - id: unique string identifier
 * - name: display name
 * - rarity: 'basic' | 'rare' | 'legendary'
 * - description: function(stacks) returning description text
 * - apply: function(player, stacks) that recalculates derived stats
 * - onHit: optional function(player, target, damage, stacks) for on-hit effects
 */

export const RARITY = {
	BASIC: 'basic',
	RARE: 'rare',
	LEGENDARY: 'legendary'
};

export const RARITY_COLORS = {
	basic: '#9E9E9E',      // Gray
	rare: '#2196F3',       // Blue  
	legendary: '#FFD700'   // Gold
};

export const RARITY_WEIGHTS = {
	basic: 70,
	rare: 25,
	legendary: 5
};

/**
 * Initialize default derived stats on a player
 */
export function initPlayerUpgrades(player) {
	player.upgrades = {};
	player.derivedStats = {
		damageMult: 1.0,           // Multiplier for all damage
		attackSpeedMult: 1.0,      // Multiplier for attack speed (reduces cooldown)
		projSpeedMult: 1.0,        // Multiplier for projectile speed (unused currently)
		maxHpMult: 1.0,            // Multiplier for max HP
		moveSpeedMult: 1.0,        // Multiplier for movement speed
		pickupRadiusMult: 1.0,     // Multiplier for XP pickup radius
		armor: 0,                  // Flat damage reduction
		extraProjectiles: 0,       // Additional projectiles per attack
		lifeOnHitPercent: 0,       // Percent of max HP healed per hit
		critChance: 0,             // Crit chance (0-1)
		critMult: 2.0,             // Crit damage multiplier (fixed at 2x)
		enemySlowPercent: 0,       // Slow applied to enemies on hit (capped at 0.6)
		chainLightningBounces: 0,  // Number of chain lightning bounces
		adrenalSurgeDamage: 0      // Bonus damage from Adrenal Surge stacks
	};
	player.lifeOnHitCooldown = 0;  // Internal cooldown for life on hit
}

/**
 * Recalculate all derived stats based on current upgrade stacks
 */
export function recalculateDerivedStats(player) {
	const stacks = player.upgrades || {};
	const stats = player.derivedStats;
	
	// Reset to base values
	stats.damageMult = 1.0;
	stats.attackSpeedMult = 1.0;
	stats.projSpeedMult = 1.0;
	stats.maxHpMult = 1.0;
	stats.moveSpeedMult = 1.0;
	stats.pickupRadiusMult = 1.0;
	stats.armor = 0;
	stats.extraProjectiles = 0;
	stats.lifeOnHitPercent = 0;
	stats.critChance = 0;
	stats.enemySlowPercent = 0;
	stats.chainLightningBounces = 0;
	// Note: adrenalSurgeDamage is NOT reset - it accumulates permanently per level-up
	
	// Apply each upgrade
	for (const [upgradeId, count] of Object.entries(stacks)) {
		const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
		if (upgrade && upgrade.apply) {
			upgrade.apply(player, count);
		}
	}
	
	// Apply caps
	stats.enemySlowPercent = Math.min(stats.enemySlowPercent, 0.6); // Cap at 60%
	stats.critChance = Math.min(stats.critChance, 1.0); // Cap at 100%
}

/**
 * Apply an upgrade to a player (increment stack and recalculate)
 */
export function applyUpgrade(player, upgradeId) {
	if (!player.upgrades) {
		initPlayerUpgrades(player);
	}
	
	const currentStacks = player.upgrades[upgradeId] || 0;
	player.upgrades[upgradeId] = currentStacks + 1;
	
	// Special handling for Adrenal Surge - add permanent damage on each pickup
	if (upgradeId === 'adrenal_surge') {
		player.derivedStats.adrenalSurgeDamage += 0.05; // +5% permanent damage
	}
	
	recalculateDerivedStats(player);
	
	return player.upgrades[upgradeId];
}

/**
 * Get the current stack count for an upgrade
 */
export function getUpgradeStacks(player, upgradeId) {
	return (player.upgrades && player.upgrades[upgradeId]) || 0;
}

// ============================================================================
// UPGRADE CATALOG
// ============================================================================

export const UPGRADE_CATALOG = [
	// ===== BASIC UPGRADES (7) =====
	{
		id: 'damage_up',
		name: 'Damage Up',
		rarity: RARITY.BASIC,
		description: (stacks) => `+12% damage\nTotal: +${(stacks * 12)}%`,
		apply: (player, stacks) => {
			player.derivedStats.damageMult += stacks * 0.12;
		}
	},
	{
		id: 'attack_speed',
		name: 'Attack Speed',
		rarity: RARITY.BASIC,
		description: (stacks) => `+10% fire rate\nTotal: +${(stacks * 10)}%`,
		apply: (player, stacks) => {
			player.derivedStats.attackSpeedMult += stacks * 0.10;
		}
	},
	{
		id: 'projectile_speed',
		name: 'Proj. Speed',
		rarity: RARITY.BASIC,
		description: (stacks) => `+15% projectile velocity\nTotal: +${(stacks * 15)}%`,
		apply: (player, stacks) => {
			player.derivedStats.projSpeedMult += stacks * 0.15;
		}
	},
	{
		id: 'max_hp',
		name: 'Vitality',
		rarity: RARITY.BASIC,
		description: (stacks) => `+10% max HP\nTotal: +${(stacks * 10)}%`,
		apply: (player, stacks) => {
			player.derivedStats.maxHpMult += stacks * 0.10;
		}
	},
	{
		id: 'move_speed',
		name: 'Swift Feet',
		rarity: RARITY.BASIC,
		description: (stacks) => `+6% move speed\nTotal: +${(stacks * 6)}%`,
		apply: (player, stacks) => {
			player.derivedStats.moveSpeedMult += stacks * 0.06;
		}
	},
	{
		id: 'pickup_radius',
		name: 'Magnetism',
		rarity: RARITY.BASIC,
		description: (stacks) => `+20% XP pickup range\nTotal: +${(stacks * 20)}%`,
		apply: (player, stacks) => {
			player.derivedStats.pickupRadiusMult += stacks * 0.20;
		}
	},
	{
		id: 'armor',
		name: 'Armor',
		rarity: RARITY.BASIC,
		description: (stacks) => `+1 damage reduction\nTotal: ${stacks} armor`,
		apply: (player, stacks) => {
			player.derivedStats.armor += stacks;
		}
	},
	
	// ===== RARE UPGRADES (4) =====
	{
		id: 'multi_shot',
		name: 'Multi-Shot',
		rarity: RARITY.RARE,
		description: (stacks) => `+1 extra projectile\nTotal: +${stacks} projectiles`,
		apply: (player, stacks) => {
			player.derivedStats.extraProjectiles += stacks;
		}
	},
	{
		id: 'life_on_hit',
		name: 'Life Steal',
		rarity: RARITY.RARE,
		description: (stacks) => `Heal 1% max HP on hit\nTotal: ${stacks}% per hit`,
		apply: (player, stacks) => {
			player.derivedStats.lifeOnHitPercent += stacks * 0.01;
		}
	},
	{
		id: 'crit_chance',
		name: 'Critical Strike',
		rarity: RARITY.RARE,
		description: (stacks) => `+8% crit chance (2x dmg)\nTotal: ${(stacks * 8)}% crit`,
		apply: (player, stacks) => {
			player.derivedStats.critChance += stacks * 0.08;
		}
	},
	{
		id: 'enemy_slow',
		name: 'Frost Touch',
		rarity: RARITY.RARE,
		description: (stacks) => `Slow enemies 15% for 1.5s\nTotal: ${Math.min(stacks * 15, 60)}% (max 60%)`,
		apply: (player, stacks) => {
			player.derivedStats.enemySlowPercent += stacks * 0.15;
		}
	},
	
	// ===== LEGENDARY UPGRADES (2) =====
	{
		id: 'chain_lightning',
		name: 'Chain Lightning',
		rarity: RARITY.LEGENDARY,
		description: (stacks) => `Hits chain to +2 enemies\n70% dmg, ${stacks * 2} bounces`,
		apply: (player, stacks) => {
			player.derivedStats.chainLightningBounces += stacks * 2;
		}
	},
	{
		id: 'adrenal_surge',
		name: 'Adrenal Surge',
		rarity: RARITY.LEGENDARY,
		description: (stacks) => `+5% PERMANENT damage\nTotal: +${(stacks * 5)}% forever`,
		apply: (player, stacks) => {
			// adrenalSurgeDamage is handled separately in applyUpgrade
			// This apply just ensures the stat exists
		}
	}
];

// Create lookup maps for quick access
export const UPGRADES_BY_ID = {};
export const UPGRADES_BY_RARITY = {
	[RARITY.BASIC]: [],
	[RARITY.RARE]: [],
	[RARITY.LEGENDARY]: []
};

for (const upgrade of UPGRADE_CATALOG) {
	UPGRADES_BY_ID[upgrade.id] = upgrade;
	UPGRADES_BY_RARITY[upgrade.rarity].push(upgrade);
}
