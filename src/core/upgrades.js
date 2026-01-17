/**
 * Upgrade Catalog - Complete overhaul with RoR2/Isaac-style upgrades.
 * 
 * Each upgrade has:
 * - id: unique string identifier
 * - name: display name
 * - rarity: 'basic' | 'rare' | 'legendary'
 * - maxStacks: 1 for unique, Infinity for stackable
 * - description: function(stacks) returning description text
 * - apply: function(player, stacks) that sets derived stats
 * 
 * NOTE: All numerical values are defined in upgrade-knobs.js for easy tuning.
 */

import { consts } from "../../config.js";
import * as KNOBS from "./upgrade-knobs.js";

export const RARITY = {
	BASIC: 'basic',
	RARE: 'rare',
	LEGENDARY: 'legendary'
};

// Re-export from knobs for backwards compatibility
export const RARITY_COLORS = KNOBS.RARITY_COLORS;
export const RARITY_WEIGHTS = KNOBS.RARITY_WEIGHTS;
export const RARITY_LIMITS = KNOBS.RARITY_LIMITS;

// Upgrade icons (canvas-drawn in UI)
export const UPGRADE_ICONS = {
	vitality: "heart",
	swift_feet: "boot",
	endurance: "bolt",
	quick_recovery: "regen",
	multishot: "multi",
	critical_strike: "crosshair",
	life_steal: "droplet",
	scavenger: "magnet",
	second_wind: "wind",
	marathon: "headband",
	soul_collector: "skull",
	berserker: "rage",
	hunter: "eye",
	territorial: "flag",
	thorns: "spikes",
	last_stand: "shield",
	adrenaline: "spark",
	momentum: "trail",
	glass_cannon: "glass",
	juggernaut: "helm",
	execute: "skull_x",
	explosive_rounds: "explosion",
	phase_shift: "phase",
	vampire: "fangs",
	chain_lightning: "chain",
	// New upgrades
	base_damage: "sword",
	attack_speed: "rapid",
	crit_damage: "crit_x",
	crit_multiplier: "crit_x",
	focused_fire: "target",
	precision_rounds: "scope",
	sticky_charges: "bomb",
	bleeding_rounds: "droplet",
	missile_pod: "rocket",
	heatseeker_drones: "drone",
	arc_barrage: "burst",
	overcharge_core: "core",
	// Drone range upgrades
	extended_antennae: "scope",
	signal_boosters: "scope",
	get_away: "scope"
};

/**
 * Diminishing returns formula for stackable upgrades
 * First stack is unaffected (100% efficiency)
 * Subsequent stacks have diminishing returns applied
 * At 2 stacks: ~91% for 2nd, 5 stacks: ~71% for 5th, 10 stacks: ~53% for 10th
 */
function diminishing(baseValue, stacks) {
	if (stacks <= 0) return 0;
	if (stacks === 1) return baseValue; // First stack unaffected
	// First stack at full value, remaining stacks have diminishing returns
	const additionalStacks = stacks - 1;
	return baseValue + baseValue * additionalStacks / (1 + KNOBS.DIMINISHING_COEFFICIENT * additionalStacks);
}

/**
 * Initialize default derived stats on a player
 */
export function initPlayerUpgrades(player) {
	player.upgrades = {};
	// Persistent bonuses from boss XP orbs
	player.bossBonus = {
		flatMaxHp: 0,
		flatMaxStamina: 0,
		damageMult: 0,
		attackSpeedMult: 0
	};
	player.derivedStats = {
		// Damage
		damageMult: 1.0,
		critChance: 0,
		critMult: 2.0,
		
		// Stamina
		maxStaminaMult: 1.0,
		flatMaxStamina: 0,
		staminaRegenMult: 1.0,
		staminaDrainMult: 1.0,
		
		// Defense
		flatMaxHp: 0,
		maxHpMult: 1.0,
		damageReduction: 0,
		thornsMult: 0,
		
		// Mobility
		moveSpeedMult: 1.0,
		
		// Combat
		extraProjectiles: 0,
		lifeStealPercent: 0,
		attackSpeedMult: 1.0,
		rangeMult: 1.0,
		projectileLifetimeMult: 1.0,
		
		// Utility
		pickupRadiusMult: 1.0,
		
		// Visuals / size
		sizeScaleMult: 1.0,
		
		// Unique flags
		hasSecondWind: false,
		hasMarathon: false,
		hasSoulCollector: false,
		hasBerserker: false,
		hasHunter: false,
		hasTerritorial: false,
		hasLastStand: false,
		hasAdrenaline: false,
		hasMomentum: false,
		hasExecute: false,
		hasExplosive: false,
		hasPhaseShift: false,
		hasVampire: false,
		hasChainLightning: false,
		hasScavenger: false,
		// New upgrade flags
		hasFocusedFire: false,
		hasPrecisionRounds: false,
		hasStickyCharges: false,
		hasBleedingRounds: false,
		hasMissilePod: false,
		hasHeatseekerDrones: false,
		hasArcBarrage: false,
		hasOverchargeCore: false,
		hasGetAway: false
	};
	
	// Cooldown timers for triggered abilities
	player.secondWindCooldown = 0;
	player.phaseShiftCooldown = 0;
	player.adrenalineTimer = 0;
	player.momentumStacks = 0;
	
	// Soul Collector tracking
	player.soulCollectorKills = 0;
	player.soulCollectorBonus = 0;
	
	// New upgrade tracking
	player.arcBarrageCooldown = 0;
	player.focusedFireTarget = null;
	player.focusedFireStacks = 0;
	player.focusedFireLastHit = 0;
}

/**
 * Recalculate all derived stats based on current upgrade stacks
 */
export function recalculateDerivedStats(player) {
	const stacks = player.upgrades || {};
	const stats = player.derivedStats;
	
	// Reset to base values
	stats.damageMult = 1.0;
	stats.critChance = 0;
	stats.critMult = 2.0;
	
	stats.maxStaminaMult = 1.0;
	stats.flatMaxStamina = 0;
	stats.staminaRegenMult = 1.0;
	stats.staminaDrainMult = 1.0;
	
	stats.flatMaxHp = 0;
	stats.maxHpMult = 1.0;
	stats.damageReduction = 0;
	stats.thornsMult = 0;
	
	stats.moveSpeedMult = 1.0;
	
	stats.extraProjectiles = 0;
	stats.lifeStealPercent = 0;
	stats.attackSpeedMult = 1.0;
	stats.rangeMult = 1.0;
	stats.projectileLifetimeMult = 1.0;
	
	stats.pickupRadiusMult = 1.0;
	stats.sizeScaleMult = 1.0;
	
	// Reset unique flags
	stats.hasSecondWind = false;
	stats.hasMarathon = false;
	stats.hasSoulCollector = false;
	stats.hasBerserker = false;
	stats.hasHunter = false;
	stats.hasTerritorial = false;
	stats.hasLastStand = false;
	stats.hasAdrenaline = false;
	stats.hasMomentum = false;
	stats.hasExecute = false;
	stats.hasExplosive = false;
	stats.hasPhaseShift = false;
	stats.hasVampire = false;
	stats.hasChainLightning = false;
	stats.hasScavenger = false;
	// New upgrade flags
	stats.hasFocusedFire = false;
	stats.hasPrecisionRounds = false;
	stats.hasStickyCharges = false;
	stats.hasBleedingRounds = false;
	stats.hasMissilePod = false;
	stats.hasHeatseekerDrones = false;
	stats.hasArcBarrage = false;
	stats.hasOverchargeCore = false;
	stats.hasGetAway = false;

	// Apply persistent boss orb bonuses (if any)
	const bossBonus = player.bossBonus || {};
	stats.flatMaxHp += bossBonus.flatMaxHp || 0;
	stats.flatMaxStamina += bossBonus.flatMaxStamina || 0;
	stats.damageMult += bossBonus.damageMult || 0;
	stats.attackSpeedMult += bossBonus.attackSpeedMult || 0;
	
	// Apply each upgrade
	for (const [upgradeId, count] of Object.entries(stacks)) {
		const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
		if (upgrade && upgrade.apply) {
			upgrade.apply(player, count);
		}
	}
	
	// Apply caps (from upgrade-knobs.js)
	stats.critChance = Math.min(stats.critChance, KNOBS.STAT_CAPS.critChance);
	stats.damageReduction = Math.min(stats.damageReduction, KNOBS.STAT_CAPS.damageReduction);
	
	// Add Soul Collector bonus HP
	if (stats.hasSoulCollector) {
		stats.flatMaxHp += player.soulCollectorBonus || 0;
	}

	// Update max HP based on upgrades AND level
	const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
	const hpPerLevel = consts.HP_PER_LEVEL || 10;
	const level = player.level || 1;
	const levelBonusHp = (level - 1) * hpPerLevel;
	player.maxHp = (baseMaxHp + levelBonusHp + stats.flatMaxHp) * stats.maxHpMult;
	if (player.hp > player.maxHp) {
		player.hp = player.maxHp;
	}
	
	// Update max stamina based on upgrades
	const baseMaxStamina = consts.PLAYER_MAX_STAMINA ?? 100;
	player.maxStamina = (baseMaxStamina * stats.maxStaminaMult) + (stats.flatMaxStamina || 0);
	if (player.stamina > player.maxStamina) {
		player.stamina = player.maxStamina;
	}
	
	// Update size scale (level + upgrade size multiplier)
	const sizeScalePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL ?? 0.05;
	const sizeScaleMax = consts.PLAYER_SIZE_SCALE_MAX ?? 1.6;
	const baseScale = Math.min(sizeScaleMax, Math.max(1.0, 1.0 + (level - 1) * sizeScalePerLevel));
	const sizeScaleMult = stats.sizeScaleMult || 1.0;
	const maxScale = sizeScaleMax * Math.max(1.0, sizeScaleMult);
	player.sizeScale = Math.min(maxScale, Math.max(0.6, baseScale * sizeScaleMult));
}

/**
 * Apply an upgrade to a player (increment stack and recalculate)
 */
export function applyUpgrade(player, upgradeId) {
	if (!player.upgrades) {
		initPlayerUpgrades(player);
	}
	
	const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
	if (!upgrade) return 0;
	
	const currentStacks = player.upgrades[upgradeId] || 0;
	
	// Check max stacks
	if (currentStacks >= upgrade.maxStacks) {
		return currentStacks; // Already at max
	}
	
	player.upgrades[upgradeId] = currentStacks + 1;
	recalculateDerivedStats(player);
	
	return player.upgrades[upgradeId];
}

/**
 * Get the current stack count for an upgrade
 */
export function getUpgradeStacks(player, upgradeId) {
	return (player.upgrades && player.upgrades[upgradeId]) || 0;
}

/**
 * Check if player can pick up more of this upgrade
 */
export function canPickUpgrade(player, upgradeId) {
	const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
	if (!upgrade) return false;
	
	const currentStacks = getUpgradeStacks(player, upgradeId);
	return currentStacks < upgrade.maxStacks;
}

// ============================================================================
// UPGRADE CATALOG - 25 Unique Upgrades
// All values are defined in upgrade-knobs.js for easy tuning
// ============================================================================

export const UPGRADE_CATALOG = [
	// ===== BASIC TIER (8) - Stackable foundation upgrades =====
	{
		id: 'vitality',
		name: 'Vitality',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => `+${KNOBS.VITALITY.flatHpPerStack} max HP\nTotal: +${stacks * KNOBS.VITALITY.flatHpPerStack} HP`,
		apply: (player, stacks) => {
			player.derivedStats.flatMaxHp += stacks * KNOBS.VITALITY.flatHpPerStack;
		}
	},
	{
		id: 'swift_feet',
		name: 'Swift Feet',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.SWIFT_FEET.speedPerStack * 100);
			const bonus = Math.round(diminishing(perStack, stacks));
			return `+${perStack}% move speed\nTotal: +${bonus}% (diminishing)`;
		},
		apply: (player, stacks) => {
			player.derivedStats.moveSpeedMult += diminishing(KNOBS.SWIFT_FEET.speedPerStack, stacks);
		}
	},
	{
		id: 'endurance',
		name: 'Endurance',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.ENDURANCE.maxStaminaPerStack * 100);
			return `+${perStack}% max stamina\nTotal: +${stacks * perStack}%`;
		},
		apply: (player, stacks) => {
			player.derivedStats.maxStaminaMult += stacks * KNOBS.ENDURANCE.maxStaminaPerStack;
		}
	},
	{
		id: 'quick_recovery',
		name: 'Quick Recovery',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.QUICK_RECOVERY.staminaRegenPerStack * 100);
			return `+${perStack}% stamina regen\nTotal: +${stacks * perStack}%`;
		},
		apply: (player, stacks) => {
			player.derivedStats.staminaRegenMult += stacks * KNOBS.QUICK_RECOVERY.staminaRegenPerStack;
		}
	},
	{
		id: 'critical_strike',
		name: 'Critical Strike',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.CRITICAL_STRIKE.critChancePerStack * 100);
			const critMult = KNOBS.CRITICAL_STRIKE.critDamageMultiplier;
			return `+${perStack}% crit chance (${critMult}x dmg)\nTotal: ${Math.min(stacks * perStack, 100)}% crit`;
		},
		apply: (player, stacks) => {
			player.derivedStats.critChance += stacks * KNOBS.CRITICAL_STRIKE.critChancePerStack;
		}
	},
	{
		id: 'life_steal',
		name: 'Life Steal',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = KNOBS.LIFE_STEAL.lifeStealPerStack * 100;
			const bonus = Math.round(diminishing(perStack, stacks) * 10) / 10;
			return `+${perStack}% HP on hit\nTotal: ${bonus}% (diminishing)`;
		},
		apply: (player, stacks) => {
			player.derivedStats.lifeStealPercent += diminishing(KNOBS.LIFE_STEAL.lifeStealPerStack, stacks);
		}
	},
	{
		id: 'scavenger',
		name: 'Scavenger',
		rarity: RARITY.BASIC,
		maxStacks: KNOBS.SCAVENGER.maxStacks,
		description: () => {
			const radiusBonus = Math.round(KNOBS.SCAVENGER.pickupRadiusBonus * 100);
			const dropChance = Math.round(KNOBS.SCAVENGER.doubleDropChance * 100);
			return `+${radiusBonus}% pickup radius\n${dropChance}% double enemy drops`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) {
				player.derivedStats.pickupRadiusMult += KNOBS.SCAVENGER.pickupRadiusBonus;
				player.derivedStats.hasScavenger = true;
			}
		}
	},
	{
		id: 'base_damage',
		name: 'Power Shot',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.BASE_DAMAGE.damagePerStack * 100);
			return `+${perStack}% base damage\nTotal: +${stacks * perStack}%`;
		},
		apply: (player, stacks) => {
			player.derivedStats.damageMult += stacks * KNOBS.BASE_DAMAGE.damagePerStack;
		}
	},
	{
		id: 'attack_speed',
		name: 'Rapid Fire',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.ATTACK_SPEED.attackSpeedPerStack * 100);
			const bonus = Math.round(diminishing(perStack, stacks));
			return `+${perStack}% attack speed\nTotal: +${bonus}% (diminishing)`;
		},
		apply: (player, stacks) => {
			player.derivedStats.attackSpeedMult += diminishing(KNOBS.ATTACK_SPEED.attackSpeedPerStack, stacks);
		}
	},
	{
		id: 'crit_damage',
		name: 'Brutal Strikes',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.CRIT_DAMAGE.critMultPerStack * 100);
			const totalMult = 2.0 + stacks * KNOBS.CRIT_DAMAGE.critMultPerStack;
			return `+${perStack}% crit damage\nTotal: ${totalMult.toFixed(1)}x crit`;
		},
		apply: (player, stacks) => {
			player.derivedStats.critMult += stacks * KNOBS.CRIT_DAMAGE.critMultPerStack;
		}
	},
	{
		id: 'crit_multiplier',
		name: 'Deadlier Crits',
		rarity: RARITY.BASIC,
		maxStacks: Infinity,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.CRIT_MULTIPLIER.critMultPerStack * 100);
			const totalMult = 2.0 + stacks * KNOBS.CRIT_MULTIPLIER.critMultPerStack;
			return `+${perStack}% crit multiplier\nTotal: ${totalMult.toFixed(1)}x crit`;
		},
		apply: (player, stacks) => {
			player.derivedStats.critMult += stacks * KNOBS.CRIT_MULTIPLIER.critMultPerStack;
		}
	},
	{
		id: 'focused_fire',
		name: 'Focused Fire',
		rarity: RARITY.BASIC,
		maxStacks: 1,
		description: () => {
			const perHit = Math.round(KNOBS.FOCUSED_FIRE.damagePerHitOnSameTarget * 100);
			const maxBonus = Math.round(KNOBS.FOCUSED_FIRE.maxStacks * KNOBS.FOCUSED_FIRE.damagePerHitOnSameTarget * 100);
			return `+${perHit}% damage per hit\non same target (max +${maxBonus}%)`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasFocusedFire = true;
		}
	},
	{
		id: 'precision_rounds',
		name: 'Precision Rounds',
		rarity: RARITY.BASIC,
		maxStacks: 1,
		description: () => {
			const maxBonus = Math.round(KNOBS.PRECISION_ROUNDS.maxDamageBonus * 100);
			return `Up to +${maxBonus}% damage\nto distant enemies`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasPrecisionRounds = true;
		}
	},
	
	// ===== RARE TIER (10) - Unique mechanics =====
	{
		id: 'second_wind',
		name: 'Second Wind',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.SECOND_WIND.maxStacks,
		description: () => {
			const recover = Math.round(KNOBS.SECOND_WIND.staminaRecoverPercent * 100);
			return `Stamina hits 0?\nRecover ${recover}% (${KNOBS.SECOND_WIND.cooldownSeconds}s cooldown)`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasSecondWind = true;
		}
	},
	{
		id: 'marathon',
		name: 'Marathon Runner',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.MARATHON.maxStacks,
		description: () => {
			const reduction = Math.round(KNOBS.MARATHON.staminaDrainReduction * 100);
			return `Stamina drains ${reduction}%\nslower outside territory`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) {
				player.derivedStats.hasMarathon = true;
				player.derivedStats.staminaDrainMult -= KNOBS.MARATHON.staminaDrainReduction;
			}
		}
	},
	{
		id: 'soul_collector',
		name: 'Soul Collector',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.SOUL_COLLECTOR.maxStacks,
		description: () => `+1 max HP per ${KNOBS.SOUL_COLLECTOR.killsPerHpBonus} kills\nCaps at +${KNOBS.SOUL_COLLECTOR.maxBonusHp} HP`,
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasSoulCollector = true;
		}
	},
	{
		id: 'berserker',
		name: 'Berserker',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.BERSERKER.maxStacks,
		description: () => {
			const threshold = Math.round(KNOBS.BERSERKER.hpThreshold * 100);
			const atkSpd = Math.round(KNOBS.BERSERKER.attackSpeedBonus * 100);
			const dmg = Math.round(KNOBS.BERSERKER.damageBonus * 100);
			return `Below ${threshold}% HP:\n+${atkSpd}% attack speed, +${dmg}% dmg`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasBerserker = true;
		}
	},
	{
		id: 'hunter',
		name: 'Hunter',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.HUNTER.maxStacks,
		description: () => {
			const dmgBonus = Math.round(KNOBS.HUNTER.damageBonus * 100);
			const threshold = Math.round(KNOBS.HUNTER.enemyHpThreshold * 100);
			return `+${dmgBonus}% damage vs enemies\nbelow ${threshold}% HP`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasHunter = true;
		}
	},
	{
		id: 'territorial',
		name: 'Territorial',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.TERRITORIAL.maxStacks,
		description: () => {
			const dmgBonus = Math.round(KNOBS.TERRITORIAL.damageBonus * 100);
			return `+${dmgBonus}% damage while\nin your territory`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasTerritorial = true;
		}
	},
	{
		id: 'thorns',
		name: 'Thorns',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.THORNS.maxStacks,
		description: () => {
			const reflect = Math.round(KNOBS.THORNS.reflectPercent * 100);
			return `Attackers take ${reflect}%\nof damage dealt back`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.thornsMult = KNOBS.THORNS.reflectPercent;
		}
	},
	{
		id: 'last_stand',
		name: 'Last Stand',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.LAST_STAND.maxStacks,
		description: () => {
			const threshold = Math.round(KNOBS.LAST_STAND.hpThreshold * 100);
			const reduction = Math.round(KNOBS.LAST_STAND.damageReduction * 100);
			return `Below ${threshold}% HP:\nTake ${reduction}% less damage`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasLastStand = true;
		}
	},
	{
		id: 'adrenaline',
		name: 'Adrenaline Rush',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.ADRENALINE.maxStacks,
		description: () => {
			const speedBonus = Math.round(KNOBS.ADRENALINE.speedBonus * 100);
			return `When hit, gain +${speedBonus}%\nmove speed for ${KNOBS.ADRENALINE.durationSeconds} sec`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasAdrenaline = true;
		}
	},
	{
		id: 'momentum',
		name: 'Momentum',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.MOMENTUM.maxStacks,
		description: () => {
			const perSec = Math.round(KNOBS.MOMENTUM.speedPerSecond * 100);
			const maxBonus = Math.round(KNOBS.MOMENTUM.maxSpeedBonus * 100);
			return `Outside territory: +${perSec}%\nspeed/sec (max +${maxBonus}%)`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasMomentum = true;
		}
	},
	{
		id: 'sticky_charges',
		name: 'Sticky Charges',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.STICKY_CHARGES.maxStacks,
		description: () => {
			const dmgPer = Math.round(KNOBS.STICKY_CHARGES.damagePerCharge * 100);
			const delay = KNOBS.STICKY_CHARGES.detonationDelay;
			return `Hits apply charges that\nexplode for ${dmgPer}% dmg after ${delay}s`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasStickyCharges = true;
		}
	},
	{
		id: 'bleeding_rounds',
		name: 'Bleeding Rounds',
		rarity: RARITY.BASIC,
		maxStacks: KNOBS.BLEEDING_ROUNDS.maxStacks,
		description: () => {
			const maxStacks = KNOBS.BLEEDING_ROUNDS.maxBleedStacks;
			const duration = KNOBS.BLEEDING_ROUNDS.durationSeconds;
			const procChance = Math.round((KNOBS.BLEEDING_ROUNDS.procChance ?? 0.15) * 100);
			return `${procChance}% bleed chance per stack\nMax ${maxStacks} stacks, ${duration}s`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasBleedingRounds = true;
		}
	},
	{
		id: 'missile_pod',
		name: 'Missile Pod',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.MISSILE_POD.maxStacks,
		description: () => {
			const chance = Math.round(KNOBS.MISSILE_POD.procChance * 100);
			const dmg = Math.round(KNOBS.MISSILE_POD.missileDamagePercent * 100);
			return `${chance}% chance on hit to\nfire a ${dmg}% dmg missile`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasMissilePod = true;
		}
	},
	{
		id: 'heatseeker_drones',
		name: 'Heatseeker Drones',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.HEATSEEKER_DRONES.maxStacks,
		description: () => {
			const count = KNOBS.HEATSEEKER_DRONES.droneCount;
			const dmg = Math.round(KNOBS.HEATSEEKER_DRONES.damagePercent * 100);
			return `${count} passive drones attack\nnearby enemies for ${dmg}% dmg`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasHeatseekerDrones = true;
		}
	},
	
	// ===== LEGENDARY TIER (7) - Game-changers and tradeoffs =====
	{
		id: 'glass_cannon',
		name: 'Glass Cannon',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.GLASS_CANNON.maxStacks,
		description: () => {
			const dmgBonus = Math.round(KNOBS.GLASS_CANNON.damageBonus * 100);
			const hpPenalty = Math.round(KNOBS.GLASS_CANNON.maxHpPenalty * 100);
			return `+${dmgBonus}% damage\n-${hpPenalty}% max HP`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) {
				player.derivedStats.damageMult += KNOBS.GLASS_CANNON.damageBonus;
				player.derivedStats.maxHpMult -= KNOBS.GLASS_CANNON.maxHpPenalty;
				player.derivedStats.sizeScaleMult *= KNOBS.GLASS_CANNON.sizeScaleMult;
			}
		}
	},
	{
		id: 'juggernaut',
		name: 'Juggernaut',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.JUGGERNAUT.maxStacks,
		description: () => {
			const hpBonus = Math.round(KNOBS.JUGGERNAUT.maxHpBonus * 100);
			const speedPenalty = Math.round(KNOBS.JUGGERNAUT.speedPenalty * 100);
			return `+${hpBonus}% max HP\n-${speedPenalty}% move speed`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) {
				player.derivedStats.maxHpMult += KNOBS.JUGGERNAUT.maxHpBonus;
				player.derivedStats.moveSpeedMult -= KNOBS.JUGGERNAUT.speedPenalty;
				player.derivedStats.sizeScaleMult *= KNOBS.JUGGERNAUT.sizeScaleMult;
			}
		}
	},
	{
		id: 'multishot',
		name: 'Multishot',
		rarity: RARITY.LEGENDARY,
		maxStacks: Infinity,
		description: (stacks) => `+${KNOBS.MULTISHOT.projectilesPerStack} projectile\nTotal: +${stacks * KNOBS.MULTISHOT.projectilesPerStack} projectiles`,
		apply: (player, stacks) => {
			player.derivedStats.extraProjectiles += stacks * KNOBS.MULTISHOT.projectilesPerStack;
		}
	},
	{
		id: 'execute',
		name: 'Execute',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.EXECUTE.maxStacks,
		description: () => {
			const threshold = Math.round(KNOBS.EXECUTE.hpThreshold * 100);
			return `Enemies below ${threshold}% HP\nare instantly killed`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasExecute = true;
		}
	},
	{
		id: 'explosive_rounds',
		name: 'Explosive Rounds',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.EXPLOSIVE_ROUNDS.maxStacks,
		description: () => {
			const dmgPercent = Math.round(KNOBS.EXPLOSIVE_ROUNDS.explosionDamagePercent * 100);
			return `Hits explode for ${dmgPercent}%\ndamage to nearby enemies`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasExplosive = true;
		}
	},
	{
		id: 'phase_shift',
		name: 'Phase Shift',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.PHASE_SHIFT.maxStacks,
		description: () => `First hit every ${KNOBS.PHASE_SHIFT.cooldownSeconds} sec\ndeals no damage`,
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasPhaseShift = true;
		}
	},
	{
		id: 'vampire',
		name: 'Vampire',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.VAMPIRE.maxStacks,
		description: () => {
			const healPercent = Math.round(KNOBS.VAMPIRE.healOnKillPercent * 100);
			return `Heal ${healPercent}% max HP on kill\nNo passive HP regen`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasVampire = true;
		}
	},
	{
		id: 'chain_lightning',
		name: 'Chain Lightning',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.CHAIN_LIGHTNING.maxStacks,
		description: () => {
			const dmgPercent = Math.round(KNOBS.CHAIN_LIGHTNING.bounceDamagePercent * 100);
			return `Hits bounce to ${KNOBS.CHAIN_LIGHTNING.bounceCount} nearby\nenemies at ${dmgPercent}% damage`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasChainLightning = true;
		}
	},
	{
		id: 'arc_barrage',
		name: 'Arc Barrage',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.ARC_BARRAGE.maxStacks,
		description: () => {
			const interval = KNOBS.ARC_BARRAGE.burstInterval;
			const dmg = Math.round(KNOBS.ARC_BARRAGE.burstDamagePercent * 100);
			return `Every ${interval}s, burst damages\nall nearby enemies for ${dmg}%`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasArcBarrage = true;
		}
	},
	{
		id: 'overcharge_core',
		name: 'Overcharge Core',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.OVERCHARGE_CORE.maxStacks,
		description: () => {
			const dmg = Math.round(KNOBS.OVERCHARGE_CORE.damageBonus * 100);
			const spd = Math.round(KNOBS.OVERCHARGE_CORE.attackSpeedBonus * 100);
			const drain = Math.round(KNOBS.OVERCHARGE_CORE.hpDrainPerSecond * 100);
			return `+${dmg}% dmg, +${spd}% atk spd\nLose ${drain}% HP/sec`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) {
				player.derivedStats.hasOverchargeCore = true;
				player.derivedStats.damageMult += KNOBS.OVERCHARGE_CORE.damageBonus;
				player.derivedStats.attackSpeedMult += KNOBS.OVERCHARGE_CORE.attackSpeedBonus;
			}
		}
	},
	
	// ===== DRONE RANGE UPGRADES =====
	{
		id: 'extended_antennae',
		name: 'Extended Antennae',
		rarity: RARITY.BASIC,
		maxStacks: KNOBS.EXTENDED_ANTENNAE.maxStacks,
		description: (stacks) => {
			const perStack = Math.round(KNOBS.EXTENDED_ANTENNAE.rangePerStack * 100);
			return `+${perStack}% drone range\nTotal: +${stacks * perStack}%`;
		},
		apply: (player, stacks) => {
			player.derivedStats.rangeMult += stacks * KNOBS.EXTENDED_ANTENNAE.rangePerStack;
		}
	},
	{
		id: 'signal_boosters',
		name: 'Signal Boosters',
		rarity: RARITY.RARE,
		maxStacks: KNOBS.SIGNAL_BOOSTERS.maxStacks,
		description: (stacks) => {
			const rangePerStack = Math.round(KNOBS.SIGNAL_BOOSTERS.rangePerStack * 100);
			const lifetimePerStack = Math.round(KNOBS.SIGNAL_BOOSTERS.projectileLifetimePerStack * 100);
			return `+${rangePerStack}% drone range\n+${lifetimePerStack}% projectile lifetime`;
		},
		apply: (player, stacks) => {
			player.derivedStats.rangeMult += stacks * KNOBS.SIGNAL_BOOSTERS.rangePerStack;
			player.derivedStats.projectileLifetimeMult += stacks * KNOBS.SIGNAL_BOOSTERS.projectileLifetimePerStack;
		}
	},
	{
		id: 'get_away',
		name: 'Get Away',
		rarity: RARITY.LEGENDARY,
		maxStacks: KNOBS.GET_AWAY.maxStacks,
		description: () => {
			const dmgPer = Math.round(KNOBS.GET_AWAY.damagePerEnemy * 100);
			return `+${dmgPer}% damage per enemy\nwithin drone range`;
		},
		apply: (player, stacks) => {
			if (stacks > 0) player.derivedStats.hasGetAway = true;
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
