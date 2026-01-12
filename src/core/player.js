import Color from "./color.js";
import { consts } from "../../config.js";

export const PLAYER_RADIUS = 15;
const TRAIL_MIN_DIST = 10;
const SHADOW_OFFSET = 10;

// Point in polygon check
export function pointInPolygon(point, polygon) {
	if (!polygon || polygon.length < 3) return false;
	
	let inside = false;
	const x = point.x, y = point.y;
	
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x, yi = polygon[i].y;
		const xj = polygon[j].x, yj = polygon[j].y;
		
		if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	return inside;
}

// Check collision between two players
export function checkPlayerCollision(p1, p2) {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	return dist < PLAYER_RADIUS * 2;
}

// Line segment intersection check
function lineIntersects(p1, p2, p3, p4) {
	const d1 = direction(p3, p4, p1);
	const d2 = direction(p3, p4, p2);
	const d3 = direction(p1, p2, p3);
	const d4 = direction(p1, p2, p4);
	
	if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
		((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
		return true;
	}
	
	if (d1 === 0 && onSegment(p3, p4, p1)) return true;
	if (d2 === 0 && onSegment(p3, p4, p2)) return true;
	if (d3 === 0 && onSegment(p1, p2, p3)) return true;
	if (d4 === 0 && onSegment(p1, p2, p4)) return true;
	
	return false;
}

function direction(p1, p2, p3) {
	return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

function onSegment(p1, p2, p) {
	return p.x <= Math.max(p1.x, p2.x) && p.x >= Math.min(p1.x, p2.x) &&
		   p.y <= Math.max(p1.y, p2.y) && p.y >= Math.min(p1.y, p2.y);
}

// Trail class for free movement
class Trail {
	constructor(player) {
		this.player = player;
		this.points = [];
	}
	
	addPoint(x, y) {
		if (this.points.length > 0) {
			const last = this.points[this.points.length - 1];
			const dx = x - last.x;
			const dy = y - last.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < TRAIL_MIN_DIST) return;
		}
		this.points.push({ x, y });
	}
	
	clear() {
		this.points = [];
	}
	
	hitsTrail(x, y, skipDist) {
		if (this.points.length < 2) return null;
		
		const checkPoint = { x, y };
		
		// Check if point is near any trail segment (excluding recent points)
		for (let i = 0; i < this.points.length - 1; i++) {
			const p1 = this.points[i];
			const p2 = this.points[i + 1];
			
			// Skip recent segments for self-collision
			if (skipDist > 0 && i >= this.points.length - 3) continue;
			
			const hitInfo = pointToSegmentHit(checkPoint, p1, p2);
			if (hitInfo.distance < PLAYER_RADIUS) {
				return {
					index: i,
					point: hitInfo.point
				};
			}
		}
		return null;
	}
	
	render(ctx) {
		if (this.points.length < 2) return;
		
		const player = this.player;
		
		// If snipped, render the fuse effect
		if (player.isSnipped && player.snipFusePosition) {
			const fusePos = player.snipFusePosition;
			
			// Draw the "safe" portion (from fuse to player) - this is the unburned trail
			// This portion starts at the fuse position and continues through the rest of the trail points
			ctx.strokeStyle = player.tailColor.rgbString();
			ctx.lineWidth = PLAYER_RADIUS;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			
			ctx.beginPath();
			ctx.moveTo(fusePos.x, fusePos.y);
			
			// Draw from fuse to the end of the current segment it's on
			if (fusePos.segmentIndex + 1 < this.points.length) {
				for (let i = fusePos.segmentIndex + 1; i < this.points.length; i++) {
					ctx.lineTo(this.points[i].x, this.points[i].y);
				}
			}
			// Also draw to the player's current position
			ctx.lineTo(player.x, player.y);
			ctx.stroke();
			
			// Draw the fuse head - glowing spark effect
			const time = Date.now() / 100;
			const pulse = 0.7 + 0.3 * Math.sin(time * 3);
			const sparkSize = PLAYER_RADIUS * 1.2 * pulse;
			
			// Outer glow
			const gradient = ctx.createRadialGradient(fusePos.x, fusePos.y, 0, fusePos.x, fusePos.y, sparkSize * 2);
			gradient.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
			gradient.addColorStop(0.3, 'rgba(255, 100, 0, 0.6)');
			gradient.addColorStop(0.6, 'rgba(255, 50, 0, 0.3)');
			gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
			
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(fusePos.x, fusePos.y, sparkSize * 2, 0, Math.PI * 2);
			ctx.fill();
			
			// Inner bright core
			ctx.fillStyle = `rgba(255, 255, 200, ${pulse})`;
			ctx.beginPath();
			ctx.arc(fusePos.x, fusePos.y, sparkSize * 0.5, 0, Math.PI * 2);
			ctx.fill();
			
			// Sparks
			ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
			for (let i = 0; i < 5; i++) {
				const angle = time * 2 + i * (Math.PI * 2 / 5);
				const dist = sparkSize * (0.8 + 0.4 * Math.sin(time * 5 + i));
				const sx = fusePos.x + Math.cos(angle) * dist;
				const sy = fusePos.y + Math.sin(angle) * dist;
				ctx.beginPath();
				ctx.arc(sx, sy, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		} else {
			// Normal trail rendering
			ctx.strokeStyle = player.tailColor.rgbString();
			ctx.lineWidth = PLAYER_RADIUS;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			
			ctx.beginPath();
			ctx.moveTo(this.points[0].x, this.points[0].y);
			for (let i = 1; i < this.points.length; i++) {
				ctx.lineTo(this.points[i].x, this.points[i].y);
			}
			ctx.stroke();
		}
	}
	
	serialData() {
		return this.points.slice();
	}
}

function pointToSegmentHit(p, v, w) {
	const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
	if (l2 === 0) {
		const d = Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
		return { distance: d, point: { x: v.x, y: v.y } };
	}
	
	let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
	t = Math.max(0, Math.min(1, t));
	
	const projX = v.x + t * (w.x - v.x);
	const projY = v.y + t * (w.y - v.y);
	
	const d = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
	return { distance: d, point: { x: projX, y: projY } };
}

export default function Player(sdata) {
	// Handle both old (grid, sdata) and new (sdata) signatures
	if (arguments.length === 2) {
		sdata = arguments[1];
	}
	sdata = sdata || {};
	
	// Position and movement
	this.x = sdata.posX || sdata.x || 0;
	this.y = sdata.posY || sdata.y || 0;
	this.spawnX = sdata.spawnX || this.x;
	this.spawnY = sdata.spawnY || this.y;
	this.angle = sdata.angle || 0;
	this.targetAngle = sdata.targetAngle || this.angle;
	this.speedMult = sdata.speedMult ?? 1.0;
	this.speed = consts.SPEED * this.speedMult;
	
	// Player info
	this.num = sdata.num;
	this.name = sdata.name || "Player " + (this.num + 1);
	this.waitLag = sdata.waitLag || 0;
	this.dead = false;

	// XP + Leveling System
	this.level = sdata.level ?? 1;    // Starts at level 1
	this.xp = sdata.xp ?? 0;          // Current XP (0 to XP_PER_LEVEL-1)
	
	// Size scaling based on level: sizeScale = clamp(1.0 + (level-1)*0.05, 1.0, 1.6)
	const sizeScalePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL ?? 0.05;
	const sizeScaleMax = consts.PLAYER_SIZE_SCALE_MAX ?? 1.6;
	this.sizeScale = Math.min(sizeScaleMax, Math.max(1.0, 1.0 + (this.level - 1) * sizeScalePerLevel));

	// Stat multipliers
	this.staminaRegenMult = sdata.staminaRegenMult ?? 1.0;
	this.staminaDrainMult = sdata.staminaDrainMult ?? 1.0;
	this.snipGraceBonusSec = sdata.snipGraceBonusSec ?? 0;
	this._pendingTerritoryAreaGained = 0; // Accumulates area in px^2
	this._territoryCoinCarry = 0; // Carryover for fractional coin conversion

	// Stamina system
	this.maxStamina = sdata.maxStamina ?? consts.MAX_STAMINA;
	this.stamina = sdata.stamina ?? this.maxStamina;
	this.isExhausted = sdata.isExhausted ?? false;
	
	// Snip system state
	this.isSnipped = sdata.isSnipped ?? false;
	this.snipTimeRemaining = sdata.snipTimeRemaining ?? 0;
	this.snipMaxTime = sdata.snipMaxTime ?? 0;
	this.snipStartPoint = sdata.snipStartPoint ?? null;
	this.snipProgressDist = sdata.snipProgressDist ?? 0;
	this.snipFuseSpeed = sdata.snipFuseSpeed ?? (this.speed * consts.SNIP_FUSE_SPEED_MULT);
	this.snipTrailIndex = sdata.snipTrailIndex ?? -1;
	this.snipFusePosition = sdata.snipFusePosition ?? null;
	this.snipTotalTrailLength = sdata.snipTotalTrailLength ?? 0;
	// Exponential fuse acceleration state
	this.snipElapsed = sdata.snipElapsed ?? 0; // seconds since snip started
	
	// HP system (for turret damage)
	this.hp = sdata.hp ?? (consts.PLAYER_MAX_HP || 100);
	this.maxHp = sdata.maxHp ?? (consts.PLAYER_MAX_HP || 100);
	
	// Territory and trail
	this.territory = sdata.territory || [];
	this.trail = new Trail(this);
	if (sdata.trail && Array.isArray(sdata.trail)) {
		sdata.trail.forEach(p => this.trail.points.push({ x: p.x, y: p.y }));
	}
	
	// Colors
	let base;
	if (sdata.base) {
		base = this.baseColor = sdata.base instanceof Color ? sdata.base : Color.fromData(sdata.base);
	} else {
		const hue = Math.random();
		this.baseColor = base = new Color(hue, 0.8, 0.5);
	}
	this.lightBaseColor = base.deriveLumination(0.1);
	this.shadowColor = base.deriveLumination(-0.3);
	this.tailColor = base.deriveLumination(0.2).deriveAlpha(0.98);
	
	// Map bounds
	this.mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
}

Player.prototype.move = function(deltaSeconds) {
	deltaSeconds = deltaSeconds || 1/60;
	
	if (this.waitLag < consts.NEW_PLAYER_LAG) {
		this.waitLag++;
		return;
	}
	
	// Handle snip logic
	if (this.isSnipped) {
		this.updateSnip(deltaSeconds);
		if (this.dead) return;
	}
	
	// Smoothly interpolate angle towards target
	let angleDiff = this.targetAngle - this.angle;
	while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
	while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
	
	const turnSpeed = 0.15;
	if (Math.abs(angleDiff) < turnSpeed) {
		this.angle = this.targetAngle;
	} else {
		this.angle += Math.sign(angleDiff) * turnSpeed;
	}
	
	// Apply stamina-based speed modifier
	const speedMultiplier = this.isExhausted ? consts.EXHAUSTED_SPEED_MULT : 1.0;

	// Move in current direction
	this.x += Math.cos(this.angle) * this.speed * speedMultiplier;
	this.y += Math.sin(this.angle) * this.speed * speedMultiplier;
	
	// Check bounds
	if (this.x < PLAYER_RADIUS || this.x > this.mapSize - PLAYER_RADIUS ||
		this.y < PLAYER_RADIUS || this.y > this.mapSize - PLAYER_RADIUS) {
		this.dead = true;
		return;
	}
	
	// Trail logic
	const inTerritory = this.isInOwnTerritory();
	
	// If snipped, don't do normal trail/capture logic - updateSnip handles safety check
	if (this.isSnipped) {
		// Still add trail points while snipped (player is still moving)
		if (!inTerritory) {
			this.trail.addPoint(this.x, this.y);
		}
		// Safety check is handled in updateSnip
		return;
	}
	
	if (inTerritory && this.trail.points.length > 2) {
		// Returned to territory - capture area
		this.captureTerritory();
		this.trail.clear();
	} else if (!inTerritory) {
		// Outside territory - add to trail
		this.trail.addPoint(this.x, this.y);
	}
};

Player.prototype.isInOwnTerritory = function() {
	return pointInPolygon({ x: this.x, y: this.y }, this.territory);
};

Player.prototype.captureTerritory = function() {
	if (this.trail.points.length < 3) return;
	
	// Cannot capture if snipped
	if (this.isSnipped) return;
	
	// Find where the trail intersects the territory boundary
	const trail = this.trail.points;
	const territory = this.territory;
	
	if (territory.length < 3) {
		// No existing territory - create from trail
		this.territory = trail.map(p => ({ x: p.x, y: p.y }));
		return;
	}
	
	// Find entry and exit points on territory boundary
	let entryIdx = -1, exitIdx = -1;
	let entryPoint = null, exitPoint = null;
	
	// Find where trail starts (exits territory)
	for (let i = 0; i < territory.length; i++) {
		const t1 = territory[i];
		const t2 = territory[(i + 1) % territory.length];
		
		// Check trail start
		if (entryIdx === -1 && trail.length > 1) {
			const intersection = getLineIntersection(trail[0], trail[1], t1, t2);
			if (intersection) {
				entryIdx = i;
				entryPoint = intersection;
			}
		}
		
		// Check trail end  
		if (trail.length > 1) {
			const lastIdx = trail.length - 1;
			const intersection = getLineIntersection(trail[lastIdx - 1], trail[lastIdx], t1, t2);
			if (intersection) {
				exitIdx = i;
				exitPoint = intersection;
			}
		}
	}
	
	// If we couldn't find proper intersections, use simpler approach
	if (entryIdx === -1 || exitIdx === -1) {
		// Find closest territory points to trail start/end
		let minDistStart = Infinity, minDistEnd = Infinity;
		
		for (let i = 0; i < territory.length; i++) {
			const t = territory[i];
			const distStart = Math.sqrt((t.x - trail[0].x) ** 2 + (t.y - trail[0].y) ** 2);
			const distEnd = Math.sqrt((t.x - trail[trail.length - 1].x) ** 2 + (t.y - trail[trail.length - 1].y) ** 2);
			
			if (distStart < minDistStart) {
				minDistStart = distStart;
				entryIdx = i;
				entryPoint = { x: trail[0].x, y: trail[0].y };
			}
			if (distEnd < minDistEnd) {
				minDistEnd = distEnd;
				exitIdx = i;
				exitPoint = { x: trail[trail.length - 1].x, y: trail[trail.length - 1].y };
			}
		}
	}
	
	if (entryIdx === -1 || exitIdx === -1) return;
	
	// Build new territory by combining trail with a territory boundary segment.
	// There are TWO possible boundary paths between exit and entry; picking the wrong one
	// can shrink/overwrite territory. We build both candidates and keep the one that
	// preserves/increases area.
	const n = territory.length;
	const prevArea = polygonAreaAbs(territory);
	const EPS_AREA = 1e-2;
	
	function clonePoint(p) {
		return { x: p.x, y: p.y };
	}
	
	function dedupeConsecutive(points) {
		if (!points || points.length === 0) return [];
		const out = [points[0]];
		for (let i = 1; i < points.length; i++) {
			const a = out[out.length - 1];
			const b = points[i];
			if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) continue;
			out.push(b);
		}
		// Drop last point if it equals first (we implicitly close polygons elsewhere)
		if (out.length > 2) {
			const a = out[0];
			const b = out[out.length - 1];
			if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) out.pop();
		}
		return out;
	}
	
	function collectBoundaryForward(fromSegIdx, toSegIdx) {
		// Traverse vertices from (fromSegIdx+1) up to and including toSegIdx.
		const pts = [];
		let i = (fromSegIdx + 1) % n;
		const visited = new Set();
		while (!visited.has(i)) {
			visited.add(i);
			pts.push(clonePoint(territory[i]));
			if (i === toSegIdx) break;
			i = (i + 1) % n;
		}
		return pts;
	}
	
	function collectBoundaryReverse(fromSegIdx, toSegIdx) {
		// Traverse vertices from fromSegIdx down to and including (toSegIdx+1).
		const pts = [];
		let i = fromSegIdx;
		const stop = (toSegIdx + 1) % n;
		const visited = new Set();
		while (!visited.has(i)) {
			visited.add(i);
			pts.push(clonePoint(territory[i]));
			if (i === stop) break;
			i = (i - 1 + n) % n;
		}
		return pts;
	}
	
	function buildCandidate(boundaryPts) {
		const poly = [];
		if (entryPoint) poly.push(clonePoint(entryPoint));
		for (const p of trail) poly.push(clonePoint(p));
		if (exitPoint) poly.push(clonePoint(exitPoint));
		for (const p of boundaryPts) poly.push(clonePoint(p));
		return dedupeConsecutive(poly);
	}
	
	const candForward = buildCandidate(collectBoundaryForward(exitIdx, entryIdx));
	const candReverse = buildCandidate(collectBoundaryReverse(exitIdx, entryIdx));
	
	const areaF = polygonAreaAbs(candForward);
	const areaR = polygonAreaAbs(candReverse);
	
	// Prefer the candidate that grows territory; never allow a meaningful shrink.
	let chosen = null;
	if (areaF >= areaR) chosen = candForward;
	else chosen = candReverse;
	
	const chosenArea = polygonAreaAbs(chosen);
	if (chosen && chosen.length >= 3 && chosenArea + EPS_AREA >= prevArea) {
		const areaDelta = Math.max(0, chosenArea - prevArea);
		this.territory = chosen;
		this._pendingTerritoryAreaGained += areaDelta;
	} else {
		// Fallback: choose the bigger one only if it doesn't shrink too much.
		const best = areaF >= areaR ? candForward : candReverse;
		const bestArea = Math.max(areaF, areaR);
		if (best && best.length >= 3 && bestArea + EPS_AREA >= prevArea) {
			const areaDelta = Math.max(0, bestArea - prevArea);
			this.territory = best;
			this._pendingTerritoryAreaGained += areaDelta;
		}
		// Otherwise keep existing territory (better than nuking it).
	}
};

function polygonAreaAbs(polygon) {
	if (!polygon || polygon.length < 3) return 0;
	let area = 0;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
	}
	return Math.abs(area / 2);
}

function getLineIntersection(p1, p2, p3, p4) {
	const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
	if (Math.abs(d) < 0.0001) return null;
	
	const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
	const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
	
	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
		return {
			x: p1.x + t * (p2.x - p1.x),
			y: p1.y + t * (p2.y - p1.y)
		};
	}
	return null;
}

// ===== POLYGON BOOLEAN OPERATIONS =====

/**
 * Check if two polygons overlap (bounding box + point-in-polygon check)
 */
export function polygonsOverlap(polyA, polyB) {
	if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;
	
	// Quick bounding box check first
	const boundsA = getPolygonBounds(polyA);
	const boundsB = getPolygonBounds(polyB);
	
	if (boundsA.maxX < boundsB.minX || boundsB.maxX < boundsA.minX ||
		boundsA.maxY < boundsB.minY || boundsB.maxY < boundsA.minY) {
		return false;
	}
	
	// Check if any vertex of A is inside B or vice versa
	for (const p of polyA) {
		if (pointInPolygon(p, polyB)) return true;
	}
	for (const p of polyB) {
		if (pointInPolygon(p, polyA)) return true;
	}
	
	// Check if any edges intersect
	for (let i = 0; i < polyA.length; i++) {
		const a1 = polyA[i];
		const a2 = polyA[(i + 1) % polyA.length];
		for (let j = 0; j < polyB.length; j++) {
			const b1 = polyB[j];
			const b2 = polyB[(j + 1) % polyB.length];
			if (getLineIntersection(a1, a2, b1, b2)) return true;
		}
	}
	
	return false;
}

function getPolygonBounds(polygon) {
	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	for (const p of polygon) {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	}
	return { minX, maxX, minY, maxY };
}

/**
 * Subtract polygon B from polygon A using Sutherland-Hodgman style clipping.
 * Returns the resulting polygon (A minus B), or A unchanged if no significant overlap.
 * This is a simplified version that works well for convex or mostly-convex game territories.
 */
export function subtractPolygon(subjectPoly, clipPoly) {
	if (!subjectPoly || subjectPoly.length < 3) return subjectPoly;
	if (!clipPoly || clipPoly.length < 3) return subjectPoly;
	
	// Check if polygons overlap at all
	if (!polygonsOverlap(subjectPoly, clipPoly)) {
		return subjectPoly;
	}
	
	// Use edge-based clipping: keep parts of subject that are OUTSIDE the clip polygon
	let outputList = subjectPoly.slice().map(p => ({ x: p.x, y: p.y }));
	
	// For each edge of the clip polygon, clip the subject polygon to keep the outside
	for (let i = 0; i < clipPoly.length; i++) {
		if (outputList.length === 0) break;
		
		const clipEdgeStart = clipPoly[i];
		const clipEdgeEnd = clipPoly[(i + 1) % clipPoly.length];
		
		const inputList = outputList;
		outputList = [];
		
		for (let j = 0; j < inputList.length; j++) {
			const current = inputList[j];
			const next = inputList[(j + 1) % inputList.length];
			
			const currentInside = isPointInsideEdge(current, clipEdgeStart, clipEdgeEnd);
			const nextInside = isPointInsideEdge(next, clipEdgeStart, clipEdgeEnd);
			
			// For subtraction, we want to keep points OUTSIDE the clip polygon
			// So we invert the logic: "inside" means inside clip (to be removed)
			
			if (!currentInside) {
				// Current is outside clip (keep it)
				outputList.push(current);
				if (nextInside) {
					// Going from outside to inside - add intersection point
					const intersection = lineEdgeIntersection(current, next, clipEdgeStart, clipEdgeEnd);
					if (intersection) outputList.push(intersection);
				}
			} else if (!nextInside) {
				// Current inside, next outside - add intersection point
				const intersection = lineEdgeIntersection(current, next, clipEdgeStart, clipEdgeEnd);
				if (intersection) outputList.push(intersection);
			}
		}
	}
	
	// Clean up the result
	if (outputList.length < 3) {
		// Polygon was completely consumed - return empty or minimal territory
		return [];
	}
	
	// Remove duplicate consecutive points
	const cleaned = [];
	for (let i = 0; i < outputList.length; i++) {
		const curr = outputList[i];
		const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : outputList[outputList.length - 1];
		if (Math.abs(curr.x - prev.x) > 0.1 || Math.abs(curr.y - prev.y) > 0.1) {
			cleaned.push(curr);
		}
	}
	
	return cleaned.length >= 3 ? cleaned : subjectPoly;
}

/**
 * Check if point is on the "inside" side of an edge (left side when walking edge direction)
 */
function isPointInsideEdge(point, edgeStart, edgeEnd) {
	return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - 
		   (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0;
}

/**
 * Find intersection of line segment (p1->p2) with edge (e1->e2)
 */
function lineEdgeIntersection(p1, p2, e1, e2) {
	const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
	const d2 = { x: e2.x - e1.x, y: e2.y - e1.y };
	
	const cross = d1.x * d2.y - d1.y * d2.x;
	if (Math.abs(cross) < 1e-10) return null;
	
	const t = ((e1.x - p1.x) * d2.y - (e1.y - p1.y) * d2.x) / cross;
	
	if (t >= 0 && t <= 1) {
		return {
			x: p1.x + t * d1.x,
			y: p1.y + t * d1.y
		};
	}
	return null;
}

/**
 * Subtract clipPoly from subjectPoly.
 * Returns the part of subjectPoly that is OUTSIDE clipPoly.
 * Uses a simple, robust approach for game territories.
 */
export function subtractTerritorySimple(subjectPoly, clipPoly) {
	if (!subjectPoly || subjectPoly.length < 3) return subjectPoly;
	if (!clipPoly || clipPoly.length < 3) return subjectPoly;
	
	// Quick overlap check
	if (!polygonsOverlap(subjectPoly, clipPoly)) {
		return subjectPoly;
	}
	
	// Count vertices inside/outside
	let insideCount = 0;
	for (const p of subjectPoly) {
		if (pointInPolygon(p, clipPoly)) insideCount++;
	}
	
	// If all vertices are inside, territory is consumed
	if (insideCount === subjectPoly.length) {
		return [];
	}
	
	// If no vertices are inside, check if clip is entirely inside subject
	if (insideCount === 0) {
		let clipInsideSubject = 0;
		for (const p of clipPoly) {
			if (pointInPolygon(p, subjectPoly)) clipInsideSubject++;
		}
		if (clipInsideSubject === clipPoly.length) {
			// Clip is entirely inside subject - create a cut
			return cutHoleInPolygon(subjectPoly, clipPoly);
		}
		// No real overlap despite polygonsOverlap returning true (edge cases)
		return subjectPoly;
	}
	
	// Standard case: partial overlap
	// Build result by tracing subject boundary, cutting at clip intersections
	const result = [];
	const n = subjectPoly.length;
	
	// Collect all points with their position info
	const allPoints = [];
	
	for (let i = 0; i < n; i++) {
		const curr = subjectPoly[i];
		const next = subjectPoly[(i + 1) % n];
		const currInside = pointInPolygon(curr, clipPoly);
		const nextInside = pointInPolygon(next, clipPoly);
		
		// Add current vertex if outside
		if (!currInside) {
			allPoints.push({ x: curr.x, y: curr.y, type: 'vertex', edge: i, t: 0 });
		}
		
		// Find intersections with clip boundary
		const intersections = [];
		for (let j = 0; j < clipPoly.length; j++) {
			const c1 = clipPoly[j];
			const c2 = clipPoly[(j + 1) % clipPoly.length];
			const inter = segmentIntersection(curr, next, c1, c2);
			if (inter) {
				intersections.push({
					x: inter.x,
					y: inter.y,
					type: 'intersection',
					edge: i,
					t: inter.t,
					clipEdge: j,
					clipT: inter.u,
					entering: !currInside // if curr is outside and we hit clip, we're entering
				});
			}
		}
		
		// Sort intersections by t (position along edge)
		intersections.sort((a, b) => a.t - b.t);
		
		// Add intersections
		for (const inter of intersections) {
			allPoints.push(inter);
		}
	}
	
	if (allPoints.length < 3) {
		return [];
	}
	
	// Now trace the boundary: follow subject outside clip, then clip boundary when inside
	// Find a starting point that's outside clip
	let startIdx = allPoints.findIndex(p => p.type === 'vertex' || !p.entering);
	if (startIdx === -1) startIdx = 0;
	
	const traced = [];
	const used = new Set();
	let idx = startIdx;
	let onClip = false;
	let clipIdx = -1;
	let clipDir = 1; // 1 = forward, -1 = backward
	let safety = 0;
	const maxIter = allPoints.length * 3 + clipPoly.length * 2;
	
	while (safety++ < maxIter) {
		const pt = allPoints[idx];
		
		if (used.has(idx) && traced.length > 2) {
			break;
		}
		used.add(idx);
		
		if (!onClip) {
			// We're tracing the subject boundary
			traced.push({ x: pt.x, y: pt.y });
			
			if (pt.type === 'intersection' && pt.entering) {
				// Entering clip - switch to tracing clip boundary
				onClip = true;
				clipIdx = pt.clipEdge;
				// Trace clip boundary in reverse (counter-clockwise) to stay on outside
				clipDir = -1;
			}
			
			// Move to next point on subject
			idx = (idx + 1) % allPoints.length;
		} else {
			// We're tracing the clip boundary
			// Add clip vertices until we find an exit intersection
			
			// Look for exit intersection on current or nearby edges
			let foundExit = false;
			for (let scan = 0; scan < allPoints.length; scan++) {
				const candidate = allPoints[scan];
				if (candidate.type === 'intersection' && !candidate.entering && !used.has(scan)) {
					// Check if this exit is on current clip edge or nearby
					const edgeDiff = (candidate.clipEdge - clipIdx + clipPoly.length) % clipPoly.length;
					if (clipDir === -1) {
						// Going backwards, check if candidate is on path
						const backDiff = (clipIdx - candidate.clipEdge + clipPoly.length) % clipPoly.length;
						if (backDiff <= 3 || edgeDiff <= 3) {
							// Add clip vertices between current position and exit
							addClipVerticesBetween(traced, clipPoly, clipIdx, candidate.clipEdge, clipDir);
							traced.push({ x: candidate.x, y: candidate.y });
							used.add(scan);
							idx = (scan + 1) % allPoints.length;
							onClip = false;
							foundExit = true;
							break;
						}
					}
				}
			}
			
			if (!foundExit) {
				// No exit found, add clip vertex and continue
				const clipVertex = clipPoly[clipIdx];
				if (pointInPolygon(clipVertex, subjectPoly)) {
					traced.push({ x: clipVertex.x, y: clipVertex.y });
				}
				clipIdx = (clipIdx + clipDir + clipPoly.length) % clipPoly.length;
				
				// Safety: if we've gone all the way around, break
				if (safety > clipPoly.length * 2) {
					onClip = false;
					idx = (idx + 1) % allPoints.length;
				}
			}
		}
		
		// Check if we've returned to start
		if (idx === startIdx && traced.length > 2) {
			break;
		}
	}
	
	// Clean up
	const cleaned = cleanPolygonPoints(traced);
	
	if (cleaned.length < 3) {
		return [];
	}
	
	// Ensure positive area
	const area = polygonAreaSigned(cleaned);
	if (Math.abs(area) < 50) {
		return [];
	}
	if (area < 0) {
		cleaned.reverse();
	}
	
	return cleaned;
}

/**
 * Add clip polygon vertices between two edge indices
 */
function addClipVerticesBetween(result, clipPoly, fromEdge, toEdge, dir) {
	const n = clipPoly.length;
	let idx = fromEdge;
	let safety = 0;
	while (idx !== toEdge && safety++ < n) {
		idx = (idx + dir + n) % n;
		if (idx !== toEdge) {
			result.push({ x: clipPoly[idx].x, y: clipPoly[idx].y });
		}
	}
}

/**
 * Segment intersection with t and u parameters
 */
function segmentIntersection(p1, p2, p3, p4) {
	const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
	if (Math.abs(d) < 1e-10) return null;
	
	const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
	const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
	
	if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
		return {
			x: p1.x + t * (p2.x - p1.x),
			y: p1.y + t * (p2.y - p1.y),
			t,
			u
		};
	}
	return null;
}

/**
 * Cut a hole in polygon by connecting to the hole boundary
 */
function cutHoleInPolygon(subject, hole) {
	// Find the rightmost point of the hole
	let holeRightIdx = 0;
	for (let i = 1; i < hole.length; i++) {
		if (hole[i].x > hole[holeRightIdx].x) {
			holeRightIdx = i;
		}
	}
	const holeRight = hole[holeRightIdx];
	
	// Find the closest point on subject boundary to the right of holeRight
	let bestDist = Infinity;
	let bestSubjectIdx = 0;
	for (let i = 0; i < subject.length; i++) {
		const p = subject[i];
		if (p.x >= holeRight.x) {
			const dist = Math.sqrt((p.x - holeRight.x) ** 2 + (p.y - holeRight.y) ** 2);
			if (dist < bestDist) {
				bestDist = dist;
				bestSubjectIdx = i;
			}
		}
	}
	
	// Build new polygon: subject up to bestSubjectIdx, then hole (reversed), then rest of subject
	const result = [];
	
	// Add subject vertices up to and including bestSubjectIdx
	for (let i = 0; i <= bestSubjectIdx; i++) {
		result.push({ x: subject[i].x, y: subject[i].y });
	}
	
	// Add hole vertices in reverse order starting from holeRightIdx
	for (let i = 0; i < hole.length; i++) {
		const idx = (holeRightIdx - i + hole.length) % hole.length;
		result.push({ x: hole[idx].x, y: hole[idx].y });
	}
	
	// Close back to the cut point on subject
	result.push({ x: subject[bestSubjectIdx].x, y: subject[bestSubjectIdx].y });
	
	// Add remaining subject vertices
	for (let i = bestSubjectIdx + 1; i < subject.length; i++) {
		result.push({ x: subject[i].x, y: subject[i].y });
	}
	
	return cleanPolygonPoints(result);
}

/**
 * Clean up polygon by removing duplicate/near-duplicate points
 */
function cleanPolygonPoints(points) {
	if (!points || points.length < 3) return points || [];
	
	const cleaned = [];
	for (const p of points) {
		if (cleaned.length === 0) {
			cleaned.push({ x: p.x, y: p.y });
		} else {
			const last = cleaned[cleaned.length - 1];
			if (Math.abs(p.x - last.x) > 1 || Math.abs(p.y - last.y) > 1) {
				cleaned.push({ x: p.x, y: p.y });
			}
		}
	}
	
	// Check first/last
	if (cleaned.length >= 2) {
		const first = cleaned[0];
		const last = cleaned[cleaned.length - 1];
		if (Math.abs(first.x - last.x) < 2 && Math.abs(first.y - last.y) < 2) {
			cleaned.pop();
		}
	}
	
	return cleaned;
}

/**
 * Calculate signed polygon area (positive = counter-clockwise)
 */
function polygonAreaSigned(polygon) {
	if (!polygon || polygon.length < 3) return 0;
	let area = 0;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
	}
	return area / 2;
}

/**
 * Find all intersections of line segment (p1->p2) with polygon edges
 */
function findAllPolygonIntersections(p1, p2, polygon) {
	const intersections = [];
	
	for (let i = 0; i < polygon.length; i++) {
		const e1 = polygon[i];
		const e2 = polygon[(i + 1) % polygon.length];
		const intersection = getLineIntersection(p1, p2, e1, e2);
		if (intersection) {
			intersections.push(intersection);
		}
	}
	
	return intersections;
}

/**
 * Find where line segment (p1->p2) intersects any edge of polygon
 */
function findPolygonEdgeIntersection(p1, p2, polygon) {
	let closest = null;
	let closestDist = Infinity;
	
	for (let i = 0; i < polygon.length; i++) {
		const e1 = polygon[i];
		const e2 = polygon[(i + 1) % polygon.length];
		const intersection = getLineIntersection(p1, p2, e1, e2);
		if (intersection) {
			const dist = (intersection.x - p1.x) ** 2 + (intersection.y - p1.y) ** 2;
			if (dist < closestDist) {
				closestDist = dist;
				closest = intersection;
			}
		}
	}
	
	return closest;
}

Player.prototype.startSnip = function(collisionPoint, hitInfo) {
	if (this.isSnipped) return; // Ignore if already snipped (per MVP recommendation)
	
	this.isSnipped = true;
	this.snipStartPoint = { x: collisionPoint.x, y: collisionPoint.y };
	this.snipTrailIndex = hitInfo.index;
	this.snipProgressDist = 0;
	this.snipElapsed = 0;
	
	// Calculate total trail length from snip point to player
	let totalTrailLength = 0;
	
	// Distance from snip point to next trail point
	if (hitInfo.index + 1 < this.trail.points.length) {
		const nextPoint = this.trail.points[hitInfo.index + 1];
		totalTrailLength += Math.sqrt(
			(collisionPoint.x - nextPoint.x) ** 2 + 
			(collisionPoint.y - nextPoint.y) ** 2
		);
	}
	
	// Distance along remaining trail segments
	for (let i = hitInfo.index + 1; i < this.trail.points.length - 1; i++) {
		const p1 = this.trail.points[i];
		const p2 = this.trail.points[i + 1];
		totalTrailLength += Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
	}
	
	// Distance from last trail point to player
	if (this.trail.points.length > 0) {
		const lastPoint = this.trail.points[this.trail.points.length - 1];
		totalTrailLength += Math.sqrt((lastPoint.x - this.x) ** 2 + (lastPoint.y - this.y) ** 2);
	}
	
	this.snipTotalTrailLength = totalTrailLength;
	
	// Initial displayed timer (exactness comes from updateSnip recalculation).
	// We keep this consistent with our exponential model at t=0:
	// remainingTime = (1/k) * ln(1 + remainingDist * k / v0)
	const speedMultiplier = this.isExhausted ? consts.EXHAUSTED_SPEED_MULT : 1.0;
	const currentSpeedPerFrame = this.speed * speedMultiplier;
	const fps = 60;
	const v0 = currentSpeedPerFrame * consts.SNIP_FUSE_SPEED_MULT * fps;
	const k = consts.SNIP_EXP_ACCEL_PER_SEC;
	const initialRemaining = k > 0 ? (Math.log(1 + (totalTrailLength * k) / v0) / k) : (totalTrailLength / v0);
	this.snipMaxTime = initialRemaining;
	this.snipTimeRemaining = initialRemaining;
	
	// Initialize fuse position
	this.snipFusePosition = {
		x: collisionPoint.x,
		y: collisionPoint.y,
		segmentIndex: hitInfo.index
	};
};

Player.prototype.updateSnip = function(deltaSeconds) {
	if (!this.isSnipped || this.dead) return;
	
	// Safety check for trail and start point
	if (!this.trail || !this.trail.points || this.trail.points.length === 0 || !this.snipStartPoint) {
		this.die();
		return;
	}
	
	// Exponential acceleration: v(t) = v0 * exp(k * t)
	// We recompute v0 from the player's current effective speed so the fuse is always >= 1.5x faster,
	// even if debuffs/buffs change mid-snip.
	this.snipElapsed += deltaSeconds;
	const speedMultiplier = this.isExhausted ? consts.EXHAUSTED_SPEED_MULT : 1.0;
	const currentSpeedPerFrame = this.speed * speedMultiplier;
	const fps = deltaSeconds > 0 ? (1 / deltaSeconds) : 60;
	const v0 = currentSpeedPerFrame * consts.SNIP_FUSE_SPEED_MULT * fps;
	const k = consts.SNIP_EXP_ACCEL_PER_SEC;
	
	// Grace period: fuse doesn't move during grace period
	const gracePeriod = (consts.SNIP_GRACE_PERIOD ?? 0.35) + (this.snipGraceBonusSec || 0);
	const effectiveElapsed = Math.max(0, this.snipElapsed - gracePeriod);
	
	const accelFactor = k > 0 ? Math.exp(k * effectiveElapsed) : 1;
	const desiredFuseSpeedPerSec = v0 * accelFactor;
	// Cap fuse speed relative to player's current effective speed (generous cap)
	const fuseCapPerSec = currentSpeedPerFrame * (consts.SNIP_FUSE_MAX_SPEED_MULT ?? 6.0) * fps;
	const fuseSpeedPerSec = Math.min(desiredFuseSpeedPerSec, fuseCapPerSec);
	
	// Only advance fuse after grace period
	if (this.snipElapsed > gracePeriod) {
		// Advance fuse along the trail (units/sec * sec = units)
		this.snipProgressDist += fuseSpeedPerSec * deltaSeconds;
	}
	
	// Calculate current total trail length from start point to player
	let currentTotalLength = 0;
	let currentIdx = this.snipTrailIndex;
	
	if (currentIdx + 1 < this.trail.points.length) {
		const nextPoint = this.trail.points[currentIdx + 1];
		currentTotalLength += Math.sqrt(
			(this.snipStartPoint.x - nextPoint.x) ** 2 + 
			(this.snipStartPoint.y - nextPoint.y) ** 2
		);
		
		for (let i = currentIdx + 1; i < this.trail.points.length - 1; i++) {
			const p1 = this.trail.points[i];
			const p2 = this.trail.points[i + 1];
			currentTotalLength += Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
		}
	}
	
	const lastPoint = this.trail.points[this.trail.points.length - 1];
	const distToPlayer = Math.sqrt((lastPoint.x - this.x) ** 2 + (lastPoint.y - this.y) ** 2);
	currentTotalLength += distToPlayer;
	this.snipTotalTrailLength = currentTotalLength;

	// Calculate fuse position and remaining distance
	let remainingTrailDist = 0;
	let currentSegment = this.snipTrailIndex;
	let fuseX = this.snipStartPoint.x;
	let fuseY = this.snipStartPoint.y;
	let remainingDist = this.snipProgressDist;
	
	// Start from snip point and walk along trail to find current fuse position
	if (currentSegment + 1 < this.trail.points.length) {
		const nextPoint = this.trail.points[currentSegment + 1];
		const segDist = Math.sqrt(
			(this.snipStartPoint.x - nextPoint.x) ** 2 + 
			(this.snipStartPoint.y - nextPoint.y) ** 2
		);
		
		if (remainingDist < segDist) {
			const t = remainingDist / segDist;
			fuseX = this.snipStartPoint.x + t * (nextPoint.x - this.snipStartPoint.x);
			fuseY = this.snipStartPoint.y + t * (nextPoint.y - this.snipStartPoint.y);
		} else {
			remainingDist -= segDist;
			currentSegment++;
			
			while (currentSegment + 1 < this.trail.points.length) {
				const p1 = this.trail.points[currentSegment];
				const p2 = this.trail.points[currentSegment + 1];
				const segLen = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
				
				if (remainingDist < segLen) {
					const t = remainingDist / segLen;
					fuseX = p1.x + t * (p2.x - p1.x);
					fuseY = p1.y + t * (p2.y - p1.y);
					break;
				}
				remainingDist -= segLen;
				currentSegment++;
			}
			
			if (currentSegment >= this.trail.points.length - 1) {
				const lp = this.trail.points[this.trail.points.length - 1];
				fuseX = lp.x;
				fuseY = lp.y;
			}
		}
	}
	
	remainingTrailDist = Math.max(0, currentTotalLength - this.snipProgressDist);

	// Check if fuse caught the player
	if (this.snipProgressDist >= currentTotalLength) {
		this.die();
		return;
	}

	// Update fuse position for rendering
	this.snipFusePosition = {
		x: fuseX,
		y: fuseY,
		segmentIndex: currentSegment
	};
	
	// Update timer based on remaining distance.
	// - If we're capped, use linear remainingDist / capSpeed (since acceleration no longer applies).
	// - Otherwise use exponential model from current t.
	// - Add remaining grace period if still in it.
	const remainingGrace = Math.max(0, gracePeriod - this.snipElapsed);
	const isCapped = desiredFuseSpeedPerSec >= fuseCapPerSec;
	let chaseTime;
	if (isCapped) {
		chaseTime = remainingTrailDist / fuseCapPerSec;
	} else if (k > 0) {
		const denom = v0 * accelFactor;
		chaseTime = Math.log(1 + (remainingTrailDist * k) / denom) / k;
	} else {
		chaseTime = remainingTrailDist / v0;
	}
	this.snipTimeRemaining = remainingGrace + chaseTime;
	
	// Check if timer expired or fuse caught player (redundant but safe)
	if (this.snipTimeRemaining <= 0) {
		this.die();
		return;
	}
	
	// Check if reached safety
	if (this.isInOwnTerritory()) {
		this.clearSnip();
	}
};

Player.prototype.clearSnip = function() {
	this.isSnipped = false;
	this.snipTimeRemaining = 0;
	this.snipFusePosition = null;
	this.snipElapsed = 0;
	this.trail.clear();
};

Player.prototype.die = function() {
	this.dead = true;
};

// Recalculate size scale based on current level
Player.prototype.updateSizeScale = function() {
	const sizeScalePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL ?? 0.05;
	const sizeScaleMax = consts.PLAYER_SIZE_SCALE_MAX ?? 1.6;
	this.sizeScale = Math.min(sizeScaleMax, Math.max(1.0, 1.0 + (this.level - 1) * sizeScalePerLevel));
};

// Get the player's effective collision radius (used by server for collisions)
Player.prototype.getScaledRadius = function() {
	return PLAYER_RADIUS * (this.sizeScale || 1.0);
};

Player.prototype.render = function(ctx, fade, outlineThicknessMultiplier) {
	fade = fade || 1;
	outlineThicknessMultiplier = outlineThicknessMultiplier || 1;
	
	// Snipped visual effect: flashing ghost appearance
	let snipAlpha = 1;
	if (this.isSnipped) {
		const time = Date.now() / 100;
		// Fast flashing effect (0.3 to 0.8 alpha)
		snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
	}
	
	// Render territory
	if (this.territory && this.territory.length >= 3) {
		ctx.fillStyle = this.baseColor.deriveAlpha(0.4 * fade * snipAlpha).rgbString();
		ctx.beginPath();
		ctx.moveTo(this.territory[0].x, this.territory[0].y);
		for (let i = 1; i < this.territory.length; i++) {
			ctx.lineTo(this.territory[i].x, this.territory[i].y);
		}
		ctx.closePath();
		ctx.fill();
		
		// Territory border outline (2-3px, using owner's color)
		const baseOutlineWidth = 2.5;
		const outlineWidth = baseOutlineWidth * outlineThicknessMultiplier;
		ctx.strokeStyle = this.baseColor.deriveAlpha(0.9 * fade * snipAlpha).rgbString();
		ctx.lineWidth = outlineWidth;
		ctx.lineJoin = 'round';
		ctx.stroke();
	}
	
	// Render body (trail, player circle, name, etc)
	this.renderBody(ctx, fade);
};

// Render just the player body, trail, and overlays (not territory)
// Used when territories are rendered separately for proper overlap resolution
Player.prototype.renderBody = function(ctx, fade) {
	fade = fade || 1;
	
	// Apply size scaling based on level
	const scaledRadius = PLAYER_RADIUS * (this.sizeScale || 1.0);
	
	// Snipped visual effect: flashing ghost appearance
	let snipAlpha = 1;
	if (this.isSnipped) {
		const time = Date.now() / 100;
		// Fast flashing effect (0.3 to 0.8 alpha)
		snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
	}
	
	// Render trail
	this.trail.render(ctx);
	
	// Render player shadow
	ctx.fillStyle = this.shadowColor.deriveAlpha(fade * snipAlpha).rgbString();
	ctx.beginPath();
	ctx.arc(this.x + 2, this.y + 4, scaledRadius, 0, Math.PI * 2);
	ctx.fill();
	
	// Render player body
	if (this.isSnipped) {
		// Ghost effect: red-tinted, semi-transparent
		const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 4);
		ctx.fillStyle = `rgba(255, ${Math.floor(100 * pulse)}, ${Math.floor(100 * pulse)}, ${fade * snipAlpha})`;
	} else {
		ctx.fillStyle = this.baseColor.deriveAlpha(fade).rgbString();
	}
	ctx.beginPath();
	ctx.arc(this.x, this.y, scaledRadius, 0, Math.PI * 2);
	ctx.fill();
	
	// Snipped glow ring
	if (this.isSnipped) {
		const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 6);
		ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + 0.5 * pulse})`;
		ctx.lineWidth = 3 + 2 * pulse;
		ctx.beginPath();
		ctx.arc(this.x, this.y, scaledRadius + 4 + 2 * pulse, 0, Math.PI * 2);
		ctx.stroke();
	}
	
	// Direction indicator
	const indicatorX = this.x + Math.cos(this.angle) * scaledRadius * 0.6;
	const indicatorY = this.y + Math.sin(this.angle) * scaledRadius * 0.6;
	ctx.fillStyle = this.lightBaseColor.deriveAlpha(fade * snipAlpha).rgbString();
	ctx.beginPath();
	ctx.arc(indicatorX, indicatorY, scaledRadius * 0.3, 0, Math.PI * 2);
	ctx.fill();
	
	// Render name (with "SNIPPED!" indicator)
	ctx.fillStyle = this.shadowColor.deriveAlpha(fade).rgbString();
	ctx.textAlign = "center";
	ctx.font = "bold 14px Arial";
	if (this.isSnipped) {
		ctx.fillStyle = "rgba(255, 50, 50, 1)";
		ctx.fillText("SNIPPED!", this.x, this.y - scaledRadius - 22);
		ctx.fillStyle = this.shadowColor.deriveAlpha(fade * snipAlpha).rgbString();
	}
	ctx.fillText(this.name, this.x, this.y - scaledRadius - 8);

	// Render tiny stamina bar under player
	if (this.stamina !== undefined) {
		const barWidth = scaledRadius * 2;
		const barHeight = 4;
		const barX = this.x - barWidth / 2;
		const barY = this.y + scaledRadius + 8;
		
		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.fillRect(barX, barY, barWidth, barHeight);
		
		// Foreground
		const staminaRatio = this.stamina / this.maxStamina;
		if (this.isExhausted) {
			ctx.fillStyle = `rgba(255, 68, 68, ${fade})`;
		} else if (staminaRatio < 0.3) {
			ctx.fillStyle = `rgba(255, 204, 0, ${fade})`;
		} else {
			ctx.fillStyle = `rgba(68, 255, 68, ${fade})`;
		}
		
		ctx.fillRect(barX, barY, barWidth * staminaRatio, barHeight);
	}
};

Player.prototype.serialData = function() {
	return {
		base: this.baseColor,
		num: this.num,
		name: this.name,
		x: this.x,
		y: this.y,
		spawnX: this.spawnX,
		spawnY: this.spawnY,
		angle: this.angle,
		targetAngle: this.targetAngle,
		territory: this.territory,
		trail: this.trail.serialData(),
		waitLag: this.waitLag,
		// XP/Leveling fields
		level: this.level,
		xp: this.xp,
		sizeScale: this.sizeScale,
		// Stamina fields
		staminaRegenMult: this.staminaRegenMult,
		staminaDrainMult: this.staminaDrainMult,
		speedMult: this.speedMult,
		snipGraceBonusSec: this.snipGraceBonusSec,
		stamina: this.stamina,
		maxStamina: this.maxStamina,
		isExhausted: this.isExhausted,
		isSnipped: this.isSnipped,
		snipTimeRemaining: this.snipTimeRemaining,
		snipMaxTime: this.snipMaxTime,
		snipStartPoint: this.snipStartPoint,
		snipProgressDist: this.snipProgressDist,
		snipTrailIndex: this.snipTrailIndex,
		snipFusePosition: this.snipFusePosition,
		snipTotalTrailLength: this.snipTotalTrailLength,
		snipElapsed: this.snipElapsed,
		hp: this.hp,
		maxHp: this.maxHp
	};
};

// Legacy compatibility
Object.defineProperties(Player.prototype, {
	posX: {
		get: function() { return this.x; },
		set: function(v) { this.x = v; }
	},
	posY: {
		get: function() { return this.y; },
		set: function(v) { this.y = v; }
	},
	row: {
		get: function() { return Math.floor(this.y / consts.CELL_WIDTH); }
	},
	col: {
		get: function() { return Math.floor(this.x / consts.CELL_WIDTH); }
	},
	currentHeading: {
		get: function() {
			// Convert angle to heading (0=up, 1=right, 2=down, 3=left)
			const normalized = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
			if (normalized < Math.PI * 0.25 || normalized >= Math.PI * 1.75) return 1; // right
			if (normalized < Math.PI * 0.75) return 2; // down
			if (normalized < Math.PI * 1.25) return 3; // left
			return 0; // up
		}
	}
});
