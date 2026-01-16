import { consts } from "../../config.js";
import Player, { checkPlayerCollision, pointInPolygon, PLAYER_RADIUS, polygonsOverlap, subtractTerritorySimple } from "./player.js";

export { default as Color } from "./color.js";
export { Player, checkPlayerCollision, pointInPolygon, PLAYER_RADIUS, polygonsOverlap, subtractTerritorySimple };

// Initialize player with starting territory (small circle around spawn)
export function initPlayer(player) {
	const territoryRadius = consts.CELL_WIDTH * 1.5;
	const segments = 12;
	player.territory = [];
	
	// Ensure spawn center is set (usually handled by constructor, but safe here)
	if (player.spawnX === undefined) player.spawnX = player.x;
	if (player.spawnY === undefined) player.spawnY = player.y;
	
	for (let i = 0; i < segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		player.territory.push({
			x: player.x + Math.cos(angle) * territoryRadius,
			y: player.y + Math.sin(angle) * territoryRadius
		});
	}
}

/**
 * Updates player stamina based on whether they are in their own territory.
 * Also regenerates HP when in territory.
 * @param {Player} player 
 * @param {number} deltaSeconds 
 */
export function updateStamina(player, deltaSeconds) {
	const inTerritory = player.isInOwnTerritory();
	
	// Apply stat multipliers (default to 1.0 if not set)
	const regenMult = player.staminaRegenMult || 1.0;
	const drainMult = player.staminaDrainMult || 1.0;
	
	if (inTerritory) {
		// Regenerate stamina
		player.stamina += consts.STAMINA_REGEN_INSIDE_PER_SEC * regenMult * deltaSeconds;
		if (player.stamina > player.maxStamina) {
			player.stamina = player.maxStamina;
		}
		
		// Recover from exhaustion
		if (player.isExhausted && player.stamina >= consts.EXHAUSTED_RECOVER_THRESHOLD) {
			player.isExhausted = false;
		}
		
		// Regenerate HP in territory (using effective maxHp from upgrades)
		const baseMaxHp = consts.PLAYER_MAX_HP ?? 100;
		const maxHpMult = (player.derivedStats && player.derivedStats.maxHpMult) || 1.0;
		player.maxHp = baseMaxHp * maxHpMult;
		
		if (player.hp < player.maxHp) {
			player.hp += (consts.PLAYER_HP_REGEN_IN_TERRITORY || 8) * deltaSeconds;
			if (player.hp > player.maxHp) {
				player.hp = player.maxHp;
			}
		}
	} else {
		// Drain stamina outside territory
		player.stamina -= consts.STAMINA_DRAIN_OUTSIDE_PER_SEC * drainMult * deltaSeconds;
		if (player.stamina <= 0) {
			player.stamina = 0;
			player.isExhausted = true;
		}
	}
}

export function updateFrame(players, dead, notifyKill, deltaSeconds = 1 / 60) {
	const adead = dead instanceof Array ? dead : [];
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	// deltaSeconds defaults to 1/60 for legacy callers

	// Track which players captured territory this frame
	const capturedThisFrame = [];
	
	// Move all players
	const alive = players.filter(player => {
		// Store previous territory area to detect captures
		const prevArea = polygonArea(player.territory);
		
		updateStamina(player, deltaSeconds);
		player.move(deltaSeconds);
		
		// Check if player captured territory (area increased)
		const newArea = polygonArea(player.territory);
		if (newArea > prevArea + 100) { // Significant capture (not just floating point noise)
			capturedThisFrame.push(player);
		}
		
		if (player.dead) {
			adead.push(player);
		}
		return !player.dead;
	});
	
	// Set up collision tracking and kill notification (needed for territory resolution too)
	const removing = new Array(alive.length).fill(false);
	const kill = notifyKill || (() => {});
	
	// TERRITORY OVERLAP RESOLUTION
	// When a player captures territory, subtract it from overlapping enemy territories
	// Also check if players are trapped inside the captured territory
	for (const capturer of capturedThisFrame) {
		if (capturer.dead) continue;
		
		for (const other of alive) {
			if (other === capturer || other.dead) continue;
			
			// Check if territories overlap
			if (polygonsOverlap(capturer.territory, other.territory)) {
				// Subtract the capturer's territory from the other player's territory
				const newTerritory = subtractTerritorySimple(
					other.territory,
					capturer.territory,
					{ x: other.spawnX, y: other.spawnY }
				);
				
				// Only update if the result is valid
				if (newTerritory && newTerritory.length >= 3) {
					other.territory = newTerritory;
				} else {
					// Territory completely consumed - kill the player
					const otherAliveIdx = alive.indexOf(other);
					const capturerPlayersIdx = players.indexOf(capturer);
					const otherPlayersIdx = players.indexOf(other);
					if (capturerPlayersIdx !== -1 && otherPlayersIdx !== -1) {
						kill(capturerPlayersIdx, otherPlayersIdx);
					}
					if (otherAliveIdx !== -1) removing[otherAliveIdx] = true;
					other.dead = true;
				}
			}
			
			// Check if the other player is trapped inside capturer's territory
			// (player is inside enemy territory and NOT in their own territory)
			if (!other.dead && pointInPolygon({ x: other.x, y: other.y }, capturer.territory)) {
				// Player is inside the capturer's territory
				// Check if they're NOT in their own territory (trapped)
				if (!pointInPolygon({ x: other.x, y: other.y }, other.territory)) {
					// Trapped! Kill the player
					const otherAliveIdx = alive.indexOf(other);
					const capturerPlayersIdx = players.indexOf(capturer);
					const otherPlayersIdx = players.indexOf(other);
					if (capturerPlayersIdx !== -1 && otherPlayersIdx !== -1) {
						kill(capturerPlayersIdx, otherPlayersIdx);
					}
					if (otherAliveIdx !== -1) removing[otherAliveIdx] = true;
					other.dead = true;
				}
			}
		}
	}

	// Check collisions
	for (let i = 0; i < alive.length; i++) {
		if (removing[i] || alive[i].dead) continue;
		
		for (let j = 0; j < alive.length; j++) {
			if (i === j || removing[j] || alive[j].dead) continue;

			
			// Check if player i hits player j's trail
			// Snipped players cannot snip others
			if (!alive[i].isSnipped) {
				const trailHit = alive[j].trail.hitsTrail(alive[i].x, alive[i].y, 0);
				if (trailHit) {
					// Instead of immediate death, start the snip fuse
					if (!alive[j].isSnipped) {
						// Pass the snipper's player number for kill tracking
						alive[j].startSnip({ x: alive[i].x, y: alive[i].y }, trailHit, alive[i].num);
					}
					// MVP: ignore if victim already snipped.
					break;
				}
			}

			// Check if players collide with each other
			if (!removing[i] && !removing[j] && checkPlayerCollision(alive[i], alive[j])) {
				// Player in their own territory wins
				const iInTerritory = alive[i].isInOwnTerritory();
				const jInTerritory = alive[j].isInOwnTerritory();
				
				// Map alive indices to players indices for kill callback
				const playersIdxI = players.indexOf(alive[i]);
				const playersIdxJ = players.indexOf(alive[j]);
				
				if (iInTerritory && !jInTerritory) {
					kill(playersIdxI, playersIdxJ);
					removing[j] = true;
				} else if (jInTerritory && !iInTerritory) {
					kill(playersIdxJ, playersIdxI);
					removing[i] = true;
				} else {
					// Both in or out of territory - both die or compare territory size
					const areaI = polygonArea(alive[i].territory);
					const areaJ = polygonArea(alive[j].territory);

					if (Math.abs(areaI - areaJ) < 100) {
						// Similar size - both die
						kill(playersIdxI, playersIdxJ);
						kill(playersIdxJ, playersIdxI);
						removing[i] = removing[j] = true;
					} else if (areaI > areaJ) {
						kill(playersIdxI, playersIdxJ);
						removing[j] = true;
					} else {
						kill(playersIdxJ, playersIdxI);
						removing[i] = true;
					}
				}
			}
		}
		
		// Check if player i hits their own trail (suicide)
		const selfHit = alive[i].trail.hitsTrail(alive[i].x, alive[i].y, 10);
		if (!removing[i] && selfHit) {
			if (!alive[i].isSnipped) {
				// Self-snip: pass null as snipper (no kill credit)
				alive[i].startSnip({ x: alive[i].x, y: alive[i].y }, selfHit, null);
			}
		}
	}

	// Remove dead players
	const remaining = alive.filter((player, i) => {
		if (removing[i]) {
			adead.push(player);
			player.die();
			return false;
		}
		return true;
	});

	// Update players array in place
	players.length = remaining.length;
	for (let i = 0; i < remaining.length; i++) {
		players[i] = remaining[i];
	}
	}

// Calculate polygon area using shoelace formula
function polygonArea(polygon) {
	if (!polygon || polygon.length < 3) return 0;
	
	let area = 0;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
	}
	return Math.abs(area / 2);
}

export { polygonArea };
