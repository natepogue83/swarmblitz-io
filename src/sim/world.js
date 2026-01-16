/**
 * World Simulation - Authoritative game state
 * 
 * This is the core simulation that runs on the Durable Object.
 * It is completely decoupled from networking - it just advances state.
 * 
 * Key design principles:
 * - Deterministic: same inputs = same outputs
 * - Decoupled from network tick rate
 * - Delta tracking for efficient replication
 */

import { consts } from '../../config.js';
import Color from '../core/color.js';
import { DeltaFlags, EventType } from '../net/protocol.js';

// Constants
const PLAYER_RADIUS = 15;
const TRAIL_MIN_DIST = 10;

/**
 * Point-in-polygon test
 */
function pointInPolygon(point, polygon) {
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

/**
 * Polygon area (shoelace formula)
 */
function polygonArea(polygon) {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(area / 2);
}

/**
 * Line intersection
 */
function getLineIntersection(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 0.0001) return null;
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }
  return null;
}

/**
 * Distance from point to line segment
 */
function pointToSegmentDistance(p, v, w) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Player entity
 */
class Player {
  constructor(id, name, x, y, color) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    
    // Color
    this.color = color;
    
    // Stats
    this.level = 1;
    this.xp = 0;
    this.hp = consts.PLAYER_MAX_HP || 100;
    this.maxHp = consts.PLAYER_MAX_HP || 100;
    this.sizeScale = 1.0;
    
    // State
    this.dead = false;
    this.isSnipped = false;
    this.snippedBy = null;
    this.waitLag = 0;
    
    // Territory and trail
    this.territory = [];
    this.trail = [];
    
    // Drones
    this.drones = [];
    this.droneCount = 1;
    
    // Speed buff tracking
    this.trailStartTime = null;
    this.currentSpeedBuff = 1.0;
    
    // Snip state
    this.snipProgressDist = 0;
    this.snipTotalTrailLength = 0;
    this.snipElapsed = 0;
    this.snipFusePosition = null;
    
    // Delta tracking (what changed since last network frame)
    this._dirty = DeltaFlags.POSITION | DeltaFlags.ANGLE | DeltaFlags.HP | DeltaFlags.LEVEL | DeltaFlags.TERRITORY;
    this._lastX = x;
    this._lastY = y;
    this._lastAngle = this.angle;
    this._lastHp = this.hp;
    this._lastXp = this.xp;
    this._lastLevel = this.level;
    this._territoryDirty = true;
    this._trailDirty = false;
  }
  
  /**
   * Initialize starting territory (circle around spawn)
   */
  initTerritory(mapSize) {
    const radius = consts.CELL_WIDTH * 1.5;
    const segments = 12;
    this.territory = [];
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      this.territory.push({
        x: this.x + Math.cos(angle) * radius,
        y: this.y + Math.sin(angle) * radius,
      });
    }
    this._territoryDirty = true;
    this._dirty |= DeltaFlags.TERRITORY;
  }
  
  /**
   * Check if player is in their own territory
   */
  isInOwnTerritory() {
    return pointInPolygon({ x: this.x, y: this.y }, this.territory);
  }
  
  /**
   * Get scaled collision radius
   */
  getScaledRadius() {
    return PLAYER_RADIUS * this.sizeScale;
  }
  
  /**
   * Calculate speed buff based on time outside territory
   */
  calculateSpeedBuff(timeOutsideSec) {
    const maxBuff = consts.TRAIL_SPEED_BUFF_MAX || 1.4;
    const rampTime = consts.TRAIL_SPEED_BUFF_RAMP_TIME || 5;
    const ease = consts.TRAIL_SPEED_BUFF_EASE || 2;
    
    const progress = Math.min(1, timeOutsideSec / rampTime);
    const easedProgress = Math.pow(progress, ease);
    
    return 1.0 + (maxBuff - 1.0) * easedProgress;
  }
  
  /**
   * Move player for one simulation step
   */
  move(deltaSeconds, mapSize, now) {
    if (this.dead) return;
    
    // Wait lag (spawn protection)
    if (this.waitLag < consts.NEW_PLAYER_LAG) {
      this.waitLag += deltaSeconds * 60;
      return;
    }
    
    // Handle snip
    if (this.isSnipped) {
      this.updateSnip(deltaSeconds);
      if (this.dead) return;
    }
    
    // Smooth angle interpolation
    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    const turnSpeed = 0.15 * deltaSeconds * 60;
    if (Math.abs(angleDiff) < turnSpeed) {
      this.angle = this.targetAngle;
    } else {
      this.angle += Math.sign(angleDiff) * turnSpeed;
    }
    
    // Speed buff calculation
    const inTerritory = this.isInOwnTerritory();
    
    if (inTerritory) {
      this.trailStartTime = null;
      this.currentSpeedBuff = 1.0;
      
      // HP regen in territory
      if (this.hp < this.maxHp) {
        this.hp += (consts.PLAYER_HP_REGEN_IN_TERRITORY || 50) * deltaSeconds;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        this._dirty |= DeltaFlags.HP;
      }
    } else if (this.isSnipped) {
      this.trailStartTime = null;
      this.currentSpeedBuff = 1.0;
    } else {
      if (this.trailStartTime === null) {
        this.trailStartTime = now;
      }
      const timeOutsideSec = (now - this.trailStartTime) / 1000;
      this.currentSpeedBuff = this.calculateSpeedBuff(timeOutsideSec);
    }
    
    // Movement
    const baseSpeed = consts.SPEED || 4;
    const speed = baseSpeed * this.currentSpeedBuff;
    
    this.x += Math.cos(this.angle) * speed * deltaSeconds * 60;
    this.y += Math.sin(this.angle) * speed * deltaSeconds * 60;
    
    // Clamp to map
    this.x = Math.max(PLAYER_RADIUS, Math.min(mapSize - PLAYER_RADIUS, this.x));
    this.y = Math.max(PLAYER_RADIUS, Math.min(mapSize - PLAYER_RADIUS, this.y));
    
    // Trail management
    if (this.isSnipped) {
      if (!inTerritory) {
        this.addTrailPoint(this.x, this.y);
      }
      return;
    }
    
    if (inTerritory && this.trail.length > 2) {
      // Capture territory
      this.captureTerritory();
      this.trail = [];
      this._trailDirty = true;
      this._dirty |= DeltaFlags.TRAIL;
    } else if (!inTerritory) {
      this.addTrailPoint(this.x, this.y);
    }
    
    // Track position changes for delta
    if (Math.abs(this.x - this._lastX) > 0.5 || Math.abs(this.y - this._lastY) > 0.5) {
      this._dirty |= DeltaFlags.POSITION;
      this._lastX = this.x;
      this._lastY = this.y;
    }
    
    if (Math.abs(this.angle - this._lastAngle) > 0.01) {
      this._dirty |= DeltaFlags.ANGLE;
      this._lastAngle = this.angle;
    }
  }
  
  /**
   * Add a point to the trail
   */
  addTrailPoint(x, y) {
    if (this.trail.length > 0) {
      const last = this.trail[this.trail.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < TRAIL_MIN_DIST) return;
    }
    this.trail.push({ x, y });
    this._trailDirty = true;
    this._dirty |= DeltaFlags.TRAIL;
  }
  
  /**
   * Check if a point hits this player's trail
   */
  hitsTrail(x, y, skipDist = 0) {
    if (this.trail.length < 2) return null;
    
    for (let i = 0; i < this.trail.length - 1; i++) {
      if (skipDist > 0 && i >= this.trail.length - 3) continue;
      
      const p1 = this.trail[i];
      const p2 = this.trail[i + 1];
      const dist = pointToSegmentDistance({ x, y }, p1, p2);
      
      if (dist < PLAYER_RADIUS) {
        return { index: i, point: { x, y } };
      }
    }
    return null;
  }
  
  /**
   * Start snip (trail was hit)
   */
  startSnip(collisionPoint, hitInfo, snipperNum) {
    if (this.isSnipped) return;
    
    this.isSnipped = true;
    this.snippedBy = snipperNum;
    this.snipProgressDist = 0;
    this.snipElapsed = 0;
    this.trailStartTime = null;
    this.currentSpeedBuff = 1.0;
    
    // Calculate total trail length
    let totalLength = 0;
    if (hitInfo.index + 1 < this.trail.length) {
      const nextPoint = this.trail[hitInfo.index + 1];
      totalLength += Math.hypot(collisionPoint.x - nextPoint.x, collisionPoint.y - nextPoint.y);
    }
    
    for (let i = hitInfo.index + 1; i < this.trail.length - 1; i++) {
      const p1 = this.trail[i];
      const p2 = this.trail[i + 1];
      totalLength += Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    
    if (this.trail.length > 0) {
      const lastPoint = this.trail[this.trail.length - 1];
      totalLength += Math.hypot(lastPoint.x - this.x, lastPoint.y - this.y);
    }
    
    this.snipTotalTrailLength = totalLength;
    this.snipFusePosition = { x: collisionPoint.x, y: collisionPoint.y, segmentIndex: hitInfo.index };
  }
  
  /**
   * Update snip fuse progress
   */
  updateSnip(deltaSeconds) {
    if (!this.isSnipped || this.dead) return;
    
    this.snipElapsed += deltaSeconds;
    
    const baseSpeed = consts.SPEED || 4;
    const fuseMult = consts.SNIP_FUSE_SPEED_MULT || 1.5;
    const k = consts.SNIP_EXP_ACCEL_PER_SEC || 0.6375;
    const gracePeriod = consts.SNIP_GRACE_PERIOD || 0.25;
    
    const effectiveElapsed = Math.max(0, this.snipElapsed - gracePeriod);
    const v0 = baseSpeed * fuseMult * 60;
    const accelFactor = k > 0 ? Math.exp(k * effectiveElapsed) : 1;
    const fuseSpeed = v0 * accelFactor;
    
    if (this.snipElapsed > gracePeriod) {
      this.snipProgressDist += fuseSpeed * deltaSeconds;
    }
    
    if (this.snipProgressDist >= this.snipTotalTrailLength) {
      this.die();
      return;
    }
    
    if (this.isInOwnTerritory()) {
      this.clearSnip();
    }
  }
  
  /**
   * Clear snip state (reached safety)
   */
  clearSnip() {
    this.isSnipped = false;
    this.snippedBy = null;
    this.snipProgressDist = 0;
    this.snipFusePosition = null;
    this.snipElapsed = 0;
    this.trail = [];
    this._trailDirty = true;
    this._dirty |= DeltaFlags.TRAIL;
  }
  
  /**
   * Capture territory from trail - preserves the actual shape drawn by player
   * This merges the trail with the existing territory boundary properly
   */
  captureTerritory() {
    if (this.trail.length < 3) return;
    if (this.isSnipped) return;
    
    const trail = this.trail;
    const territory = this.territory;
    
    // If no existing territory, create from trail
    if (territory.length < 3) {
      this.territory = trail.map(p => ({ x: p.x, y: p.y }));
      this._territoryDirty = true;
      this._dirty |= DeltaFlags.TERRITORY;
      return;
    }
    
    const prevArea = Math.abs(polygonArea(territory));
    const n = territory.length;
    
    // Find entry point (where trail starts, near territory)
    // and exit point (where trail ends, near territory)
    let entryIdx = -1, exitIdx = -1;
    let entryPoint = null, exitPoint = null;
    
    // Check each territory edge for intersection with trail start/end
    for (let i = 0; i < n; i++) {
      const t1 = territory[i];
      const t2 = territory[(i + 1) % n];
      
      // Check trail start (first segment)
      if (entryIdx === -1 && trail.length > 1) {
        const intersection = this.lineIntersection(trail[0], trail[1], t1, t2);
        if (intersection) {
          entryIdx = i;
          entryPoint = intersection;
        }
      }
      
      // Check trail end (last segment)
      if (trail.length > 1) {
        const lastIdx = trail.length - 1;
        const intersection = this.lineIntersection(trail[lastIdx - 1], trail[lastIdx], t1, t2);
        if (intersection) {
          exitIdx = i;
          exitPoint = intersection;
        }
      }
    }
    
    // Fallback: find closest territory vertices to trail endpoints
    if (entryIdx === -1 || exitIdx === -1) {
      let minDistStart = Infinity, minDistEnd = Infinity;
      
      for (let i = 0; i < n; i++) {
        const t = territory[i];
        const distStart = Math.hypot(t.x - trail[0].x, t.y - trail[0].y);
        const distEnd = Math.hypot(t.x - trail[trail.length - 1].x, t.y - trail[trail.length - 1].y);
        
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
    
    // Build two candidate polygons:
    // 1. Trail + boundary going forward from exit to entry
    // 2. Trail + boundary going backward from exit to entry
    // Keep the one that increases area (expands territory)
    
    const collectBoundaryForward = (fromIdx, toIdx) => {
      const pts = [];
      let i = (fromIdx + 1) % n;
      const visited = new Set();
      while (!visited.has(i)) {
        visited.add(i);
        pts.push({ x: territory[i].x, y: territory[i].y });
        if (i === toIdx) break;
        i = (i + 1) % n;
      }
      return pts;
    };
    
    const collectBoundaryReverse = (fromIdx, toIdx) => {
      const pts = [];
      let i = fromIdx;
      const stop = (toIdx + 1) % n;
      const visited = new Set();
      while (!visited.has(i)) {
        visited.add(i);
        pts.push({ x: territory[i].x, y: territory[i].y });
        if (i === stop) break;
        i = (i - 1 + n) % n;
      }
      return pts;
    };
    
    const buildCandidate = (boundaryPts) => {
      const poly = [];
      if (entryPoint) poly.push({ x: entryPoint.x, y: entryPoint.y });
      for (const p of trail) poly.push({ x: p.x, y: p.y });
      if (exitPoint) poly.push({ x: exitPoint.x, y: exitPoint.y });
      for (const p of boundaryPts) poly.push({ x: p.x, y: p.y });
      return this.dedupePoints(poly);
    };
    
    const candForward = buildCandidate(collectBoundaryForward(exitIdx, entryIdx));
    const candReverse = buildCandidate(collectBoundaryReverse(exitIdx, entryIdx));
    
    const areaF = Math.abs(polygonArea(candForward));
    const areaR = Math.abs(polygonArea(candReverse));
    
    // Choose the candidate that grows territory (or at least doesn't shrink it much)
    let chosen = areaF >= areaR ? candForward : candReverse;
    const chosenArea = Math.max(areaF, areaR);
    
    // Only accept if it doesn't significantly shrink territory
    if (chosenArea < prevArea * 0.9) {
      // Both candidates would shrink - keep existing territory
      return;
    }
    
    // Simplify the polygon to reduce vertex count (bandwidth optimization)
    // Keep shape but remove redundant collinear points
    this.territory = this.simplifyPolygon(chosen, 2.0); // 2px tolerance
    
    const newArea = Math.abs(polygonArea(this.territory));
    const areaGained = Math.max(0, newArea - prevArea);
    
    if (areaGained > 0) {
      this._pendingAreaGained = (this._pendingAreaGained || 0) + areaGained;
    }
    
    this._territoryDirty = true;
    this._dirty |= DeltaFlags.TERRITORY;
  }
  
  /**
   * Line segment intersection
   */
  lineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-10) return null;
    
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
  
  /**
   * Remove duplicate consecutive points
   */
  dedupePoints(points) {
    if (points.length === 0) return [];
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = out[out.length - 1];
      const b = points[i];
      if (Math.abs(a.x - b.x) > 0.1 || Math.abs(a.y - b.y) > 0.1) {
        out.push(b);
      }
    }
    // Remove last if same as first
    if (out.length > 2) {
      const first = out[0];
      const last = out[out.length - 1];
      if (Math.abs(first.x - last.x) < 0.1 && Math.abs(first.y - last.y) < 0.1) {
        out.pop();
      }
    }
    return out;
  }
  
  /**
   * Simplify polygon using Ramer-Douglas-Peucker algorithm
   * Reduces vertex count while preserving shape (bandwidth optimization)
   */
  simplifyPolygon(points, tolerance) {
    if (points.length < 3) return points;
    
    // For closed polygons, we need to handle wrap-around
    // Find the point furthest from the line between first and last
    let maxDist = 0;
    let maxIdx = 0;
    
    const first = points[0];
    const last = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.pointToLineDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    
    if (maxDist > tolerance) {
      // Recursively simplify
      const left = this.simplifyPolygon(points.slice(0, maxIdx + 1), tolerance);
      const right = this.simplifyPolygon(points.slice(maxIdx), tolerance);
      return left.slice(0, -1).concat(right);
    } else {
      // All points within tolerance - just keep endpoints
      return [first, last];
    }
  }
  
  /**
   * Distance from point to line segment
   */
  pointToLineDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) {
      return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }
    
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return Math.hypot(point.x - projX, point.y - projY);
  }
  
  /**
   * Add XP and check for level up
   */
  addXp(amount, events) {
    this.xp += amount;
    this._dirty |= DeltaFlags.XP;
    
    const xpPerLevel = (consts.XP_BASE_PER_LEVEL || 100) + (this.level - 1) * (consts.XP_INCREMENT_PER_LEVEL || 25);
    
    while (this.xp >= xpPerLevel && this.level < (consts.MAX_DRONES || 50)) {
      this.xp -= xpPerLevel;
      this.level++;
      this._dirty |= DeltaFlags.LEVEL;
      
      // Update size
      const sizePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL || 0.04;
      const maxScale = consts.PLAYER_SIZE_SCALE_MAX || 1.75;
      this.sizeScale = Math.min(maxScale, 1.0 + (this.level - 1) * sizePerLevel);
      
      // Add drone
      this.droneCount = this.level;
      this._dirty |= DeltaFlags.DRONES;
      
      events.push({
        type: EventType.LEVEL_UP,
        playerNum: this.id,
        newLevel: this.level,
      });
    }
  }
  
  /**
   * Take damage
   */
  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
    this._dirty |= DeltaFlags.HP;
    return this.hp <= 0;
  }
  
  /**
   * Die
   */
  die() {
    this.dead = true;
  }
  
  /**
   * Get delta flags and clear them
   */
  consumeDirty() {
    const flags = this._dirty;
    this._dirty = 0;
    return flags;
  }
  
  /**
   * Serialize for network
   */
  serialize() {
    return {
      num: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      angle: this.angle,
      hp: this.hp,
      maxHp: this.maxHp,
      level: this.level,
      xp: this.xp,
      sizeScale: this.sizeScale,
      dead: this.dead,
      isSnipped: this.isSnipped,
      territory: this.territory,
      trail: this.trail,
      drones: this.drones.map(d => ({
        id: d.id,
        x: d.x,
        y: d.y,
        targetId: d.targetId,
      })),
      base: {
        hue: this.color.hue,
        sat: this.color.sat,
        lum: this.color.lum,
      },
    };
  }
}

/**
 * Drone entity
 */
class Drone {
  constructor(id, ownerId, orbitOffset, droneIndex) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = 0;
    this.y = 0;
    this.orbitOffset = orbitOffset;
    this.currentOrbitAngle = orbitOffset;
    this.droneIndex = droneIndex;
    this.targetId = null;
    this.cooldown = 0;
  }
  
  /**
   * Update drone position (orbit around owner)
   */
  updatePosition(owner, deltaSeconds) {
    const orbitSpeed = consts.DRONE_ORBIT_SPEED || 2;
    const orbitRadius = consts.DRONE_ORBIT_RADIUS || 55;
    
    this.currentOrbitAngle += orbitSpeed * deltaSeconds;
    if (this.currentOrbitAngle > Math.PI * 2) {
      this.currentOrbitAngle -= Math.PI * 2;
    }
    
    this.x = owner.x + Math.cos(this.currentOrbitAngle) * orbitRadius;
    this.y = owner.y + Math.sin(this.currentOrbitAngle) * orbitRadius;
  }
  
  /**
   * Find and attack target
   */
  update(owner, players, deltaSeconds, events) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaSeconds;
    }
    
    // Disabled when owner is snipped
    if (owner.isSnipped) {
      this.targetId = null;
      return;
    }
    
    // Find nearest enemy in range
    const range = consts.DRONE_RANGE || 158;
    let target = null;
    let minDist = range;
    
    for (const enemy of players) {
      if (enemy.dead || enemy.id === owner.id) continue;
      
      const dist = Math.hypot(enemy.x - owner.x, enemy.y - owner.y);
      if (dist < minDist) {
        minDist = dist;
        target = enemy;
      }
    }
    
    this.targetId = target ? target.id : null;
    
    // Fire if ready
    if (target && this.cooldown <= 0) {
      this.cooldown = consts.DRONE_COOLDOWN || 0.1;
      
      // Calculate damage
      const baseDamage = consts.DRONE_DAMAGE || 5;
      const extraMult = consts.DRONE_DAMAGE_EXTRA_MULT || 0.5;
      const decayFactor = consts.DRONE_DAMAGE_DECAY_FACTOR || 0.75;
      
      let damage;
      if (this.droneIndex === 0) {
        damage = baseDamage;
      } else if (this.droneIndex === 1) {
        damage = baseDamage * extraMult;
      } else {
        damage = baseDamage * extraMult * Math.pow(decayFactor, this.droneIndex - 1);
      }
      
      // Damage reduction in territory
      const targetInTerritory = target.isInOwnTerritory();
      if (targetInTerritory) {
        damage *= (1 - (consts.TERRITORY_DAMAGE_REDUCTION || 0.5));
      }
      
      // Apply damage
      const killed = target.takeDamage(damage);
      
      // Emit hitscan event
      events.push({
        type: EventType.HITSCAN,
        ownerNum: owner.id,
        targetNum: target.id,
        fromX: this.x,
        fromY: this.y,
        toX: target.x,
        toY: target.y,
        damage: Math.round(damage),
      });
      
      if (killed) {
        target.die();
        events.push({
          type: EventType.PLAYER_KILL,
          killerNum: owner.id,
          victimNum: target.id,
          killType: 2, // drone
        });
      }
    }
  }
}

/**
 * Coin (XP pickup) entity
 */
class Coin {
  constructor(id, x, y, value) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.value = value;
  }
}

/**
 * Spatial grid for efficient AOI queries
 */
class SpatialGrid {
  constructor(mapSize, cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  
  _key(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }
  
  insert(entity) {
    const key = this._key(entity.x, entity.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key).add(entity);
    entity._gridKey = key;
  }
  
  remove(entity) {
    if (entity._gridKey && this.cells.has(entity._gridKey)) {
      this.cells.get(entity._gridKey).delete(entity);
    }
    entity._gridKey = null;
  }
  
  update(entity) {
    const newKey = this._key(entity.x, entity.y);
    if (entity._gridKey !== newKey) {
      this.remove(entity);
      this.insert(entity);
    }
  }
  
  getNearby(x, y, radius) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            const dist = Math.hypot(entity.x - x, entity.y - y);
            if (dist <= radius) {
              nearby.push(entity);
            }
          }
        }
      }
    }
    return nearby;
  }
}

/**
 * World - Main simulation container
 */
export default class World {
  constructor() {
    this.mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
    this.players = new Map();
    this.coins = new Map();
    this.colors = Color.possColors();
    
    this.nextPlayerId = 0;
    this.nextDroneId = 0;
    this.nextCoinId = 0;
    
    this.frame = 0;
    this.coinSpawnCooldown = 0;
    
    this.playerGrid = new SpatialGrid(this.mapSize, consts.AOI_GRID_SIZE || 200);
    this.coinGrid = new SpatialGrid(this.mapSize, consts.AOI_GRID_SIZE || 200);
    
    // Events accumulated during tick
    this.pendingEvents = [];
  }
  
  /**
   * Add a new player
   */
  addPlayer(name) {
    if (this.players.size >= (consts.MAX_PLAYERS || 100)) {
      return { ok: false, error: "Game is full" };
    }
    
    const spawn = this.findSpawn();
    if (!spawn) {
      return { ok: false, error: "No spawn available" };
    }
    
    const color = this.colors.shift() || new Color(Math.random(), 0.8, 0.5);
    const id = this.nextPlayerId++;
    const player = new Player(id, name, spawn.x, spawn.y, color);
    player.initTerritory(this.mapSize);
    
    // Initialize drones
    this.rebuildDrones(player);
    
    this.players.set(id, player);
    this.playerGrid.insert(player);
    
    this.pendingEvents.push({
      type: EventType.PLAYER_JOIN,
      player: player.serialize(),
    });
    
    return { ok: true, player };
  }
  
  /**
   * Remove a player
   */
  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    
    this.playerGrid.remove(player);
    this.colors.push(player.color);
    this.players.delete(id);
    
    this.pendingEvents.push({
      type: EventType.PLAYER_LEAVE,
      num: id,
      silent: false,
    });
  }
  
  /**
   * Handle player input
   */
  handleInput(playerId, targetAngle) {
    const player = this.players.get(playerId);
    if (player && !player.dead) {
      player.targetAngle = targetAngle;
    }
  }
  
  /**
   * Find empty spawn location
   */
  findSpawn() {
    const margin = consts.CELL_WIDTH * 3;
    const maxAttempts = 100;
    
    for (let i = 0; i < maxAttempts; i++) {
      const x = margin + Math.random() * (this.mapSize - margin * 2);
      const y = margin + Math.random() * (this.mapSize - margin * 2);
      
      // Check distance from other players
      let valid = true;
      for (const p of this.players.values()) {
        if (p.dead) continue;
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < consts.CELL_WIDTH * 6) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        return { x, y };
      }
    }
    
    // Fallback: random position
    return {
      x: margin + Math.random() * (this.mapSize - margin * 2),
      y: margin + Math.random() * (this.mapSize - margin * 2),
    };
  }
  
  /**
   * Rebuild drones for a player
   */
  rebuildDrones(player) {
    const count = player.droneCount;
    const oldDrones = player.drones;
    player.drones = [];
    
    for (let i = 0; i < count; i++) {
      const offset = (i * Math.PI * 2) / count;
      
      if (i < oldDrones.length) {
        oldDrones[i].orbitOffset = offset;
        oldDrones[i].currentOrbitAngle = offset;
        oldDrones[i].droneIndex = i;
        player.drones.push(oldDrones[i]);
      } else {
        const drone = new Drone(this.nextDroneId++, player.id, offset, i);
        player.drones.push(drone);
      }
    }
    
    // Initialize positions
    for (const drone of player.drones) {
      drone.updatePosition(player, 0);
    }
    
    player._dirty |= DeltaFlags.DRONES;
  }
  
  /**
   * Spawn a coin
   */
  spawnCoin() {
    if (this.coins.size >= (consts.MAX_COINS || 200)) return;
    
    const margin = consts.BORDER_WIDTH || 20;
    const x = margin + Math.random() * (this.mapSize - margin * 2);
    const y = margin + Math.random() * (this.mapSize - margin * 2);
    const value = consts.COIN_VALUE || 5;
    
    const coin = new Coin(this.nextCoinId++, x, y, value);
    this.coins.set(coin.id, coin);
    this.coinGrid.insert(coin);
    
    this.pendingEvents.push({
      type: EventType.COIN_SPAWN,
      id: coin.id,
      x: coin.x,
      y: coin.y,
      value: coin.value,
    });
  }
  
  /**
   * Main simulation tick
   */
  tick(deltaSeconds) {
    const now = Date.now();
    this.pendingEvents = [];
    
    // Spawn coins
    this.coinSpawnCooldown -= deltaSeconds;
    if (this.coinSpawnCooldown <= 0) {
      this.spawnCoin();
      this.coinSpawnCooldown = consts.COIN_SPAWN_INTERVAL_SEC || 2.5;
    }
    
    // Update players
    const dead = [];
    
    for (const player of this.players.values()) {
      if (player.dead) continue;
      
      player.move(deltaSeconds, this.mapSize, now);
      this.playerGrid.update(player);
      
      // Update drones
      for (const drone of player.drones) {
        drone.updatePosition(player, deltaSeconds);
        drone.update(player, Array.from(this.players.values()), deltaSeconds, this.pendingEvents);
      }
      
      // Check coin pickups
      const scaledRadius = player.getScaledRadius();
      for (const coin of this.coins.values()) {
        const dist = Math.hypot(player.x - coin.x, player.y - coin.y);
        if (dist < scaledRadius + (consts.COIN_RADIUS || 8)) {
          player.addXp(coin.value, this.pendingEvents);
          this.coinGrid.remove(coin);
          this.coins.delete(coin.id);
          
          this.pendingEvents.push({
            type: EventType.COIN_PICKUP,
            id: coin.id,
            playerNum: player.id,
          });
        }
      }
      
      // Check territory XP
      if (player._pendingAreaGained > 0) {
        const xpGained = Math.floor(player._pendingAreaGained * (consts.COINS_PER_AREA_UNIT || 0.00025));
        if (xpGained > 0) {
          player.addXp(xpGained, this.pendingEvents);
          
          this.pendingEvents.push({
            type: EventType.CAPTURE,
            playerNum: player.id,
            x: player.x,
            y: player.y,
            xpGained,
          });
        }
        player._pendingAreaGained = 0;
      }
      
      if (player.dead) {
        dead.push(player);
      }
    }
    
    // Check collisions
    const players = Array.from(this.players.values()).filter(p => !p.dead);
    
    for (let i = 0; i < players.length; i++) {
      const p1 = players[i];
      if (p1.dead) continue;
      
      for (let j = i + 1; j < players.length; j++) {
        const p2 = players[j];
        if (p2.dead) continue;
        
        // Trail collision (p1 hits p2's trail)
        if (!p1.isSnipped) {
          const hit = p2.hitsTrail(p1.x, p1.y, 0);
          if (hit && !p2.isSnipped) {
            p2.startSnip({ x: p1.x, y: p1.y }, hit, p1.id);
            this.pendingEvents.push({
              type: EventType.SNIP_START,
              playerNum: p2.id,
              snipperNum: p1.id,
            });
          }
        }
        
        // Trail collision (p2 hits p1's trail)
        if (!p2.isSnipped) {
          const hit = p1.hitsTrail(p2.x, p2.y, 0);
          if (hit && !p1.isSnipped) {
            p1.startSnip({ x: p2.x, y: p2.y }, hit, p2.id);
            this.pendingEvents.push({
              type: EventType.SNIP_START,
              playerNum: p1.id,
              snipperNum: p2.id,
            });
          }
        }
        
        // Body collision
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < p1.getScaledRadius() + p2.getScaledRadius()) {
          const p1InTerritory = p1.isInOwnTerritory();
          const p2InTerritory = p2.isInOwnTerritory();
          
          if (p1InTerritory && !p2InTerritory) {
            p2.die();
            dead.push(p2);
            this.pendingEvents.push({
              type: EventType.PLAYER_KILL,
              killerNum: p1.id,
              victimNum: p2.id,
              killType: 0,
            });
          } else if (p2InTerritory && !p1InTerritory) {
            p1.die();
            dead.push(p1);
            this.pendingEvents.push({
              type: EventType.PLAYER_KILL,
              killerNum: p2.id,
              victimNum: p1.id,
              killType: 0,
            });
          } else {
            // Both in or out - larger territory wins
            const area1 = polygonArea(p1.territory);
            const area2 = polygonArea(p2.territory);
            
            if (area1 > area2 + 100) {
              p2.die();
              dead.push(p2);
              this.pendingEvents.push({
                type: EventType.PLAYER_KILL,
                killerNum: p1.id,
                victimNum: p2.id,
                killType: 0,
              });
            } else if (area2 > area1 + 100) {
              p1.die();
              dead.push(p1);
              this.pendingEvents.push({
                type: EventType.PLAYER_KILL,
                killerNum: p2.id,
                victimNum: p1.id,
                killType: 0,
              });
            } else {
              // Both die
              p1.die();
              p2.die();
              dead.push(p1, p2);
            }
          }
        }
      }
      
      // Self trail collision
      if (!p1.isSnipped) {
        const selfHit = p1.hitsTrail(p1.x, p1.y, 10);
        if (selfHit) {
          p1.startSnip({ x: p1.x, y: p1.y }, selfHit, null);
          this.pendingEvents.push({
            type: EventType.SNIP_START,
            playerNum: p1.id,
            snipperNum: 65535, // Self
          });
        }
      }
    }
    
    // Process deaths
    for (const player of dead) {
      if (!player._deathHandled) {
        player._deathHandled = true;
        this.playerGrid.remove(player);
        this.colors.push(player.color);
        
        // Drop XP as coins
        let totalXp = player.xp;
        for (let lvl = 1; lvl < player.level; lvl++) {
          totalXp += (consts.XP_BASE_PER_LEVEL || 100) + (lvl - 1) * (consts.XP_INCREMENT_PER_LEVEL || 25);
        }
        
        const dropAmount = Math.max(consts.COIN_DROP_MIN || 10, Math.floor(totalXp * (consts.COIN_DROP_PERCENT || 0.15)));
        const numCoins = Math.min(Math.ceil(dropAmount / (consts.COIN_VALUE || 5)), 20);
        const valuePerCoin = Math.ceil(dropAmount / numCoins);
        
        for (let i = 0; i < numCoins; i++) {
          const angle = (i / numCoins) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 30 + Math.random() * 50;
          const x = Math.max(20, Math.min(this.mapSize - 20, player.x + Math.cos(angle) * dist));
          const y = Math.max(20, Math.min(this.mapSize - 20, player.y + Math.sin(angle) * dist));
          const value = i === numCoins - 1 ? dropAmount - valuePerCoin * (numCoins - 1) : valuePerCoin;
          
          const coin = new Coin(this.nextCoinId++, x, y, value);
          this.coins.set(coin.id, coin);
          this.coinGrid.insert(coin);
          
          this.pendingEvents.push({
            type: EventType.COIN_SPAWN,
            id: coin.id,
            x: coin.x,
            y: coin.y,
            value: coin.value,
          });
        }
        
        this.pendingEvents.push({
          type: EventType.PLAYER_LEAVE,
          num: player.id,
          silent: false,
        });
      }
    }
    
    this.frame++;
    
    return {
      frame: this.frame,
      events: this.pendingEvents,
    };
  }
  
  /**
   * Get players in AOI of a position
   */
  getPlayersInAOI(x, y, radius) {
    return this.playerGrid.getNearby(x, y, radius);
  }
  
  /**
   * Get coins in AOI of a position
   */
  getCoinsInAOI(x, y, radius) {
    return this.coinGrid.getNearby(x, y, radius);
  }
  
  /**
   * Get player by ID
   */
  getPlayer(id) {
    return this.players.get(id);
  }
  
  /**
   * Get all players
   */
  getAllPlayers() {
    return Array.from(this.players.values());
  }
  
  /**
   * Get all coins
   */
  getAllCoins() {
    return Array.from(this.coins.values());
  }
}

export { Player, Drone, Coin, SpatialGrid, pointInPolygon, polygonArea };

