/**
 * Upgrade System - Handles rolling upgrade choices and applying selections.
 */

import {
	UPGRADE_CATALOG,
	UPGRADES_BY_RARITY,
	RARITY,
	RARITY_WEIGHTS,
	applyUpgrade,
	getUpgradeStacks,
	initPlayerUpgrades,
	recalculateDerivedStats
} from './upgrades.js';

/**
 * Roll a rarity based on weights
 * @returns {string} 'basic' | 'rare' | 'legendary'
 */
function rollRarity() {
	const totalWeight = RARITY_WEIGHTS.basic + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.legendary;
	const roll = Math.random() * totalWeight;
	
	if (roll < RARITY_WEIGHTS.basic) {
		return RARITY.BASIC;
	} else if (roll < RARITY_WEIGHTS.basic + RARITY_WEIGHTS.rare) {
		return RARITY.RARE;
	} else {
		return RARITY.LEGENDARY;
	}
}

/**
 * Roll a random upgrade from a specific rarity pool
 * @param {string} rarity - The rarity to roll from
 * @param {Set<string>} excludeIds - Set of upgrade IDs to exclude (already picked)
 * @returns {object|null} The upgrade object or null if pool is empty
 */
function rollUpgradeFromRarity(rarity, excludeIds) {
	const pool = UPGRADES_BY_RARITY[rarity].filter(u => !excludeIds.has(u.id));
	if (pool.length === 0) return null;
	
	const index = Math.floor(Math.random() * pool.length);
	return pool[index];
}

/**
 * Roll 3 unique upgrade choices for a player
 * @param {object} player - The player object (used for context, not modified)
 * @returns {Array<object>} Array of 3 upgrade choices with id, name, rarity, description
 */
export function rollUpgradeChoices(player) {
	const choices = [];
	const pickedIds = new Set();
	
	for (let i = 0; i < 3; i++) {
		let upgrade = null;
		let attempts = 0;
		const maxAttempts = 10;
		
		while (!upgrade && attempts < maxAttempts) {
			const rarity = rollRarity();
			upgrade = rollUpgradeFromRarity(rarity, pickedIds);
			
			// If no upgrade available at this rarity, try a fallback
			if (!upgrade) {
				// Try other rarities in order: basic -> rare -> legendary
				for (const fallbackRarity of [RARITY.BASIC, RARITY.RARE, RARITY.LEGENDARY]) {
					upgrade = rollUpgradeFromRarity(fallbackRarity, pickedIds);
					if (upgrade) break;
				}
			}
			
			attempts++;
		}
		
		if (upgrade) {
			pickedIds.add(upgrade.id);
			
			// Calculate current stacks for this player
			const currentStacks = getUpgradeStacks(player, upgrade.id);
			
			choices.push({
				id: upgrade.id,
				name: upgrade.name,
				rarity: upgrade.rarity,
				currentStacks: currentStacks,
				description: upgrade.description(currentStacks + 1) // Show effect after picking
			});
		}
	}
	
	// If we somehow have less than 3, fill with any available upgrade
	while (choices.length < 3) {
		for (const upgrade of UPGRADE_CATALOG) {
			if (!pickedIds.has(upgrade.id)) {
				pickedIds.add(upgrade.id);
				const currentStacks = getUpgradeStacks(player, upgrade.id);
				choices.push({
					id: upgrade.id,
					name: upgrade.name,
					rarity: upgrade.rarity,
					currentStacks: currentStacks,
					description: upgrade.description(currentStacks + 1)
				});
				break;
			}
		}
		// Safety break if we've exhausted all upgrades (shouldn't happen with 13 upgrades)
		if (choices.length < 3 && pickedIds.size >= UPGRADE_CATALOG.length) {
			// Duplicate the first choice if absolutely necessary
			if (choices.length > 0) {
				choices.push({ ...choices[0] });
			}
			break;
		}
	}
	
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
