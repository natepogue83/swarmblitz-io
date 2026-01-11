/**
 * Archero-style level-up upgrades.
 * Server-authoritative: only the server applies these.
 *
 * An upgrade option sent to the client is:
 * { id, name, description }
 */

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

export const UPGRADES = [
	{
		id: "max_stamina_20",
		name: "+20 Max Stamina",
		description: "Increase your max stamina by 20.",
		apply(player) {
			player.maxStamina += 20;
			player.stamina = Math.min(player.stamina + 20, player.maxStamina);
		}
	},
	{
		id: "max_stamina_35",
		name: "+35 Max Stamina",
		description: "Increase your max stamina by 35.",
		apply(player) {
			player.maxStamina += 35;
			player.stamina = Math.min(player.stamina + 35, player.maxStamina);
		}
	},
	{
		id: "stamina_regen_15",
		name: "+15% Stamina Regen",
		description: "Regenerate stamina 15% faster while in territory.",
		apply(player) {
			player.staminaRegenMult = (player.staminaRegenMult || 1) + 0.15;
		}
	},
	{
		id: "stamina_regen_25",
		name: "+25% Stamina Regen",
		description: "Regenerate stamina 25% faster while in territory.",
		apply(player) {
			player.staminaRegenMult = (player.staminaRegenMult || 1) + 0.25;
		}
	},
	{
		id: "stamina_drain_15",
		name: "-15% Stamina Drain",
		description: "Lose stamina 15% slower outside territory.",
		apply(player) {
			const cur = player.staminaDrainMult || 1;
			player.staminaDrainMult = clamp(cur - 0.15, 0.2, 2.0);
		}
	},
	{
		id: "stamina_drain_25",
		name: "-25% Stamina Drain",
		description: "Lose stamina 25% slower outside territory.",
		apply(player) {
			const cur = player.staminaDrainMult || 1;
			player.staminaDrainMult = clamp(cur - 0.25, 0.2, 2.0);
		}
	},
	{
		id: "move_speed_10",
		name: "+10% Move Speed",
		description: "Move 10% faster.",
		apply(player) {
			player.speedMult = (player.speedMult || 1) + 0.10;
		}
	},
	{
		id: "move_speed_20",
		name: "+20% Move Speed",
		description: "Move 20% faster.",
		apply(player) {
			player.speedMult = (player.speedMult || 1) + 0.20;
		}
	},
	{
		id: "snip_grace_010",
		name: "+0.10s Snip Grace",
		description: "Gain 0.10s extra grace before the fuse starts moving.",
		apply(player) {
			player.snipGraceBonusSec = (player.snipGraceBonusSec || 0) + 0.10;
		}
	},
	{
		id: "snip_grace_020",
		name: "+0.20s Snip Grace",
		description: "Gain 0.20s extra grace before the fuse starts moving.",
		apply(player) {
			player.snipGraceBonusSec = (player.snipGraceBonusSec || 0) + 0.20;
		}
	}
];

export const UPGRADES_BY_ID = new Map(UPGRADES.map(u => [u.id, u]));

export function pickUpgradeOptions(count = 3) {
	const options = [];
	const used = new Set();
	const maxAttempts = 200;
	let attempts = 0;

	while (options.length < count && attempts++ < maxAttempts) {
		const u = UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
		if (!u || used.has(u.id)) continue;
		used.add(u.id);
		options.push({ id: u.id, name: u.name, description: u.description });
	}

	// If the catalog is too small, we may return fewer than count. That's fine for MVP.
	return options;
}

export function applyUpgrade(player, upgradeId) {
	const u = UPGRADES_BY_ID.get(upgradeId);
	if (!u) return false;
	u.apply(player);
	return true;
}



