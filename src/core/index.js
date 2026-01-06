import { consts } from "../../config.js";
import Player, { checkPlayerCollision, pointInPolygon, PLAYER_RADIUS } from "./player.js";

export { default as Color } from "./color.js";
export { Player, checkPlayerCollision, pointInPolygon, PLAYER_RADIUS };

// Initialize player with starting territory (small circle around spawn)
export function initPlayer(player) {
	const territoryRadius = consts.CELL_WIDTH * 1.5;
	const segments = 12;
	player.territory = [];
	
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
 * @param {Player} player 
 * @param {number} deltaSeconds 
 */
export function updateStamina(player, deltaSeconds) {
	const inTerritory = player.isInOwnTerritory();
	
	if (inTerritory) {
		// Regenerate stamina
		player.stamina += consts.STAMINA_REGEN_INSIDE_PER_SEC * deltaSeconds;
		if (player.stamina > consts.MAX_STAMINA) {
			player.stamina = consts.MAX_STAMINA;
		}
		
		// Recover from exhaustion
		if (player.isExhausted && player.stamina >= consts.EXHAUSTED_RECOVER_THRESHOLD) {
			player.isExhausted = false;
		}
	} else {
		// Drain stamina
		player.stamina -= consts.STAMINA_DRAIN_OUTSIDE_PER_SEC * deltaSeconds;
		if (player.stamina <= 0) {
			player.stamina = 0;
			player.isExhausted = true;
		}
	}
}

export function updateFrame(players, dead, notifyKill) {
	const adead = dead instanceof Array ? dead : [];
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	const deltaSeconds = 1 / 60; // Game runs at 60 FPS

	// Move all players
	const alive = players.filter(player => {
		updateStamina(player, deltaSeconds);
		player.move(deltaSeconds);
		if (player.dead) {
			adead.push(player);
		}
		return !player.dead;
	});

	// Check collisions
	const removing = new Array(players.length).fill(false);

	const kill = notifyKill || (() => {});

	for (let i = 0; i < players.length; i++) {
		if (removing[i] || players[i].dead) continue;
		
		for (let j = 0; j < players.length; j++) {
			if (i === j || removing[j] || players[j].dead) continue;
			
			// Check if player i hits player j's trail
			// Snipped players cannot snip others
			if (!players[i].isSnipped) {
				const trailHit = players[j].trail.hitsTrail(players[i].x, players[i].y, 0);
				if (trailHit) {
					// Instead of immediate death, start the snip fuse
					if (!players[j].isSnipped) {
						players[j].startSnip({ x: players[i].x, y: players[i].y }, trailHit);
					}
					// MVP: ignore if victim already snipped.
					break;
				}
			}

			// Check if players collide with each other
			if (!removing[i] && !removing[j] && checkPlayerCollision(players[i], players[j])) {
				// Player in their own territory wins
				const iInTerritory = players[i].isInOwnTerritory();
				const jInTerritory = players[j].isInOwnTerritory();
				
				if (iInTerritory && !jInTerritory) {
					kill(i, j);
					removing[j] = true;
				} else if (jInTerritory && !iInTerritory) {
					kill(j, i);
					removing[i] = true;
				} else {
					// Both in or out of territory - both die or compare territory size
					const areaI = polygonArea(players[i].territory);
					const areaJ = polygonArea(players[j].territory);

					if (Math.abs(areaI - areaJ) < 100) {
						// Similar size - both die
						kill(i, j);
						kill(j, i);
						removing[i] = removing[j] = true;
					} else if (areaI > areaJ) {
						kill(i, j);
						removing[j] = true;
					} else {
						kill(j, i);
						removing[i] = true;
					}
				}
			}
		}
		
		// Check if player i hits their own trail (suicide)
		const selfHit = players[i].trail.hitsTrail(players[i].x, players[i].y, 10);
		if (!removing[i] && selfHit) {
			if (!players[i].isSnipped) {
				players[i].startSnip({ x: players[i].x, y: players[i].y }, selfHit);
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
