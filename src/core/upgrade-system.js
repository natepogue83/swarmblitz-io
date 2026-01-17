/**
 * Upgrade System - Handles rolling upgrade choices and applying selections.
 * Filters out upgrades that are already at max stacks.
 */

import {
	UPGRADE_CATALOG,
	UPGRADES_BY_RARITY,
	UPGRADES_BY_ID,
	UPGRADE_ICONS,
	RARITY,
	RARITY_WEIGHTS,
	RARITY_LIMITS,
	applyUpgrade,
	getUpgradeStacks,
	initPlayerUpgrades,
	recalculateDerivedStats
} from './upgrades.js';

/**
 * Roll a rarity based on weights (60% basic, 32% rare, 8% legendary)
 * @returns {string} 'basic' | 'rare' | 'legendary'
 */
function rollRarity(allowLegendary = true) {
	const basicWeight = RARITY_WEIGHTS.basic;
	const rareWeight = RARITY_WEIGHTS.rare;
	const legendaryWeight = allowLegendary ? RARITY_WEIGHTS.legendary : 0;
	const totalWeight = basicWeight + rareWeight + legendaryWeight;
	const roll = Math.random() * totalWeight;
	
	if (roll < basicWeight) {
		return RARITY.BASIC;
	} else if (roll < basicWeight + rareWeight) {
		return RARITY.RARE;
	} else {
		return allowLegendary ? RARITY.LEGENDARY : RARITY.RARE;
	}
}

/**
 * Check if a player can pick up more of this upgrade
 * @param {object} player - The player object
 * @param {object} upgrade - The upgrade object
 * @returns {boolean} True if player can pick this upgrade
 */
function canPickUpgrade(player, upgrade) {
	const currentStacks = getUpgradeStacks(player, upgrade.id);
	return currentStacks < upgrade.maxStacks;
}

/**
 * Roll a random upgrade from a specific rarity pool
 * Filters out:
 * - Upgrades already picked this roll (excludeIds)
 * - Upgrades at max stacks for this player
 * 
 * @param {string} rarity - The rarity to roll from
 * @param {Set<string>} excludeIds - Set of upgrade IDs to exclude (already picked this roll)
 * @param {object} player - The player object (to check max stacks)
 * @returns {object|null} The upgrade object or null if pool is empty
 */
function rollUpgradeFromRarity(rarity, excludeIds, player) {
	const pool = UPGRADES_BY_RARITY[rarity].filter(u => 
		!excludeIds.has(u.id) && canPickUpgrade(player, u)
	);
	if (pool.length === 0) return null;
	
	const index = Math.floor(Math.random() * pool.length);
	return pool[index];
}

/**
 * Get all available upgrades for a player (not maxed)
 * @param {object} player - The player object
 * @returns {Array<object>} Array of available upgrades
 */
function getAvailableUpgrades(player) {
	return UPGRADE_CATALOG.filter(u => canPickUpgrade(player, u));
}

/**
 * Roll 3 unique upgrade choices for a player
 * @param {object} player - The player object (used for context, not modified)
 * @returns {Array<object>} Array of 3 upgrade choices with id, name, rarity, description
 */
export function rollUpgradeChoices(player) {
	const choices = [];
	const pickedIds = new Set();
	let legendaryPicked = 0;
	const maxLegendaryPerOffer = RARITY_LIMITS?.legendaryPerOffer ?? Infinity;
	
	// Check how many upgrades are available
	const availableUpgrades = getAvailableUpgrades(player);
	const maxChoices = Math.min(3, availableUpgrades.length);
	
	for (let i = 0; i < maxChoices; i++) {
		let upgrade = null;
		let attempts = 0;
		const maxAttempts = 20;
		
		while (!upgrade && attempts < maxAttempts) {
			const allowLegendary = legendaryPicked < maxLegendaryPerOffer;
			const rarity = rollRarity(allowLegendary);
			upgrade = rollUpgradeFromRarity(rarity, pickedIds, player);
			
			// If no upgrade available at this rarity, try a fallback
			if (!upgrade) {
				// Try other rarities in order: basic -> rare -> legendary
				const fallbackRarities = allowLegendary
					? [RARITY.BASIC, RARITY.RARE, RARITY.LEGENDARY]
					: [RARITY.BASIC, RARITY.RARE];
				for (const fallbackRarity of fallbackRarities) {
					upgrade = rollUpgradeFromRarity(fallbackRarity, pickedIds, player);
					if (upgrade) break;
				}
			}
			
			attempts++;
		}
		
		if (upgrade) {
			pickedIds.add(upgrade.id);
			if (upgrade.rarity === RARITY.LEGENDARY) {
				legendaryPicked += 1;
			}
			
			// Calculate current stacks for this player
			const currentStacks = getUpgradeStacks(player, upgrade.id);
			
			choices.push({
				id: upgrade.id,
				name: upgrade.name,
				rarity: upgrade.rarity,
				maxStacks: upgrade.maxStacks,
				currentStacks: currentStacks,
				icon: UPGRADE_ICONS[upgrade.id] || "generic",
				description: upgrade.description(currentStacks + 1) // Show effect after picking
			});
		}
	}
	
	// If we still need more choices and have available upgrades, fill from remaining
	if (choices.length < 3) {
		for (const upgrade of availableUpgrades) {
			if (!pickedIds.has(upgrade.id)) {
				pickedIds.add(upgrade.id);
				const currentStacks = getUpgradeStacks(player, upgrade.id);
				choices.push({
					id: upgrade.id,
					name: upgrade.name,
					rarity: upgrade.rarity,
					maxStacks: upgrade.maxStacks,
					currentStacks: currentStacks,
					icon: UPGRADE_ICONS[upgrade.id] || "generic",
					description: upgrade.description(currentStacks + 1)
				});
				if (choices.length >= 3) break;
			}
		}
	}
	
	// If we STILL have less than 3 (player has almost all upgrades maxed)
	// This is fine - just return what we have
	
	return choices;
}

/**
 * Apply a selected upgrade to a player
 * @param {object} player - The player object
 * @param {string} upgradeId - The ID of the upgrade to apply
 * @returns {number} The new stack count for this upgrade
 */
export function selectUpgrade(player, upgradeId) {
	// Initialize upgrades if not present
	if (!player.upgrades || !player.derivedStats) {
		initPlayerUpgrades(player);
	}
	
	return applyUpgrade(player, upgradeId);
}

/**
 * Get serializable upgrade state for networking
 * @param {object} player - The player object
 * @returns {object} Serializable upgrade state
 */
export function serializeUpgrades(player) {
	return {
		upgrades: player.upgrades || {},
		derivedStats: player.derivedStats || {}
	};
}

// Re-export for convenience
export { initPlayerUpgrades, recalculateDerivedStats, getUpgradeStacks };
