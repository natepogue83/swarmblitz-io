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
		if (this.points.length < 2) return false;
		
		const checkPoint = { x, y };
		const skipDistSq = skipDist * skipDist;
		
		// Check if point is near any trail segment (excluding recent points)
		for (let i = 0; i < this.points.length - 1; i++) {
			const p1 = this.points[i];
			const p2 = this.points[i + 1];
			
			// Skip recent segments for self-collision
			if (skipDist > 0 && i >= this.points.length - 3) continue;
			
			const dist = pointToSegmentDistance(checkPoint, p1, p2);
			if (dist < PLAYER_RADIUS) {
				return true;
			}
		}
		return false;
	}
	
	render(ctx) {
		if (this.points.length < 2) return;
		
		ctx.strokeStyle = this.player.tailColor.rgbString();
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
	
	serialData() {
		return this.points.slice();
	}
}

function pointToSegmentDistance(p, v, w) {
	const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
	if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
	
	let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
	t = Math.max(0, Math.min(1, t));
	
	const projX = v.x + t * (w.x - v.x);
	const projY = v.y + t * (w.y - v.y);
	
	return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
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
	this.angle = sdata.angle || 0;
	this.targetAngle = sdata.targetAngle || this.angle;
	this.speed = consts.SPEED;
	
	// Player info
	this.num = sdata.num;
	this.name = sdata.name || "Player " + (this.num + 1);
	this.waitLag = sdata.waitLag || 0;
	this.dead = false;
	
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

Player.prototype.move = function() {
	if (this.waitLag < consts.NEW_PLAYER_LAG) {
		this.waitLag++;
		return;
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
	
	// Move in current direction
	this.x += Math.cos(this.angle) * this.speed;
	this.y += Math.sin(this.angle) * this.speed;
	
	// Check bounds
	if (this.x < PLAYER_RADIUS || this.x > this.mapSize - PLAYER_RADIUS ||
		this.y < PLAYER_RADIUS || this.y > this.mapSize - PLAYER_RADIUS) {
		this.dead = true;
		return;
	}
	
	// Trail logic
	const inTerritory = this.isInOwnTerritory();
	
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
	
	// Build new territory by combining trail with territory segment
	const newTerritory = [];
	
	// Add entry point
	if (entryPoint) newTerritory.push({ x: entryPoint.x, y: entryPoint.y });
	
	// Add trail points
	for (const p of trail) {
		newTerritory.push({ x: p.x, y: p.y });
	}
	
	// Add exit point
	if (exitPoint) newTerritory.push({ x: exitPoint.x, y: exitPoint.y });
	
	// Add territory segment from exit back to entry
	if (exitIdx !== entryIdx) {
		let i = (exitIdx + 1) % territory.length;
		const visited = new Set();
		while (i !== entryIdx && !visited.has(i)) {
			visited.add(i);
			newTerritory.push({ x: territory[i].x, y: territory[i].y });
			i = (i + 1) % territory.length;
		}
	}
	
	// Validate and set new territory
	if (newTerritory.length >= 3) {
		this.territory = newTerritory;
	}
};

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

Player.prototype.die = function() {
	this.dead = true;
};

Player.prototype.render = function(ctx, fade) {
	fade = fade || 1;
	
	// Render territory
	if (this.territory && this.territory.length >= 3) {
		ctx.fillStyle = this.baseColor.deriveAlpha(0.4 * fade).rgbString();
		ctx.beginPath();
		ctx.moveTo(this.territory[0].x, this.territory[0].y);
		for (let i = 1; i < this.territory.length; i++) {
			ctx.lineTo(this.territory[i].x, this.territory[i].y);
		}
		ctx.closePath();
		ctx.fill();
		
		// Territory border
		ctx.strokeStyle = this.baseColor.deriveAlpha(0.7 * fade).rgbString();
		ctx.lineWidth = 3;
		ctx.stroke();
	}
	
	// Render trail
	this.trail.render(ctx);
	
	// Render player shadow
	ctx.fillStyle = this.shadowColor.deriveAlpha(fade).rgbString();
	ctx.beginPath();
	ctx.arc(this.x + 2, this.y + 4, PLAYER_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	
	// Render player
	ctx.fillStyle = this.baseColor.deriveAlpha(fade).rgbString();
	ctx.beginPath();
	ctx.arc(this.x, this.y, PLAYER_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	
	// Direction indicator
	const indicatorX = this.x + Math.cos(this.angle) * PLAYER_RADIUS * 0.6;
	const indicatorY = this.y + Math.sin(this.angle) * PLAYER_RADIUS * 0.6;
	ctx.fillStyle = this.lightBaseColor.deriveAlpha(fade).rgbString();
	ctx.beginPath();
	ctx.arc(indicatorX, indicatorY, PLAYER_RADIUS * 0.3, 0, Math.PI * 2);
	ctx.fill();
	
	// Render name
	ctx.fillStyle = this.shadowColor.deriveAlpha(fade).rgbString();
	ctx.textAlign = "center";
	ctx.font = "bold 14px Arial";
	ctx.fillText(this.name, this.x, this.y - PLAYER_RADIUS - 8);
};

Player.prototype.serialData = function() {
	return {
		base: this.baseColor,
		num: this.num,
		name: this.name,
		x: this.x,
		y: this.y,
		angle: this.angle,
		targetAngle: this.targetAngle,
		territory: this.territory,
		trail: this.trail.serialData(),
		waitLag: this.waitLag
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
