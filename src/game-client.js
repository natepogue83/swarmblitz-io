/**
 * Game Client for SwarmBlitz
 * 
 * Handles:
 * - Client-side game state management
 * - Entity interpolation for smooth rendering
 * - Input prediction for responsive controls
 * - Rendering coordination
 */

import NetClient, { ConnectionState } from './net/client.js';
import Color from './core/color.js';
import { consts } from '../config.js';
import { EventType } from './net/protocol.js';
import * as SoundManager from './sound-manager.js';

// UI Constants (matching old renderer)
const BAR_HEIGHT = 45;
const SHADOW_OFFSET = 5;
const PLAYER_RADIUS = consts.CELL_WIDTH / 2;
const DRONE_VISUAL_RADIUS = consts.DRONE_RADIUS || 10;
const LEADERBOARD_WIDTH = 400;
const MIN_BAR_WIDTH = 65;

/**
 * Entity state with client-side prediction for local player
 * Drones are simulated purely client-side based on player position and level
 */
class InterpolatedEntity {
  constructor(data) {
    this.num = data.num;
    this.name = data.name || 'Player';
    
    // Render position (what we draw - always smooth)
    this.x = data.x;
    this.y = data.y;
    this.angle = data.angle || 0;
    
    // Server-authoritative position (last confirmed by server)
    this.serverX = data.x;
    this.serverY = data.y;
    this.serverAngle = data.angle || 0;
    
    // Correction offset (accumulated error to smooth out)
    this.correctionX = 0;
    this.correctionY = 0;
    
    // Stats
    this.hp = data.hp || 100;
    this.maxHp = data.maxHp || 100;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.sizeScale = data.sizeScale || 1.0;
    
    // State
    this.dead = data.dead || false;
    this.isSnipped = data.isSnipped || false;
    
    // Territory and trail
    this.territory = data.territory || [];
    this.trail = data.trail || [];
    
    // Drones - simulated client-side (not from server)
    // Each drone has an orbit phase offset for smooth rotation
    this.droneCount = data.droneCount !== undefined ? data.droneCount : this.level;
    this.droneOrbitPhase = 0; // Current orbit rotation
    this.drones = []; // Will be populated in updateDrones()
    
    // Color
    if (data.base) {
      this.base = new Color(data.base.hue, data.base.sat, data.base.lum);
    } else {
      this.base = new Color(Math.random(), 0.8, 0.5);
    }
  }
  
  /**
   * Update from server data
   * @param {boolean} isLocalPlayer - If true, accumulate correction offset instead of snapping
   */
  update(data, isLocalPlayer = false) {
    // For local player: accumulate correction offset (smooth out over time)
    // For other players: just update server position (interpolateOther handles smoothing)
    if (isLocalPlayer && data.x !== undefined && data.y !== undefined) {
      // Calculate how far off we are from server
      const errorX = data.x - this.x;
      const errorY = data.y - this.y;
      
      // Add to correction offset (will be blended out smoothly in predict())
      this.correctionX += errorX;
      this.correctionY += errorY;
      
      // If error is huge (>100px), snap immediately (teleport/respawn)
      const errorDist = Math.sqrt(errorX * errorX + errorY * errorY);
      if (errorDist > 100) {
        this.x = data.x;
        this.y = data.y;
        this.correctionX = 0;
        this.correctionY = 0;
      }
    }
    
    // Update server-authoritative state
    if (data.x !== undefined) this.serverX = data.x;
    if (data.y !== undefined) this.serverY = data.y;
    if (data.angle !== undefined) this.serverAngle = data.angle;
    
    // Update stats
    if (data.hp !== undefined) this.hp = data.hp;
    if (data.maxHp !== undefined) this.maxHp = data.maxHp;
    if (data.level !== undefined) this.level = data.level;
    if (data.xp !== undefined) this.xp = data.xp;
    if (data.sizeScale !== undefined) this.sizeScale = data.sizeScale;
    
    // Update drone count (from server or derived from level)
    if (data.droneCount !== undefined) {
      this.droneCount = data.droneCount;
    } else if (data.level !== undefined) {
      this.droneCount = data.level;
    }
    
    // Update state
    if (data.dead !== undefined) this.dead = data.dead;
    if (data.isSnipped !== undefined) this.isSnipped = data.isSnipped;
    
    // Update territory/trail
    // Always update if the field is present (even if empty/null)
    if (data.territory !== undefined) this.territory = data.territory || [];
    if (data.trail !== undefined) this.trail = data.trail || [];
    
    // Note: We ignore server drone data - drones are simulated client-side
  }
  
  /**
   * Update drone positions (client-side simulation)
   * Called every frame to smoothly orbit drones around player
   */
  updateDrones(deltaMs) {
    const orbitRadius = consts.DRONE_ORBIT_RADIUS || 55;
    const orbitSpeed = consts.DRONE_ORBIT_SPEED || 2; // radians per second
    
    // Update orbit phase
    this.droneOrbitPhase += orbitSpeed * (deltaMs / 1000);
    if (this.droneOrbitPhase > Math.PI * 2) {
      this.droneOrbitPhase -= Math.PI * 2;
    }
    
    // Ensure we have the right number of drones
    while (this.drones.length < this.droneCount) {
      this.drones.push({ id: this.drones.length, x: this.x, y: this.y, targetId: null });
    }
    while (this.drones.length > this.droneCount) {
      this.drones.pop();
    }
    
    // Position drones in orbit around player
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i];
      const phaseOffset = (i / this.droneCount) * Math.PI * 2;
      const droneAngle = this.droneOrbitPhase + phaseOffset;
      
      drone.x = this.x + Math.cos(droneAngle) * orbitRadius;
      drone.y = this.y + Math.sin(droneAngle) * orbitRadius;
    }
  }
  
  /**
   * Client-side prediction for local player
   * Moves the player based on current angle at the expected speed
   * 
   * Key insight: We keep prediction PURE (no jittery corrections).
   * Instead, we accumulate correction offsets and blend them out smoothly.
   */
  predict(deltaMs, speed, mapSize, inputAngle) {
    // Blend out any accumulated correction offset (very smoothly)
    // This absorbs server corrections without causing visible jitter
    const blendRate = 0.08; // 8% per frame - very smooth
    this.x += this.correctionX * blendRate;
    this.y += this.correctionY * blendRate;
    this.correctionX *= (1 - blendRate);
    this.correctionY *= (1 - blendRate);
    
    // Gently correct angle towards server (prevents drift on turns)
    let angleError = this.serverAngle - this.angle;
    while (angleError > Math.PI) angleError -= Math.PI * 2;
    while (angleError < -Math.PI) angleError += Math.PI * 2;
    this.angle += angleError * 0.03; // Very gentle - 3% per frame
    
    // Limit turn rate to match server (0.15 rad/frame at 60fps = 9 rad/sec)
    const maxTurnPerFrame = 9 * (deltaMs / 1000);
    
    let angleDiff = inputAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    if (Math.abs(angleDiff) > maxTurnPerFrame) {
      angleDiff = Math.sign(angleDiff) * maxTurnPerFrame;
    }
    this.angle += angleDiff;
    
    // Normalize angle
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;
    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
    
    // Move in the direction we're facing (pure prediction - no corrections here)
    const moveAmount = speed * (deltaMs / 1000) * 60;
    this.x += Math.cos(this.angle) * moveAmount;
    this.y += Math.sin(this.angle) * moveAmount;
    
    // Clamp to map bounds
    const radius = 15;
    this.x = Math.max(radius, Math.min(mapSize - radius, this.x));
    this.y = Math.max(radius, Math.min(mapSize - radius, this.y));
    
    // Update drone positions (client-side orbit simulation)
    this.updateDrones(deltaMs);
  }
  
  /**
   * Smooth movement for other players (not local)
   * Extrapolates movement based on angle, with gentle correction towards server position
   */
  interpolateOther(deltaMs, speed) {
    // Smoothly interpolate angle towards server angle
    let angleDiff = this.serverAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Gentle angle lerp (20% per frame at 60fps) - smoother turning
    const angleLerp = Math.min(1, 0.2 * (deltaMs / 16.67));
    this.angle += angleDiff * angleLerp;
    
    // Normalize angle
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;
    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
    
    // Always move forward in the direction we're facing (extrapolation)
    const moveAmount = speed * (deltaMs / 1000) * 60;
    this.x += Math.cos(this.angle) * moveAmount;
    this.y += Math.sin(this.angle) * moveAmount;
    
    // Gently correct towards server position to prevent drift
    const errorX = this.serverX - this.x;
    const errorY = this.serverY - this.y;
    const errorDist = Math.sqrt(errorX * errorX + errorY * errorY);
    
    if (errorDist > 200) {
      // Too far off (teleport/respawn), snap immediately
      this.x = this.serverX;
      this.y = this.serverY;
    } else {
      // Gentle correction: 5% base + gradual increase for larger errors
      // This creates smooth movement without visible snapping
      const correctionRate = Math.min(0.25, 0.05 + errorDist * 0.002);
      this.x += errorX * correctionRate;
      this.y += errorY * correctionRate;
    }
    
    // Update drone positions (client-side orbit simulation)
    this.updateDrones(deltaMs);
  }
}

/**
 * Coin entity
 */
class Coin {
  constructor(data) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.value = data.value || 5;
  }
}

/**
 * Death particle effect (burst, spark, ring, shard)
 * Ported from deprecated/mode/player.js
 */
class DeathParticle {
  constructor(x, y, color, type = 'burst') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    
    if (type === 'burst') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = 4 + Math.random() * 8;
      this.life = 1;
      this.decay = 0.015 + Math.random() * 0.02;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.3;
      this.gravity = 0.15;
    } else if (type === 'spark') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 12;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = 2 + Math.random() * 3;
      this.life = 1;
      this.decay = 0.04 + Math.random() * 0.03;
      this.trail = [];
    } else if (type === 'ring') {
      this.radius = 5;
      this.maxRadius = 80 + Math.random() * 40;
      this.expandSpeed = 4 + Math.random() * 2;
      this.life = 1;
      this.decay = 0.025;
      this.lineWidth = 8;
    } else if (type === 'shard') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.points = this.generateShardShape();
      this.life = 1;
      this.decay = 0.012 + Math.random() * 0.01;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.15;
      this.gravity = 0.08;
    }
  }
  
  generateShardShape() {
    const points = [];
    const numPoints = 3 + Math.floor(Math.random() * 3);
    const baseSize = 10 + Math.random() * 20;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const dist = baseSize * (0.5 + Math.random() * 0.5);
      points.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist
      });
    }
    return points;
  }
  
  update() {
    if (this.type === 'burst') {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= 0.98;
      this.rotation += this.rotationSpeed;
      this.life -= this.decay;
    } else if (this.type === 'spark') {
      this.trail.push({ x: this.x, y: this.y, life: this.life });
      if (this.trail.length > 8) this.trail.shift();
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.92;
      this.vy *= 0.92;
      this.life -= this.decay;
    } else if (this.type === 'ring') {
      this.radius += this.expandSpeed;
      this.lineWidth *= 0.96;
      this.life -= this.decay;
    } else if (this.type === 'shard') {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.rotation += this.rotationSpeed;
      this.life -= this.decay;
    }
    return this.life > 0;
  }
  
  render(ctx) {
    const alpha = Math.max(0, this.life);
    
    if (this.type === 'burst') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10 * alpha;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (this.type === 'spark') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const t = this.trail[i];
        ctx.lineTo(t.x, t.y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * alpha;
      ctx.globalAlpha = alpha * 0.6;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.type === 'ring') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, this.lineWidth * alpha);
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
      ctx.restore();
    } else if (this.type === 'shard') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Hitscan effect (laser beam)
 */
class HitscanEffect {
  constructor(fromX, fromY, toX, toY, color) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.color = color;
    this.startTime = performance.now();
    this.duration = 100; // ms
  }
  
  isExpired() {
    return performance.now() - this.startTime > this.duration;
  }
  
  getAlpha() {
    const elapsed = performance.now() - this.startTime;
    return Math.max(0, 1 - elapsed / this.duration);
  }
}

/**
 * Capture feedback effect (pulse ring, particles, +XP text)
 * Ported from deprecated/mode/player.js
 */
const CAPTURE_FLASH_TIME_SEC = 1.0;
const CAPTURE_PARTICLE_COUNT = 40;
const PULSE_RADIUS_START = 10;
const PULSE_RADIUS_END = 120;
const PULSE_TIME = 0.8;

class CaptureEffect {
  constructor(x, y, xpGained, player, isLocalPlayer) {
    this.x = x;
    this.y = y;
    this.xpGained = xpGained;
    this.player = player;
    this.isLocalPlayer = isLocalPlayer;
    this.spawnTime = performance.now();
    this.color = player ? player.base : null;
    
    // Pulse ring
    this.pulseRadius = PULSE_RADIUS_START;
    this.pulseLife = 1;
    
    // Particles
    this.particles = [];
    const particleCount = isLocalPlayer ? CAPTURE_PARTICLE_COUNT : Math.floor(CAPTURE_PARTICLE_COUNT * 0.6);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        life: 1,
        decay: 0.015 + Math.random() * 0.02
      });
    }
    
    // Coins text
    this.textY = y - 20;
    this.textAlpha = 1;
  }
  
  easeOutQuad(t) {
    return t * (2 - t);
  }
  
  update() {
    const elapsed = (performance.now() - this.spawnTime) / 1000;
    const flashProgress = Math.min(1, elapsed / CAPTURE_FLASH_TIME_SEC);
    const pulseProgress = Math.min(1, elapsed / PULSE_TIME);
    
    // Update pulse ring
    this.pulseRadius = PULSE_RADIUS_START + (PULSE_RADIUS_END - PULSE_RADIUS_START) * this.easeOutQuad(pulseProgress);
    this.pulseLife = 1 - pulseProgress;
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vy += 0.1; // gravity
      p.life -= p.decay;
    }
    
    // Update text (float up and fade)
    this.textY -= 0.8;
    this.textAlpha = Math.max(0, 1 - flashProgress);
    
    // Effect is done when flash time expires
    return flashProgress < 1;
  }
  
  render(ctx) {
    const colorStr = this.color ? this.color.rgbString() : '#FFD700';
    const lightColorStr = this.color ? this.color.lighter(0.3).rgbString() : '#FFEC8B';
    
    // Render pulse ring
    if (this.pulseLife > 0) {
      ctx.save();
      ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.8).rgbString() : `rgba(255, 215, 0, ${this.pulseLife * 0.8})`;
      ctx.lineWidth = 4 * this.pulseLife;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner glow
      ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.4).rgbString() : `rgba(255, 255, 200, ${this.pulseLife * 0.4})`;
      ctx.lineWidth = 8 * this.pulseLife;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.pulseRadius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // Render particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = lightColorStr;
      ctx.shadowColor = colorStr;
      ctx.shadowBlur = 8 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // Render XP earned text
    if (this.textAlpha > 0 && this.xpGained > 0) {
      ctx.save();
      ctx.globalAlpha = this.textAlpha;
      ctx.fillStyle = '#9370DB';  // Purple for XP
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 3;
      ctx.font = 'bold 18px Changa';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = `+${this.xpGained} XP`;
      ctx.strokeText(text, this.x, this.textY);
      ctx.fillText(text, this.x, this.textY);
      ctx.restore();
    }
    
    ctx.globalAlpha = 1;
  }
}

/**
 * Level-up text effect (floating "LEVEL UP!" text with scaling)
 * Ported from deprecated/mode/player.js
 */
class LevelUpTextEffect {
  constructor(x, y, newLevel, player, isLocalPlayer) {
    this.x = x;
    this.y = y;
    this.newLevel = newLevel;
    this.player = player;
    this.isLocalPlayer = isLocalPlayer;
    this.spawnTime = performance.now();
    this.color = player && player.base ? player.base : null;
    
    // Text animation
    this.textY = y - 40;
    this.textAlpha = 1;
    this.scale = 0.5;
  }
  
  update() {
    const elapsed = (performance.now() - this.spawnTime) / 1000;
    const duration = 1.5;
    const progress = Math.min(1, elapsed / duration);
    
    // Float up and fade
    this.textY = this.y - 40 - progress * 60;
    this.textAlpha = Math.max(0, 1 - progress);
    
    // Scale up then back down
    if (progress < 0.3) {
      this.scale = 0.5 + (progress / 0.3) * 1.0;
    } else {
      this.scale = 1.5 - (progress - 0.3) * 0.5;
    }
    
    return progress < 1;
  }
  
  render(ctx) {
    if (this.textAlpha <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = this.textAlpha;
    ctx.translate(this.x, this.textY);
    ctx.scale(this.scale, this.scale);
    
    // Glow effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20 * this.textAlpha;
    
    // Text
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.font = 'bold 24px Changa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = `⬆️ LEVEL ${this.newLevel}! ⬆️`;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    
    // Bonus info text below
    ctx.font = 'bold 14px Changa';
    ctx.fillStyle = '#88CCFF';
    ctx.strokeText('+1 Drone, +5% Size', 0, 28);
    ctx.fillText('+1 Drone, +5% Size', 0, 28);
    
    ctx.restore();
  }
}

/**
 * Loot coin animation (coins flying from death location to final position)
 * Ported from deprecated/mode/player.js
 */
class LootCoin {
  constructor(originX, originY, targetX, targetY, value, coinId = null) {
    this.originX = originX;
    this.originY = originY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.value = value;
    this.coinId = coinId; // Track which real coin this animation is for
    
    // Current position (starts at origin)
    this.x = originX;
    this.y = originY;
    
    // Animation timing
    this.spawnTime = performance.now();
    this.duration = 600 + Math.random() * 200; // 600-800ms flight time
    this.delay = Math.random() * 150; // Stagger the coins
    
    // Arc parameters for juicy trajectory
    this.arcHeight = 40 + Math.random() * 60; // How high the arc goes
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.4;
    
    // Visual effects
    this.scale = 0;
    this.targetScale = 0.8 + Math.random() * 0.4;
    this.glowIntensity = 1;
    this.sparkles = [];
    
    // Generate initial sparkles
    for (let i = 0; i < 3; i++) {
      this.sparkles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 8 + Math.random() * 8,
        size: 2 + Math.random() * 2,
        speed: 0.05 + Math.random() * 0.05
      });
    }
    
    this.landed = false;
    this.landTime = 0;
    this.bouncePhase = 0;
  }
  
  update() {
    const now = performance.now();
    const elapsed = now - this.spawnTime - this.delay;
    
    if (elapsed < 0) {
      // Still in delay phase
      return true;
    }
    
    const progress = Math.min(1, elapsed / this.duration);
    
    if (!this.landed) {
      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Linear interpolation for x
      this.x = this.originX + (this.targetX - this.originX) * easeProgress;
      
      // Parabolic arc for y (goes up then down)
      const linearY = this.originY + (this.targetY - this.originY) * easeProgress;
      const arcOffset = Math.sin(easeProgress * Math.PI) * this.arcHeight;
      this.y = linearY - arcOffset;
      
      // Scale up as it flies
      this.scale = this.targetScale * Math.min(1, easeProgress * 2);
      
      // Rotation
      this.rotation += this.rotationSpeed;
      
      // Update sparkles
      for (const sparkle of this.sparkles) {
        sparkle.angle += sparkle.speed;
      }
      
      if (progress >= 1) {
        this.landed = true;
        this.landTime = now;
        this.x = this.targetX;
        this.y = this.targetY;
      }
    } else {
      // Bounce and settle animation
      const landElapsed = now - this.landTime;
      const bounceProgress = Math.min(1, landElapsed / 400);
      
      // Damped bounce
      this.bouncePhase = Math.sin(bounceProgress * Math.PI * 3) * (1 - bounceProgress) * 8;
      this.y = this.targetY - Math.abs(this.bouncePhase);
      
      // Settle rotation
      this.rotation *= 0.95;
      
      // Fade glow
      this.glowIntensity = Math.max(0.3, 1 - bounceProgress * 0.7);
      
      // Done after bounce settles
      if (bounceProgress >= 1) {
        return false; // Remove this loot coin animation
      }
    }
    
    return true;
  }
  
  render(ctx) {
    const now = performance.now();
    const elapsed = now - this.spawnTime - this.delay;
    
    if (elapsed < 0 || this.scale <= 0) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);
    
    const coinRadius = (consts.COIN_RADIUS || 8) * 1.2;
    
    // Outer glow
    const glowSize = coinRadius * (2 + this.glowIntensity);
    const gradient = ctx.createRadialGradient(0, 0, coinRadius * 0.5, 0, 0, glowSize);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${0.6 * this.glowIntensity})`);
    gradient.addColorStop(0.5, `rgba(255, 180, 0, ${0.3 * this.glowIntensity})`);
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Main coin body with gradient
    const coinGradient = ctx.createRadialGradient(-coinRadius * 0.3, -coinRadius * 0.3, 0, 0, 0, coinRadius);
    coinGradient.addColorStop(0, '#FFF8DC'); // Light gold highlight
    coinGradient.addColorStop(0.3, '#FFD700'); // Gold
    coinGradient.addColorStop(0.7, '#DAA520'); // Goldenrod
    coinGradient.addColorStop(1, '#B8860B'); // Dark goldenrod edge
    ctx.fillStyle = coinGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner ring detail
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, coinRadius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    
    // Shine highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-coinRadius * 0.25, -coinRadius * 0.25, coinRadius * 0.35, coinRadius * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Render sparkles (in world space)
    if (!this.landed) {
      for (const sparkle of this.sparkles) {
        const sx = this.x + Math.cos(sparkle.angle) * sparkle.dist * this.scale;
        const sy = this.y + Math.sin(sparkle.angle) * sparkle.dist * this.scale;
        
        ctx.fillStyle = `rgba(255, 255, 200, ${0.8 * this.glowIntensity})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkle.size * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Game Client
 */
export default class GameClient {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Network
    this.net = new NetClient({
      url: options.wsUrl || 'ws://localhost:8787/room/default',
      onStateChange: (state) => this.handleStateChange(state),
      onInit: (data) => this.handleInit(data),
      onFrame: (data) => this.handleFrame(data),
      onEvent: (event) => this.handleEvent(event),
      onError: (err) => this.handleError(err),
    });
    
    // Game state
    this.mapSize = 0;
    this.playerId = null;
    this.players = new Map();
    this.coins = new Map();
    this.effects = [];
    
    // Camera - smoothly follows player
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraTargetX = 0; // Where camera wants to be
    this.cameraTargetY = 0;
    this.cameraScale = 1;
    
    // Input
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetAngle = 0;
    this.mouseSet = false;

    // WASD keyboard control state (directional movement via targetAngle)
    // Note: movement is always "forward" in the direction you're facing, so WASD maps to desired heading.
    this.wasdKeys = { w: false, a: false, s: false, d: false };
    this.useWasd = false;
    this.wasdCurrentAngle = 0;
    
    // Timing
    this.lastFrameTime = performance.now();
    this.networkTickMs = 100; // 10 Hz (server sends updates every 100ms)
    // Interpolation delay: render slightly in the past to smooth between snapshots
    // Lower = more responsive but potentially jittery, higher = smoother but laggy
    this.interpolationDelay = this.networkTickMs; // One tick delay (100ms)
    
    // Callbacks
    this.onDeath = options.onDeath || (() => {});
    this.onKill = options.onKill || (() => {});
    this.onLevelUp = options.onLevelUp || (() => {});
    
    // Debug mode (press D to toggle)
    this.debugMode = false;
    this.lastNetworkUpdate = 0;
    this.networkGaps = []; // Track last N gaps for averaging

    // Snip fuse (client-side visual + local SFX)
    // Map: playerNum -> fuseState
    this.snipFuses = new Map();
    this._localSnippedPrev = false;
    
    // Speed buff visual effect state
    // Tracks when each player left their territory for speed buff calculation
    this.speedBuffState = new Map(); // playerId -> { trailStartTime, lastSpeedBuff, speedRushActive }
    this.speedSpikeState = {
      active: false,
      playerX: 0,
      playerY: 0,
      playerAngle: 0,
      speedRatio: 0,
      baseColor: null,
      pulsePhase: 0,
    };
    
    // Death VFX state
    this.deathParticles = [];
    this.dyingPlayers = []; // { player, deathTime, dissolveProgress }
    this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
    
    // Capture feedback effects (pulse ring, particles, +XP text)
    this.captureEffects = [];
    
    // Level-up effects (text + particles)
    this.levelUpEffects = [];
    
    // Loot coin animations (coins flying from death to final position)
    this.lootCoins = [];
    this.animatingCoinIds = new Set(); // Coin IDs currently being animated (hide real coin)
    
    // Territory portion tracking for leaderboard
    this.playerPortions = new Map(); // playerId -> territory area
    
    // Last killer name (for death screen)
    this.lastKillerName = null;
    this.lastKillerNum = null;
    
    // Recent death locations for loot coin animations
    this.recentDeaths = []; // { x, y, time }
    
    // Local player outline thickening state (on capture)
    this.localOutlineThicken = {
      active: false,
      startTime: 0,
      duration: 500, // ms
    };
    
    // Periodic cleanup timer (to catch orphaned trails/state)
    this.lastCleanupTime = 0;
    this.cleanupIntervalMs = 2000; // Run cleanup every 2 seconds
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    
    // Setup input handlers
    this.setupInput();
  }

  /**
   * Start a client-side snip fuse for a player.
   * Always finds the furthest segment (highest index) that was hit - mirrors server logic.
   */
  startSnipFuse(playerNum, snipperNum) {
    const victim = this.players.get(playerNum);
    if (!victim) return;
    
    // For enemy snips, trail might not be synced yet - check isSnipped flag
    // If trail is too short, start from trail[0] or player position as fallback
    const trail = victim.trail || [];
    
    const isSelfSnip = snipperNum === 65535;
    const isLocalVictim = playerNum === this.playerId;
    
    let startPoint;
    let segmentIndex = 0;
    
    if (trail.length >= 2) {
      // Normal case: use hit detection
      let refPos = { x: victim.x, y: victim.y };
      if (!isSelfSnip) {
        const snipper = this.players.get(snipperNum);
        if (snipper) refPos = { x: snipper.x, y: snipper.y };
      }
      
      // Find furthest segment (highest index) that was hit - mirrors server hitsTrail logic
      const hit = this._furthestHitOnTrailByPos(refPos, trail, isSelfSnip ? 3 : 0);
      
      startPoint = hit.point || { x: trail[0].x, y: trail[0].y };
      segmentIndex = hit.index >= 0 ? hit.index : 0;
    } else if (trail.length === 1) {
      // Trail has single point
      startPoint = { x: trail[0].x, y: trail[0].y };
      segmentIndex = 0;
    } else {
      // No trail yet - use player position (fuse will start at player and go nowhere, but won't crash)
      startPoint = { x: victim.x, y: victim.y };
      segmentIndex = 0;
    }

    this.snipFuses.set(playerNum, {
      playerNum,
      snipperNum,
      startPoint,
      segmentIndex,
      elapsed: 0,
      progressDist: 0,
      fusePos: { x: startPoint.x, y: startPoint.y },
      ratio: 0,
      remainingPoints: null,
      isLocalVictim,
      sawSnipped: false, // Tracks if we've ever seen player.isSnipped = true
    });
  }

  _closestPointOnTrail(p, trail) {
    let best = { dist2: Infinity, point: null, index: 0 };
    for (let i = 0; i < trail.length - 1; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      const q = this._closestPointOnSegment(p, a, b);
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best.dist2) best = { dist2: d2, point: q, index: i };
    }
    return best;
  }

  /**
   * Find the furthest segment (highest index) that a position is touching.
   * Mirrors server's hitsTrail logic - returns highest index hit within radius.
   * @param {Object} pos - The position to check {x, y}
   * @param {Array} trail - The trail points
   * @param {number} skipCount - How many segments to skip at end (3 for self-snip, 0 for enemy)
   */
  _furthestHitOnTrailByPos(pos, trail, skipCount = 0) {
    const hitRadius = (consts.CELL_WIDTH || 25) / 2;
    let best = { dist2: Infinity, point: null, index: -1 };
    
    // Skip last few segments if needed
    const maxIdx = Math.max(0, trail.length - 1 - skipCount);
    
    for (let i = 0; i < maxIdx; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      const q = this._closestPointOnSegment(pos, a, b);
      const dx = pos.x - q.x;
      const dy = pos.y - q.y;
      const d2 = dx * dx + dy * dy;
      
      // If within hit radius and higher index than current best, take it
      if (d2 < hitRadius * hitRadius && i > best.index) {
        best = { dist2: d2, point: q, index: i };
      }
    }
    
    // Fallback to closest point if no hit found within radius
    if (best.point === null) {
      return this._closestPointOnTrail(pos, trail);
    }
    return best;
  }

  _closestPointOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 === 0) return { x: a.x, y: a.y };
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + abx * t, y: a.y + aby * t };
  }

  _pointAtDistance(points, dist) {
    if (points.length === 0) return null;
    if (points.length === 1) return { x: points[0].x, y: points[0].y };

    let remaining = dist;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen <= 0.0001) continue;
      if (remaining <= segLen) {
        const t = remaining / segLen;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      remaining -= segLen;
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y };
  }

  _pointAtDistanceWithIndex(points, dist) {
    if (points.length === 0) return { point: null, index: 0 };
    if (points.length === 1) return { point: { x: points[0].x, y: points[0].y }, index: 0 };

    let remaining = dist;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen <= 0.0001) continue;
      if (remaining <= segLen) {
        const t = remaining / segLen;
        return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, index: i };
      }
      remaining -= segLen;
    }
    return { point: { x: points[points.length - 1].x, y: points[points.length - 1].y }, index: points.length - 2 };
  }

  _sumLength(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }
    return total;
  }

  updateSnipFuses(deltaMs) {
    const deltaSeconds = deltaMs / 1000;

    // Cleanup + update fuse positions
    for (const [playerNum, state] of Array.from(this.snipFuses.entries())) {
      const player = this.players.get(playerNum);
      
      // Only delete fuse if:
      // 1. Player no longer exists (left/died)
      // 2. OR player.isSnipped became false AFTER we've seen it true (snip ended)
      // 3. OR fuse has been running too long (safety cleanup - 10 seconds max)
      if (!player) {
        this.snipFuses.delete(playerNum);
        continue;
      }
      
      // Track if we've ever seen isSnipped=true for this fuse
      if (player.isSnipped) {
        state.sawSnipped = true;
      }
      
      // If we've seen snipped=true and now it's false, the snip ended (player died or returned)
      if (state.sawSnipped && !player.isSnipped) {
        this.snipFuses.delete(playerNum);
        continue;
      }
      
      // Safety cleanup: if fuse has been alive for 10+ seconds, something is wrong
      if (state.elapsed > 10) {
        this.snipFuses.delete(playerNum);
        continue;
      }
      
      // If trail is too short, skip updating but don't delete (might sync later)
      if (!player.trail || player.trail.length < 2) {
        state.elapsed += deltaSeconds; // Still track time
        continue;
      }

      state.elapsed += deltaSeconds;

      // Mirror server fuse speed curve (client-side approximation)
      const baseSpeed = consts.SPEED || 4;
      const fuseMult = consts.SNIP_FUSE_SPEED_MULT || 1.5;
      const k = consts.SNIP_EXP_ACCEL_PER_SEC || 0.6375;
      const gracePeriod = consts.SNIP_GRACE_PERIOD || 0.25;

      const effectiveElapsed = Math.max(0, state.elapsed - gracePeriod);
      const v0 = baseSpeed * fuseMult * 60;
      const accelFactor = k > 0 ? Math.exp(k * effectiveElapsed) : 1;
      let fuseSpeed = v0 * accelFactor;

      // Cap (matches config intent; server may differ slightly depending on tuning)
      const maxMult = consts.SNIP_FUSE_MAX_SPEED_MULT || 6.0;
      fuseSpeed = Math.min(fuseSpeed, baseSpeed * maxMult * 60);

      if (state.elapsed > gracePeriod) {
        state.progressDist += fuseSpeed * deltaSeconds;
      }

      // Build the full fuse polyline from collision point -> trail end -> player
      const segIndex = Math.max(0, Math.min(player.trail.length - 2, state.segmentIndex));
      const fullPoints = [
        state.startPoint,
        ...player.trail.slice(segIndex + 1),
        { x: player.x, y: player.y },
      ];
      const totalLen = this._sumLength(fullPoints);
      const clampedTotal = Math.max(1, totalLen);

      state.ratio = Math.max(0, Math.min(1, state.progressDist / clampedTotal));

      // Find current fuse position and which segment it's on
      const fuseResult = this._pointAtDistanceWithIndex(fullPoints, Math.min(state.progressDist, clampedTotal));
      state.fusePos = fuseResult.point;

      // Only include trail points AFTER the current fuse position
      // fuseResult.index tells us which segment (0-indexed) the fuse is currently on
      const pointsAfterFuse = fullPoints.slice(fuseResult.index + 1);
      state.remainingPoints = [state.fusePos, ...pointsAfterFuse];
    }

    // Local fuse SFX (kept purely client-side)
    const local = this.players.get(this.playerId);
    const nowSnipped = !!(local && local.isSnipped);
    if (nowSnipped && !this._localSnippedPrev) {
      SoundManager.startFuseSound();
    }
    if (!nowSnipped && this._localSnippedPrev) {
      SoundManager.stopFuseSound();
    }
    this._localSnippedPrev = nowSnipped;

    if (nowSnipped) {
      const fuse = this.snipFuses.get(this.playerId);
      if (fuse) SoundManager.updateFuseVolume(fuse.ratio);
    }
    
    // Enemy fuse SFX - play for any non-local player who is snipped
    // Calculate distance to nearest enemy fuse for volume attenuation
    if (local) {
      let nearestEnemyFuse = null;
      let nearestDist = Infinity;
      
      for (const [playerNum, state] of this.snipFuses) {
        if (playerNum === this.playerId) continue; // Skip local player
        
        const player = this.players.get(playerNum);
        if (!player) continue;
        
        // Fuse is active if snipped OR if we haven't confirmed snip ended yet
        const fuseActive = player.isSnipped || !state.sawSnipped;
        if (!fuseActive) continue;
        
        // Distance from local player to the fuse position
        const dx = state.fusePos.x - local.x;
        const dy = state.fusePos.y - local.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemyFuse = state;
        }
      }
      
      // Start/stop/update enemy fuse sound based on nearest enemy fuse
      const hasNearbyEnemyFuse = nearestEnemyFuse !== null && nearestDist < 800;
      
      if (hasNearbyEnemyFuse && !SoundManager.isEnemyFuseSoundPlaying()) {
        SoundManager.startEnemyFuseSound();
      } else if (!hasNearbyEnemyFuse && SoundManager.isEnemyFuseSoundPlaying()) {
        SoundManager.stopEnemyFuseSound();
      }
      
      if (hasNearbyEnemyFuse) {
        // Pass distance directly - sound manager handles volume calculation
        SoundManager.updateEnemyFuseVolume(nearestDist, 800);
      }
    }
  }
  
  /**
   * Setup input handlers
   */
  setupInput() {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchstart', this.handleTouchMove, { passive: false });
    
    // Keyboard
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  cleanupInput() {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchstart', this.handleTouchMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  handleKeyDown(e) {
    // Avoid interfering with typing in inputs (e.g., menus/settings)
    const el = document.activeElement;
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Ignore repeats so we don't spam state changes
    if (e.repeat) return;

    const key = (e.key || '').toLowerCase();

    // F3 toggles debug mode (D is reserved for movement)
    if (e.key === 'F3') {
      this.debugMode = !this.debugMode;
      console.log('Debug mode:', this.debugMode ? 'ON' : 'OFF');
      return;
    }

    // R = Reset room (debug)
    if (key === 'r') {
      console.log('%c🔄 RESETTING ROOM...', 'color: orange; font-weight: bold;');
      this.net.sendReset();
      return;
    }

    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      this.setKeyState(key, true);
    }
  }

  handleKeyUp(e) {
    const key = (e.key || '').toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      this.setKeyState(key, false);
    }
  }

  setKeyState(key, pressed) {
    const k = (key || '').toLowerCase();
    if (!(k in this.wasdKeys)) return;
    this.wasdKeys[k] = !!pressed;
    this.useWasd = !!(this.wasdKeys.w || this.wasdKeys.a || this.wasdKeys.s || this.wasdKeys.d);
  }
  
  /**
   * Handle mouse move
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.mouseSet = true;
    this.updateTargetAngle();
  }
  
  /**
   * Handle touch move
   */
  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.touches[0].clientX - rect.left;
      this.mouseY = e.touches[0].clientY - rect.top;
      this.mouseSet = true;
      this.updateTargetAngle();
    }
  }
  
  /**
   * Update target angle from mouse position
   */
  updateTargetAngle() {
    const player = this.players.get(this.playerId);
    if (!player) return;
    
    // Convert mouse to world coordinates
    const worldX = this.cameraX + (this.mouseX - this.canvas.width / 2) / this.cameraScale;
    const worldY = this.cameraY + (this.mouseY - this.canvas.height / 2) / this.cameraScale;
    
    // Calculate angle
    this.targetAngle = Math.atan2(worldY - player.y, worldX - player.x);

    // Keep WASD smoothed angle aligned with mouse when not using WASD (smooth handoff)
    if (!this.useWasd) {
      this.wasdCurrentAngle = this.targetAngle;
    }
  }
  
  /**
   * Connect to server
   */
  connect(playerName) {
    this.playerName = playerName;
    this.net.connect(playerName);
  }
  
  /**
   * Connect as spectator (no player, just watching)
   */
  connectSpectate() {
    this.spectateMode = true;
    this.net.connectSpectate();
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    this.net.disconnect();
    this.stopGameLoop();
    this.cleanupInput();
  }
  
  /**
   * Handle connection state change
   */
  handleStateChange(state) {
    console.log('Connection state:', state);
  }
  
  /**
   * Handle init message
   */
  handleInit(data) {
    this.playerId = data.playerId;
    this.mapSize = data.mapSize;
    
    // Clear state
    this.players.clear();
    this.coins.clear();
    this.effects = [];
    
    // Add all players
    for (const p of data.players) {
      this.players.set(p.num, new InterpolatedEntity(p));
    }
    
    // Add all coins
    for (const c of data.coins) {
      this.coins.set(c.id, new Coin(c));
    }
    
    // Setup camera based on mode
    if (this.spectateMode) {
      // Spectate mode: center on map, zoom to fit entire map
      this.cameraX = this.mapSize / 2;
      this.cameraY = this.mapSize / 2;
      this.cameraTargetX = this.mapSize / 2;
      this.cameraTargetY = this.mapSize / 2;
      // Calculate zoom to fit map with some padding
      const padding = 50;
      this.cameraScale = Math.min(
        this.canvas.width / (this.mapSize + padding * 2),
        this.canvas.height / (this.mapSize + padding * 2)
      );
    } else {
      // Normal mode: center camera on player
      const player = this.players.get(this.playerId);
      if (player) {
        this.cameraX = player.x;
        this.cameraY = player.y;
        this.cameraTargetX = player.x;
        this.cameraTargetY = player.y;
      }
    }
    
    // Start game loop
    this.startGameLoop();
  }
  
  /**
   * Handle frame update
   */
  handleFrame(data) {
    // Track network update timing for debug
    const now = performance.now();
    if (this.lastNetworkUpdate) {
      const gap = now - this.lastNetworkUpdate;
      this.networkGaps.push(gap);
      if (this.networkGaps.length > 20) this.networkGaps.shift();
      
      if (gap > 150 && this.debugMode) { // More than 150ms gap (expected 100ms)
        console.warn(`[NET] Long gap between updates: ${gap.toFixed(0)}ms`);
      }
    }
    this.lastNetworkUpdate = now;
    
    // Update self (local player uses correction offset for smooth movement)
    if (data.selfPlayer) {
      let player = this.players.get(data.selfPlayer.num);
      if (player) {
        player.update(data.selfPlayer, true); // isLocalPlayer = true
      } else {
        player = new InterpolatedEntity(data.selfPlayer);
        this.players.set(data.selfPlayer.num, player);
      }
    }
    
    // Add new players
    for (const p of data.newPlayers) {
      if (!this.players.has(p.num)) {
        this.players.set(p.num, new InterpolatedEntity(p));
      }
    }
    
    // Update existing players (other players use interpolation)
    for (const p of data.updatedPlayers) {
      const player = this.players.get(p.num);
      if (player) {
        player.update(p, false); // isLocalPlayer = false
      }
    }
    
    // Update coins (replace with visible set)
    this.coins.clear();
    for (const c of data.coins) {
      this.coins.set(c.id, new Coin(c));
    }
    
    // Process events BEFORE removing players (so death VFX can access player data)
    for (const event of data.events) {
      this.handleEvent(event);
    }
    
    // Remove players AFTER processing events
    for (const id of data.removedPlayerIds) {
      this.players.delete(id);
      // Also clean up any fuse state for this player
      this.snipFuses.delete(id);
      // Clean up speed buff state
      this.speedBuffState.delete(id);
    }
  }
  
  /**
   * Handle game event
   */
  handleEvent(event) {
    switch (event.type) {
      case EventType.HITSCAN:
        this.addHitscanEffect(event);
        break;
        
      case EventType.PLAYER_KILL: {
        const victim = this.players.get(event.victimNum);
        const killer = this.players.get(event.killerNum);
        const isLocalPlayer = event.victimNum === this.playerId;
        
        // Track killer for death screen
        if (isLocalPlayer && killer) {
          this.lastKillerName = killer.name || 'Unknown';
          this.lastKillerNum = event.killerNum;
        }
        
        // Spawn death VFX before player is removed
        if (victim) {
          this.spawnDeathEffect(victim, isLocalPlayer);
        }
        
        if (isLocalPlayer) {
          this.onDeath(event);
        } else if (event.killerNum === this.playerId) {
          this.onKill(event);
        }
        break;
      }
        
      case EventType.LEVEL_UP: {
        const levelPlayer = this.players.get(event.playerNum);
        const isLocalLevelUp = event.playerNum === this.playerId;
        if (levelPlayer) {
          this.spawnLevelUpEffect(levelPlayer.x, levelPlayer.y, event.newLevel, levelPlayer, isLocalLevelUp);
        }
        if (isLocalLevelUp) {
          this.onLevelUp(event);
        }
        break;
      }
        
      case EventType.PLAYER_JOIN:
        if (event.player && !this.players.has(event.player.num)) {
          this.players.set(event.player.num, new InterpolatedEntity(event.player));
        }
        break;
        
      case EventType.PLAYER_LEAVE:
        this.players.delete(event.num);
        break;
        
      case EventType.COIN_SPAWN: {
        this.coins.set(event.id, new Coin(event));
        
        // Check if this coin spawned near a recent death (loot drop)
        const now = performance.now();
        for (const death of this.recentDeaths) {
          const dist = Math.hypot(event.x - death.x, event.y - death.y);
          if (dist < 150 && now - death.time < 500) { // Within 150 units and 500ms of death
            // Spawn loot coin animation from death location to coin location
            // Track the coin ID so we can hide the real coin until animation lands
            const lootCoin = new LootCoin(death.x, death.y, event.x, event.y, event.value || 5, event.id);
            this.lootCoins.push(lootCoin);
            this.animatingCoinIds.add(event.id);
            break;
          }
        }
        break;
      }
        
      case EventType.COIN_PICKUP:
        this.coins.delete(event.id);
        this.animatingCoinIds.delete(event.id); // In case coin was picked up during animation
        // SFX: only play for the local player's pickups
        if (event.playerNum === this.playerId) {
          SoundManager.playCoinPickup();
        }
        break;

      case EventType.SNIP_START:
        // Client-side fuse visual + local fuse SFX is driven off this + isSnipped flag
        this.startSnipFuse(event.playerNum, event.snipperNum);
        break;
        
      case EventType.CAPTURE: {
        const player = this.players.get(event.playerNum);
        const isLocalPlayer = event.playerNum === this.playerId;
        console.log('[CAPTURE] Event received:', event, 'isLocal:', isLocalPlayer, 'player:', player);
        if (player) {
          this.spawnCaptureEffect(event.x, event.y, event.xpGained, player, isLocalPlayer);
        }
        break;
      }
        
      case 'dead': {
        // Local player died - spawn death VFX
        const deadPlayer = this.players.get(this.playerId);
        if (deadPlayer) {
          this.spawnDeathEffect(deadPlayer, true);
        }
        this.onDeath(event);
        break;
      }
    }
  }
  
  /**
   * Add hitscan effect
   * Calculates laser positions from player positions (saves bandwidth)
   */
  addHitscanEffect(event) {
    const owner = this.players.get(event.ownerNum);
    const target = this.players.get(event.targetNum);
    
    if (!owner || !target) return;
    
    const color = owner.base;
    
    // Pick a random drone from the owner to fire from (visual only)
    let fromX = owner.x;
    let fromY = owner.y;
    if (owner.drones.length > 0) {
      const drone = owner.drones[Math.floor(Math.random() * owner.drones.length)];
      fromX = drone.x;
      fromY = drone.y;
    }
    
    this.effects.push(new HitscanEffect(
      fromX,
      fromY,
      target.x,
      target.y,
      color
    ));

    // SFX: laser shot (own vs enemy, distance-based for enemy)
    const local = this.players.get(this.playerId);
    if (local) {
      if (event.ownerNum === this.playerId) {
        SoundManager.playPlayerLaser();
      } else {
        const dist = Math.hypot(fromX - local.x, fromY - local.y);
        SoundManager.playEnemyLaser(dist);
      }
    }
  }
  
  /**
   * Handle network error
   */
  handleError(err) {
    console.error('Network error:', err);
  }
  
  /**
   * Start game loop
   */
  startGameLoop() {
    this.running = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.gameLoop);
  }
  
  /**
   * Stop game loop
   */
  stopGameLoop() {
    this.running = false;
  }
  
  /**
   * Main game loop
   */
  gameLoop(timestamp) {
    if (!this.running) return;
    
    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    
    // Update
    this.update(deltaMs);
    
    // Render
    this.render();
    
    // Flush pending input
    this.net.flushInput();
    
    // Continue loop
    requestAnimationFrame(this.gameLoop);
  }
  
  /**
   * Update game state
   */
  update(deltaMs) {
    const localPlayer = this.players.get(this.playerId);

    // In spectate mode, we don't control a player
    if (!this.spectateMode) {
      // Update local input angle (WASD or mouse) and send to server at the net client's throttle rate.
      if (localPlayer && !localPlayer.dead) {
        const nextAngle = this.computeInputAngle(localPlayer, deltaMs);
        if (typeof nextAngle === 'number' && Number.isFinite(nextAngle)) {
          this.targetAngle = nextAngle;
          this.net.sendInput(this.targetAngle);
        }
      }
    }
    
    for (const [id, player] of this.players) {
      if (!this.spectateMode && id === this.playerId && localPlayer && !localPlayer.dead) {
        // Local player: use client-side prediction
        player.predict(deltaMs, consts.SPEED, this.mapSize, this.targetAngle);
      } else {
        // Other players (or all players in spectate mode): extrapolate movement + gentle correction
        player.interpolateOther(deltaMs, consts.SPEED);
      }
    }
    
    // Camera handling
    if (this.spectateMode) {
      // Spectate mode: keep camera centered on map, update zoom to fit
      this.cameraX = this.mapSize / 2;
      this.cameraY = this.mapSize / 2;
      const padding = 50;
      this.cameraScale = Math.min(
        this.canvas.width / (this.mapSize + padding * 2),
        this.canvas.height / (this.mapSize + padding * 2)
      );
    } else if (localPlayer) {
      // Normal mode: camera smoothly follows local player
      this.cameraTargetX = localPlayer.x;
      this.cameraTargetY = localPlayer.y;
      
      // Smooth camera movement - lerp towards target
      const cameraLerp = 0.15;
      this.cameraX += (this.cameraTargetX - this.cameraX) * cameraLerp;
      this.cameraY += (this.cameraTargetY - this.cameraY) * cameraLerp;
    }
    
    // Snip fuse (client-side visual + local SFX)
    this.updateSnipFuses(deltaMs);
    
    // Speed buff visual effect (spikes behind player when speed buff >= 10%)
    this.updateSpeedBuffEffects(deltaMs);
    
    // Death effects (particles, screen shake, dissolve)
    this.updateDeathEffects();
    
    // Capture feedback effects (pulse ring, particles, +XP text)
    this.updateCaptureEffects();
    
    // Level-up effects
    this.updateLevelUpEffects();
    
    // Loot coin animations
    this.updateLootCoins();
    
    // Update territory portions for leaderboard
    this.updateTerritoryPortions();

    // Clean up expired effects
    this.effects = this.effects.filter(e => !e.isExpired());
    
    // Periodic cleanup for orphaned trails/state (runs every 2 seconds)
    const now = performance.now();
    if (now - this.lastCleanupTime > this.cleanupIntervalMs) {
      this.lastCleanupTime = now;
      this.cleanupOrphanedState();
    }
  }
  
  /**
   * Periodic cleanup to catch orphaned trails, fuses, and other stale state
   * This catches edge cases where normal cleanup didn't run
   */
  cleanupOrphanedState() {
    // Clean up snipFuses for players that no longer exist
    for (const [playerNum, state] of Array.from(this.snipFuses.entries())) {
      const player = this.players.get(playerNum);
      if (!player) {
        this.snipFuses.delete(playerNum);
        continue;
      }
      // If fuse has been alive too long without sawSnipped, it's orphaned
      if (state.elapsed > 5 && !state.sawSnipped) {
        this.snipFuses.delete(playerNum);
      }
    }
    
    // Clean up speedBuffState for players that no longer exist
    for (const [playerId] of Array.from(this.speedBuffState.entries())) {
      if (!this.players.has(playerId)) {
        this.speedBuffState.delete(playerId);
      }
    }
    
    // Clear trails and territories for players that shouldn't have them
    for (const [, player] of this.players) {
      // If player is dead, clear their trail and territory
      if (player.dead) {
        player.trail = [];
        player.territory = [];
        continue;
      }
      
      // If player has trail but isn't snipped and trail is very old (stale), clear it
      if (player.trail && player.trail.length > 0 && !player.isSnipped) {
        // Check if trail start is very far from player (indicates stale data)
        const trailStart = player.trail[0];
        const dx = trailStart.x - player.x;
        const dy = trailStart.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // If trail start is more than 500 units from player, it's likely stale
        if (dist > 500) {
          player.trail = [];
        }
      }
      
      // If player has territory, check if it's stale (player very far from territory centroid)
      if (player.territory && player.territory.length > 3) {
        // Calculate territory centroid
        let cx = 0, cy = 0;
        for (const pt of player.territory) {
          cx += pt.x;
          cy += pt.y;
        }
        cx /= player.territory.length;
        cy /= player.territory.length;
        
        // If player is very far from their territory centroid, it might be stale
        const dx = player.x - cx;
        const dy = player.y - cy;
        const distFromTerritory = Math.sqrt(dx * dx + dy * dy);
        
        // If player is more than 1000 units from territory centroid, clear it
        // (This is a large threshold to account for large territories, but catches major glitches)
        if (distFromTerritory > 1000) {
          player.territory = [];
        }
      }
    }
    
    // Clean up dying players that somehow got stuck
    const cutoff = performance.now() - 5000; // 5 seconds max
    this.dyingPlayers = this.dyingPlayers.filter(dp => dp.deathTime > cutoff);
  }
  
  /**
   * Calculate speed buff based on time outside territory
   * Uses config values: TRAIL_SPEED_BUFF_MAX, TRAIL_SPEED_BUFF_RAMP_TIME, TRAIL_SPEED_BUFF_EASE
   */
  calculateSpeedBuff(timeOutsideSec) {
    const maxBuff = consts.TRAIL_SPEED_BUFF_MAX || 1.4;
    const rampTime = consts.TRAIL_SPEED_BUFF_RAMP_TIME || 5;
    const ease = consts.TRAIL_SPEED_BUFF_EASE || 2;
    
    // Progress from 0 to 1 over ramp time
    const progress = Math.min(1, timeOutsideSec / rampTime);
    
    // Apply easing (higher ease = slower start)
    const easedProgress = Math.pow(progress, ease);
    
    // Calculate buff: 1.0 to maxBuff
    return 1.0 + (maxBuff - 1.0) * easedProgress;
  }
  
  /**
   * Check if a point is inside a polygon (ray casting)
   */
  pointInPolygon(x, y, polygon) {
    if (!polygon || polygon.length < 3) return false;
    
    let inside = false;
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
   * Update speed buff effects for all players
   */
  updateSpeedBuffEffects(deltaMs) {
    const SPEED_TRAIL_THRESHOLD = 1.1; // 10% speed buff to show trail/spikes
    const now = performance.now();
    
    // Update for all players (visual spikes for everyone)
    for (const [id, player] of this.players) {
      if (player.dead) continue;
      
      // Get or create speed buff state for this player
      let state = this.speedBuffState.get(id);
      if (!state) {
        state = { trailStartTime: null, lastSpeedBuff: 1.0, speedRushActive: false };
        this.speedBuffState.set(id, state);
      }
      
      // Check if player has a trail (outside territory)
      const hasTrail = player.trail && player.trail.length > 0;
      const isSnipped = player.isSnipped;
      
      // If snipped, lose speed buff
      if (isSnipped) {
        state.trailStartTime = null;
        state.lastSpeedBuff = 1.0;
        
        // Stop sound for local player
        if (id === this.playerId && state.speedRushActive) {
          SoundManager.stopSpeedRushSound();
          state.speedRushActive = false;
        }
        continue;
      }
      
      if (hasTrail) {
        // Player is outside territory - track time
        if (state.trailStartTime === null) {
          state.trailStartTime = now;
        }
        
        const timeOutsideSec = (now - state.trailStartTime) / 1000;
        const speedBuff = this.calculateSpeedBuff(timeOutsideSec);
        state.lastSpeedBuff = speedBuff;
        
        // Store speed ratio for rendering (0 at 1.1x, 1 at max buff)
        const maxBuff = consts.TRAIL_SPEED_BUFF_MAX || 1.4;
        player._speedRatio = Math.min(1.0, Math.max(0, (speedBuff - SPEED_TRAIL_THRESHOLD) / (maxBuff - SPEED_TRAIL_THRESHOLD)));
        player._hasSpeedBuff = speedBuff >= SPEED_TRAIL_THRESHOLD;
        
        // Sound effects only for local player
        if (id === this.playerId) {
          if (speedBuff >= SPEED_TRAIL_THRESHOLD) {
            if (!state.speedRushActive) {
              SoundManager.startSpeedRushSound();
              state.speedRushActive = true;
            }
            SoundManager.updateSpeedRushSound(speedBuff);
          } else if (state.speedRushActive) {
            SoundManager.stopSpeedRushSound();
            state.speedRushActive = false;
          }
        }
      } else {
        // Player is in territory - reset
        state.trailStartTime = null;
        state.lastSpeedBuff = 1.0;
        player._speedRatio = 0;
        player._hasSpeedBuff = false;
        
        // Stop sound for local player
        if (id === this.playerId && state.speedRushActive) {
          SoundManager.stopSpeedRushSound();
          state.speedRushActive = false;
        }
      }
    }
    
    // Update spike pulse phase for animation
    const localPlayer = this.players.get(this.playerId);
    if (localPlayer && localPlayer._hasSpeedBuff) {
      // Pulse speed: 6-14 radians per second based on speed ratio
      const pulseSpeed = 6 + (localPlayer._speedRatio || 0) * 8;
      this.speedSpikeState.pulsePhase += pulseSpeed * (deltaMs / 1000);
      this.speedSpikeState.active = true;
    } else {
      this.speedSpikeState.active = false;
    }
  }

  /**
   * Spawn death VFX for a player
   * Creates burst particles, sparks, expanding rings, and territory shards
   */
  spawnDeathEffect(player, isLocalPlayer = false) {
    const x = player.x;
    const y = player.y;
    const color = player.base ? player.base.rgbString() : '#ff4444';
    const lightColor = player.base ? player.base.lighter(0.3).rgbString() : '#ff8888';
    
    // Track death location for loot coin animations
    this.recentDeaths.push({ x, y, time: performance.now() });
    // Clean up old death locations (older than 2 seconds)
    const now = performance.now();
    this.recentDeaths = this.recentDeaths.filter(d => now - d.time < 2000);
    
    // Burst particles (square confetti)
    const burstCount = isLocalPlayer ? 40 : 25;
    for (let i = 0; i < burstCount; i++) {
      this.deathParticles.push(new DeathParticle(x, y, color, 'burst'));
    }
    
    // Spark particles (with trails)
    const sparkCount = isLocalPlayer ? 20 : 12;
    for (let i = 0; i < sparkCount; i++) {
      this.deathParticles.push(new DeathParticle(x, y, lightColor, 'spark'));
    }
    
    // Expanding ring(s)
    this.deathParticles.push(new DeathParticle(x, y, color, 'ring'));
    if (isLocalPlayer) {
      // Delayed second ring for local player death
      setTimeout(() => {
        this.deathParticles.push(new DeathParticle(x, y, lightColor, 'ring'));
      }, 100);
    }
    
    // Territory shards (pieces breaking off from territory)
    if (player.territory && player.territory.length > 3) {
      const shardCount = isLocalPlayer ? 15 : 8;
      for (let i = 0; i < shardCount; i++) {
        const idx = Math.floor(Math.random() * player.territory.length);
        const pt = player.territory[idx];
        this.deathParticles.push(new DeathParticle(pt.x, pt.y, color, 'shard'));
      }
    }
    
    // Screen shake for local player
    if (isLocalPlayer) {
      this.screenShake.intensity = 25;
    }
    
    // Track dying player for dissolve effect (save all visual data since player will be removed)
    this.dyingPlayers.push({
      num: player.num,
      x: player.x,
      y: player.y,
      angle: player.angle,
      color: player.base,
      sizeScale: player.sizeScale || 1.0,
      territory: player.territory ? [...player.territory] : [],
      trail: player.trail ? [...player.trail] : [],
      deathTime: performance.now(),
      dissolveProgress: 0
    });
    
    // Play death sound
    if (isLocalPlayer) {
      SoundManager.playDeathSound(true);
    } else {
      const localPlayer = this.players.get(this.playerId);
      if (localPlayer) {
        const dx = player.x - localPlayer.x;
        const dy = player.y - localPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        SoundManager.playDeathSound(false, distance);
      }
    }
  }

  /**
   * Update death effects (particles, screen shake, dissolve)
   */
  updateDeathEffects() {
    // Update particles
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      if (!this.deathParticles[i].update()) {
        this.deathParticles.splice(i, 1);
      }
    }
    
    // Update screen shake
    if (this.screenShake.intensity > 0.5) {
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 2;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 2;
      this.screenShake.intensity *= this.screenShake.decay;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
      this.screenShake.intensity = 0;
    }
    
    // Update dissolve progress for dying players
    const now = performance.now();
    for (let i = this.dyingPlayers.length - 1; i >= 0; i--) {
      const dp = this.dyingPlayers[i];
      dp.dissolveProgress = Math.min(1, (now - dp.deathTime) / 1500); // 1.5s dissolve
      if (dp.dissolveProgress >= 1) {
        this.dyingPlayers.splice(i, 1);
      }
    }
  }

  /**
   * Render death particles
   */
  renderDeathParticles(ctx) {
    for (const particle of this.deathParticles) {
      particle.render(ctx);
    }
  }
  
  /**
   * Spawn capture feedback effect
   */
  spawnCaptureEffect(x, y, xpGained, player, isLocalPlayer) {
    this.captureEffects.push(new CaptureEffect(x, y, xpGained, player, isLocalPlayer));
    
    // Trigger outline thickening for local player
    if (isLocalPlayer) {
      this.localOutlineThicken.active = true;
      this.localOutlineThicken.startTime = performance.now();
    }
    
    // Play capture sound for local player
    if (isLocalPlayer) {
      SoundManager.playCaptureSound();
    }
  }
  
  /**
   * Update capture effects
   */
  updateCaptureEffects() {
    // Update effects and remove expired ones
    for (let i = this.captureEffects.length - 1; i >= 0; i--) {
      if (!this.captureEffects[i].update()) {
        this.captureEffects.splice(i, 1);
      }
    }
    
    // Update local outline thickening
    if (this.localOutlineThicken.active) {
      const elapsed = performance.now() - this.localOutlineThicken.startTime;
      if (elapsed >= this.localOutlineThicken.duration) {
        this.localOutlineThicken.active = false;
      }
    }
  }
  
  /**
   * Render capture effects
   */
  renderCaptureEffects(ctx) {
    for (const effect of this.captureEffects) {
      effect.render(ctx);
    }
  }
  
  /**
   * Spawn level-up VFX
   */
  spawnLevelUpEffect(x, y, newLevel, player, isLocalPlayer) {
    // Golden burst particles
    const burstCount = isLocalPlayer ? 30 : 8;
    for (let i = 0; i < burstCount; i++) {
      this.deathParticles.push(new DeathParticle(x, y, '#FFD700', 'burst'));
    }
    
    // Golden ring
    this.deathParticles.push(new DeathParticle(x, y, '#FFD700', 'ring'));
    
    // Screen shake for local player
    if (isLocalPlayer) {
      this.screenShake.intensity = 10;
      
      // Floating "LEVEL UP!" text (only for local player)
      this.levelUpEffects.push(new LevelUpTextEffect(x, y, newLevel, player, isLocalPlayer));
      
      // Play level up sound
      SoundManager.playLevelUpSound();
    }
  }
  
  /**
   * Update level-up effects
   */
  updateLevelUpEffects() {
    for (let i = this.levelUpEffects.length - 1; i >= 0; i--) {
      if (!this.levelUpEffects[i].update()) {
        this.levelUpEffects.splice(i, 1);
      }
    }
  }
  
  /**
   * Render level-up effects
   */
  renderLevelUpEffects(ctx) {
    for (const effect of this.levelUpEffects) {
      effect.render(ctx);
    }
  }
  
  /**
   * Update loot coin animations
   */
  updateLootCoins() {
    for (let i = this.lootCoins.length - 1; i >= 0; i--) {
      const lootCoin = this.lootCoins[i];
      if (!lootCoin.update()) {
        // Animation finished - remove from animating set so real coin shows
        if (lootCoin.coinId !== null) {
          this.animatingCoinIds.delete(lootCoin.coinId);
        }
        this.lootCoins.splice(i, 1);
      }
    }
  }
  
  /**
   * Render loot coin animations
   */
  renderLootCoins(ctx) {
    for (const coin of this.lootCoins) {
      coin.render(ctx);
    }
  }
  
  /**
   * Update territory portions for leaderboard ranking
   */
  updateTerritoryPortions() {
    const mapArea = this.mapSize * this.mapSize;
    for (const [id, player] of this.players) {
      if (player.territory && player.territory.length >= 3) {
        const area = this.polygonArea(player.territory);
        this.playerPortions.set(id, area / mapArea);
      } else {
        this.playerPortions.set(id, 0);
      }
    }
  }
  
  /**
   * Calculate polygon area (for territory percentage)
   */
  polygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
    }
    return Math.abs(area / 2);
  }
  
  /**
   * Get territory percentage for a player
   */
  getTerritoryPercent(playerId) {
    return (this.playerPortions.get(playerId) || 0) * 100;
  }
  
  /**
   * Get sorted leaderboard by territory percentage
   */
  getLeaderboard() {
    const entries = [];
    for (const [id, player] of this.players) {
      entries.push({
        player,
        portion: this.playerPortions.get(id) || 0,
      });
    }
    entries.sort((a, b) => b.portion - a.portion);
    return entries;
  }
  
  /**
   * Get outline thickness multiplier for a player (for capture feedback)
   */
  getOutlineThickness(playerNum) {
    if (playerNum === this.playerId && this.localOutlineThicken.active) {
      const elapsed = performance.now() - this.localOutlineThicken.startTime;
      const progress = Math.min(1, elapsed / this.localOutlineThicken.duration);
      // Ease out: starts thick, returns to normal
      const thickenFactor = 1 + 2 * (1 - progress);
      return thickenFactor;
    }
    return 1;
  }

  /**
   * Get dissolve progress for a player (0 = alive, 1 = fully dissolved)
   */
  getDissolveProgress(playerNum) {
    const dp = this.dyingPlayers.find(d => d.num === playerNum);
    return dp ? dp.dissolveProgress : 0;
  }

  /**
   * Render dying player ghosts (territory, trail, body fading out)
   */
  renderDyingPlayers(ctx) {
    for (const dp of this.dyingPlayers) {
      if (dp.dissolveProgress >= 1) continue;
      
      const alpha = Math.max(0, 1 - dp.dissolveProgress);
      const color = dp.color;
      if (!color) continue;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      
      // Draw fading territory
      if (dp.territory && dp.territory.length >= 3) {
        ctx.fillStyle = color.deriveAlpha(0.4 * alpha).rgbString();
        ctx.beginPath();
        ctx.moveTo(dp.territory[0].x, dp.territory[0].y);
        for (let i = 1; i < dp.territory.length; i++) {
          ctx.lineTo(dp.territory[i].x, dp.territory[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = color.deriveAlpha(0.9 * alpha).rgbString();
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      
      // Draw fading trail
      if (dp.trail && dp.trail.length >= 2) {
        const tailColor = color.lighter(0.2);
        ctx.strokeStyle = tailColor.deriveAlpha(alpha).rgbString();
        ctx.lineWidth = PLAYER_RADIUS;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(dp.trail[0].x, dp.trail[0].y);
        for (let i = 1; i < dp.trail.length; i++) {
          ctx.lineTo(dp.trail[i].x, dp.trail[i].y);
        }
        ctx.lineTo(dp.x, dp.y);
        ctx.stroke();
      }
      
      // Draw fading player body
      const scaledRadius = PLAYER_RADIUS * dp.sizeScale;
      
      // Shadow
      ctx.fillStyle = color.darker(0.3).deriveAlpha(alpha).rgbString();
      ctx.beginPath();
      ctx.arc(dp.x + 2, dp.y + 4, scaledRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Body
      ctx.fillStyle = color.deriveAlpha(alpha).rgbString();
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, scaledRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Direction indicator
      const indicatorX = dp.x + Math.cos(dp.angle) * scaledRadius * 0.6;
      const indicatorY = dp.y + Math.sin(dp.angle) * scaledRadius * 0.6;
      ctx.fillStyle = color.lighter(0.1).deriveAlpha(alpha).rgbString();
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, scaledRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  computeInputAngle(player, deltaMs) {
    // WASD overrides mouse while any key is pressed.
    if (this.useWasd) {
      let dx = 0;
      let dy = 0;
      if (this.wasdKeys.w) dy -= 1;
      if (this.wasdKeys.s) dy += 1;
      if (this.wasdKeys.a) dx -= 1;
      if (this.wasdKeys.d) dx += 1;

      if (dx === 0 && dy === 0) return null;

      const target = Math.atan2(dy, dx);

      // Smoothly rotate toward target at a frame-rate independent max step.
      let diff = target - this.wasdCurrentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const maxStep = 0.15 * (deltaMs / 16.67); // matches server tuning at 60fps
      if (Math.abs(diff) <= maxStep) {
        this.wasdCurrentAngle = target;
      } else {
        this.wasdCurrentAngle += Math.sign(diff) * maxStep;
      }

      while (this.wasdCurrentAngle > Math.PI) this.wasdCurrentAngle -= Math.PI * 2;
      while (this.wasdCurrentAngle < -Math.PI) this.wasdCurrentAngle += Math.PI * 2;

      return this.wasdCurrentAngle;
    }

    // Mouse aim / movement (recomputed every frame so it stays correct as the camera follows you).
    if (!this.mouseSet) return null;

    const worldX = this.cameraX + (this.mouseX - this.canvas.width / 2) / this.cameraScale;
    const worldY = this.cameraY + (this.mouseY - this.canvas.height / 2) / this.cameraScale;
    const dx = worldX - player.x;
    const dy = worldY - player.y;

    // Deadzone: if the cursor is very close to the player center, don't jitter.
    if (dx * dx + dy * dy < 100) return null;

    const angle = Math.atan2(dy, dx);
    this.wasdCurrentAngle = angle; // smooth handoff back to WASD
    return angle;
  }
  
  /**
   * Render game
   */
  render() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const gameHeight = height - BAR_HEIGHT;
    
    // Clear with light background
    ctx.fillStyle = '#e2ebf3';
    ctx.fillRect(0, 0, width, height);
    
    // Save context for game world
    ctx.save();
    
    // Move below the top bar
    ctx.translate(0, BAR_HEIGHT);
    
    // Clip to game area
    ctx.beginPath();
    ctx.rect(0, 0, width, gameHeight);
    ctx.clip();
    
    // Apply camera transform with screen shake
    ctx.translate(width / 2 + this.screenShake.x, gameHeight / 2 + this.screenShake.y);
    ctx.scale(this.cameraScale, this.cameraScale);
    ctx.translate(-this.cameraX, -this.cameraY);
    
    // Draw grid background
    this.drawGrid(ctx);
    
    // Draw territories (sorted by num for consistent z-ordering)
    const sortedPlayers = Array.from(this.players.values()).sort((a, b) => a.num - b.num);
    for (const player of sortedPlayers) {
      this.drawTerritory(ctx, player);
    }
    
    // Draw coins (skip coins that have active loot animations)
    for (const coin of this.coins.values()) {
      if (!this.animatingCoinIds.has(coin.id)) {
        this.drawCoin(ctx, coin);
      }
    }
    
    // Draw trails
    for (const player of sortedPlayers) {
      this.drawTrail(ctx, player);
    }
    
    // Draw speed spikes (above trails, below players)
    for (const player of sortedPlayers) {
      if (!player.dead && player._hasSpeedBuff) {
        this.drawSpeedSpikes(ctx, player);
      }
    }
    
    // Draw players
    for (const player of sortedPlayers) {
      if (!player.dead) {
        this.drawPlayer(ctx, player);
      }
    }
    
    // Draw dying player ghosts (dissolve effect)
    this.renderDyingPlayers(ctx);
    
    // Draw effects (hitscan lasers)
    for (const effect of this.effects) {
      this.drawHitscan(ctx, effect);
    }
    
    // Draw capture effects (pulse ring, particles, +XP text)
    this.renderCaptureEffects(ctx);
    
    // Draw level-up effects (floating text)
    this.renderLevelUpEffects(ctx);
    
    // Draw loot coin animations
    this.renderLootCoins(ctx);
    
    // Draw death particles (above everything else in game world)
    this.renderDeathParticles(ctx);
    
    // Restore context
    ctx.restore();
    
    // Draw UI (top bar, leaderboard, XP bar)
    this.drawTopBar(ctx);
    this.drawLeaderboard(ctx);
    this.drawXPBar(ctx);
    
    // Debug HUD
    if (this.debugMode) {
      this.drawDebugHUD(ctx);
    }
  }
  
  /**
   * Draw debug HUD
   */
  drawDebugHUD(ctx) {
    const x = 10;
    let y = 150;
    const lineHeight = 16;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(5, y - 15, 250, 180);
    
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    ctx.fillText('=== DEBUG MODE (press D to toggle) ===', x, y);
    y += lineHeight;
    
    // Count players and calculate errors
    let totalError = 0;
    let maxError = 0;
    let playerCount = 0;
    
    for (const [id, player] of this.players) {
      if (id === this.playerId || player.dead) continue;
      
      const errorX = player.serverX - player.x;
      const errorY = player.serverY - player.y;
      const error = Math.sqrt(errorX * errorX + errorY * errorY);
      
      totalError += error;
      maxError = Math.max(maxError, error);
      playerCount++;
    }
    
    const avgError = playerCount > 0 ? totalError / playerCount : 0;
    
    ctx.fillText(`Players: ${this.players.size} (${playerCount} others)`, x, y);
    y += lineHeight;
    ctx.fillText(`Avg position error: ${avgError.toFixed(1)}px`, x, y);
    y += lineHeight;
    ctx.fillText(`Max position error: ${maxError.toFixed(1)}px`, x, y);
    y += lineHeight;
    
    // Network timing
    const avgGap = this.networkGaps.length > 0 
      ? this.networkGaps.reduce((a, b) => a + b, 0) / this.networkGaps.length 
      : 0;
    const maxGap = this.networkGaps.length > 0 
      ? Math.max(...this.networkGaps) 
      : 0;
    const timeSinceUpdate = performance.now() - this.lastNetworkUpdate;
    
    ctx.fillText(`Net update gap: avg ${avgGap.toFixed(0)}ms, max ${maxGap.toFixed(0)}ms`, x, y);
    y += lineHeight;
    ctx.fillStyle = timeSinceUpdate > 150 ? '#ff0000' : '#00ff00';
    ctx.fillText(`Time since last update: ${timeSinceUpdate.toFixed(0)}ms`, x, y);
    ctx.fillStyle = '#00ff00';
    y += lineHeight;
    
    // Show local player info
    const localPlayer = this.players.get(this.playerId);
    if (localPlayer) {
      y += lineHeight;
      ctx.fillStyle = '#ffff00';
      ctx.fillText('--- Local Player ---', x, y);
      y += lineHeight;
      ctx.fillStyle = '#00ff00';
      ctx.fillText(`Pos: (${localPlayer.x.toFixed(1)}, ${localPlayer.y.toFixed(1)})`, x, y);
      y += lineHeight;
      ctx.fillText(`Server: (${localPlayer.serverX.toFixed(1)}, ${localPlayer.serverY.toFixed(1)})`, x, y);
      y += lineHeight;
      const localError = Math.sqrt(
        Math.pow(localPlayer.serverX - localPlayer.x, 2) +
        Math.pow(localPlayer.serverY - localPlayer.y, 2)
      );
      ctx.fillText(`Correction offset: ${localError.toFixed(1)}px`, x, y);
    }
  }
  
  /**
   * Draw grid background
   */
  drawGrid(ctx) {
    const mapSize = this.mapSize;
    const borderWidth = consts.BORDER_WIDTH || 20;
    
    // Light background
    ctx.fillStyle = 'rgb(211, 225, 237)';
    ctx.fillRect(0, 0, mapSize, mapSize);
    
    // Subtle grid lines
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.5)';
    ctx.lineWidth = 1;
    const gridSpacing = consts.CELL_WIDTH * 2;
    
    ctx.beginPath();
    for (let x = 0; x <= mapSize; x += gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapSize);
    }
    for (let y = 0; y <= mapSize; y += gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(mapSize, y);
    }
    ctx.stroke();
    
    // Border (light gray)
    ctx.fillStyle = 'lightgray';
    ctx.fillRect(-borderWidth, 0, borderWidth, mapSize);
    ctx.fillRect(-borderWidth, -borderWidth, mapSize + borderWidth * 2, borderWidth);
    ctx.fillRect(mapSize, 0, borderWidth, mapSize);
    ctx.fillRect(-borderWidth, mapSize, mapSize + borderWidth * 2, borderWidth);
  }
  
  /**
   * Draw player territory
   */
  drawTerritory(ctx, player) {
    if (!player.territory || player.territory.length < 3) return;
    
    const color = player.base;
    const isSnipped = player.isSnipped;
    
    // Snipped visual effect - flashing
    let snipAlpha = 1;
    if (isSnipped) {
      const time = Date.now() / 100;
      snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
    }
    
    // Territory fill (semi-transparent)
    ctx.fillStyle = color.deriveAlpha(0.4 * snipAlpha).rgbString();
    ctx.beginPath();
    ctx.moveTo(player.territory[0].x, player.territory[0].y);
    for (let i = 1; i < player.territory.length; i++) {
      ctx.lineTo(player.territory[i].x, player.territory[i].y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Territory outline (with capture feedback thickening)
    const outlineThickness = this.getOutlineThickness(player.num);
    ctx.strokeStyle = color.deriveAlpha(0.9 * snipAlpha).rgbString();
    ctx.lineWidth = 2.5 * outlineThickness;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  
  /**
   * Draw player trail
   */
  drawTrail(ctx, player) {
    if (!player.trail || player.trail.length < 1) return;
    
    const color = player.base;
    const tailColor = color.lighter(0.2);
    
    ctx.strokeStyle = tailColor.rgbString();
    ctx.lineWidth = PLAYER_RADIUS;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const playerX = player.x;
    const playerY = player.y;

    // Snip fuse: render only the unburned trail portion (fuse -> player) + spark
    // Check both isSnipped flag AND our fuse state (fuse state may exist before isSnipped syncs)
    const fuse = this.snipFuses.get(player.num);
    const hasActiveFuse = fuse && (player.isSnipped || !fuse.sawSnipped); // Active if snipped OR if we haven't confirmed snip ended
    
    if (hasActiveFuse) {
      // Try to render with fuse state
      if (fuse.remainingPoints && fuse.remainingPoints.length >= 2 && fuse.fusePos) {
        ctx.beginPath();
        ctx.moveTo(fuse.remainingPoints[0].x, fuse.remainingPoints[0].y);
        for (let i = 1; i < fuse.remainingPoints.length; i++) {
          ctx.lineTo(fuse.remainingPoints[i].x, fuse.remainingPoints[i].y);
        }
        ctx.stroke();

        // Burning fuse spark (ported vibe from deprecated/core/player.js)
        this._drawFuseSpark(ctx, fuse.fusePos, fuse.remainingPoints, player.num);
        return;
      }
      
      // Fallback for snipped enemies without proper fuse state:
      // Render a simple fuse effect starting from trail[0] toward player
      if (player.trail && player.trail.length >= 1) {
        // Calculate approximate fuse position along trail based on elapsed time
        const baseSpeed = consts.SPEED || 4;
        const fuseMult = consts.SNIP_FUSE_SPEED_MULT || 1.5;
        const v0 = baseSpeed * fuseMult * 60;
        const approxDist = v0 * fuse.elapsed;
        
        // Build simple path from trail[0] to player
        const fullPoints = [...player.trail, { x: player.x, y: player.y }];
        const totalLen = this._sumLength(fullPoints);
        const clampedDist = Math.min(approxDist, totalLen);
        
        const fuseResult = this._pointAtDistanceWithIndex(fullPoints, clampedDist);
        if (fuseResult.point) {
          // Draw remaining trail from fuse to player
          const pointsAfterFuse = fullPoints.slice(fuseResult.index + 1);
          const remainingPoints = [fuseResult.point, ...pointsAfterFuse];
          
          if (remainingPoints.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(remainingPoints[0].x, remainingPoints[0].y);
            for (let i = 1; i < remainingPoints.length; i++) {
              ctx.lineTo(remainingPoints[i].x, remainingPoints[i].y);
            }
            ctx.stroke();
            
            this._drawFuseSpark(ctx, fuseResult.point, remainingPoints, player.num);
            return;
          }
        }
      }
      
      // Ultimate fallback: just draw spark at trail start with full trail
      if (player.trail && player.trail.length >= 1) {
        const sparkPos = { x: player.trail[0].x, y: player.trail[0].y };
        ctx.beginPath();
        ctx.moveTo(player.trail[0].x, player.trail[0].y);
        for (let i = 1; i < player.trail.length; i++) {
          ctx.lineTo(player.trail[i].x, player.trail[i].y);
        }
        ctx.lineTo(playerX, playerY);
        ctx.stroke();
        
        this._drawFuseSpark(ctx, sparkPos, player.trail, player.num);
        return;
      }
    }
    
    ctx.beginPath();
    ctx.moveTo(player.trail[0].x, player.trail[0].y);
    
    // Draw all trail points except the last one
    for (let i = 1; i < player.trail.length - 1; i++) {
      ctx.lineTo(player.trail[i].x, player.trail[i].y);
    }
    
    // For the last trail point, interpolate it towards the player position
    // This prevents the trail from appearing disconnected or ahead of the player
    if (player.trail.length > 1) {
      const lastPoint = player.trail[player.trail.length - 1];
      const distToPlayer = Math.hypot(lastPoint.x - playerX, lastPoint.y - playerY);
      
      // If last point is close to player, just connect directly
      // Otherwise, draw the last point but lerp it towards player
      if (distToPlayer > PLAYER_RADIUS * 2) {
        // Lerp the last point 50% towards player to smooth the connection
        const lerpedX = lastPoint.x + (playerX - lastPoint.x) * 0.5;
        const lerpedY = lastPoint.y + (playerY - lastPoint.y) * 0.5;
        ctx.lineTo(lerpedX, lerpedY);
      }
    }
    
    // Connect to player's current rendered position
    ctx.lineTo(playerX, playerY);
    ctx.stroke();
  }

  _sparkDirection(remainingPoints) {
    // Direction from fuse toward the next point (fallback to 0)
    if (!remainingPoints || remainingPoints.length < 2) return 0;
    const a = remainingPoints[0];
    const b = remainingPoints[1];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /**
   * Draw the burning fuse spark effect at a position
   */
  _drawFuseSpark(ctx, fusePos, remainingPoints, playerNum) {
    const t = performance.now();
    const flicker = 0.75 + 0.25 * Math.sin(t * 0.02 + playerNum);
    const sparkR = PLAYER_RADIUS * 0.6 * flicker;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const grad = ctx.createRadialGradient(
      fusePos.x,
      fusePos.y,
      0,
      fusePos.x,
      fusePos.y,
      sparkR * 2.0
    );
    grad.addColorStop(0, 'rgba(255,255,200,0.95)');
    grad.addColorStop(0.35, 'rgba(255,180,60,0.65)');
    grad.addColorStop(1, 'rgba(255,40,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fusePos.x, fusePos.y, sparkR * 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Little sparks shooting forward
    const dir = this._sparkDirection(remainingPoints);
    for (let i = 0; i < 6; i++) {
      const jitter = (i * 0.9 + t * 0.03 + playerNum) % (Math.PI * 2);
      const angle = dir + (Math.sin(jitter) * 0.7);
      const len = (sparkR * 2.2) * (0.4 + 0.6 * ((Math.sin(jitter * 1.7) + 1) * 0.5));
      const x2 = fusePos.x + Math.cos(angle) * len;
      const y2 = fusePos.y + Math.sin(angle) * len;
      ctx.strokeStyle = 'rgba(255,200,80,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fusePos.x, fusePos.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }
  
  /**
   * Draw speed spikes behind player (visual effect when speed buff >= 10%)
   * Copied from deprecated/mode/player.js renderSpeedTrailParticles
   */
  drawSpeedSpikes(ctx, player) {
    const speedRatio = player._speedRatio || 0;
    if (speedRatio <= 0) return;
    
    const playerX = player.x;
    const playerY = player.y;
    const playerAngle = player.angle;
    const baseColor = player.base;
    
    // Use global pulse phase for animation
    const pulsePhase = this.speedSpikeState.pulsePhase;
    
    // Number of spikes: 3 at low speed, 5 at max speed
    const spikeCount = 3 + Math.floor(speedRatio * 2);
    
    // Spread angle for spikes (wider at higher speeds)
    const totalSpread = 0.8 + speedRatio * 0.6; // ~45 to ~80 degrees total
    
    // Base spike length and width (scales with speed)
    const baseLength = 18 + speedRatio * 25;
    const baseWidth = 8 + speedRatio * 6;
    
    // Distance from player center where spikes start
    const startOffset = 12;
    
    // Get colors from player's base color
    const brightColor = baseColor.lighter(0.3).rgbString();
    const mainColor = baseColor.rgbString();
    
    ctx.save();
    
    for (let i = 0; i < spikeCount; i++) {
      // Calculate angle for this spike (spread behind player)
      const spreadPos = spikeCount > 1 ? (i / (spikeCount - 1)) - 0.5 : 0; // -0.5 to 0.5
      const spikeAngle = playerAngle + Math.PI + spreadPos * totalSpread;
      
      // Each spike has its own phase offset for wave effect
      const phaseOffset = (i / spikeCount) * Math.PI * 2;
      const pulse = Math.sin(pulsePhase + phaseOffset);
      
      // Pulsing size: oscillates between 40% and 100%
      const sizeMult = 0.4 + (pulse * 0.5 + 0.5) * 0.6;
      
      const length = baseLength * sizeMult;
      const width = baseWidth * sizeMult;
      
      if (length < 3) continue;
      
      // Calculate spike start (behind player) and tip
      const startX = playerX + Math.cos(spikeAngle) * startOffset;
      const startY = playerY + Math.sin(spikeAngle) * startOffset;
      const tipX = startX + Math.cos(spikeAngle) * length;
      const tipY = startY + Math.sin(spikeAngle) * length;
      
      // Perpendicular for width
      const perpAngle = spikeAngle + Math.PI / 2;
      const halfWidth = width / 2;
      
      // Alpha based on speed and pulse
      const alpha = (0.6 + speedRatio * 0.3) * (0.6 + sizeMult * 0.4);
      ctx.globalAlpha = alpha;
      
      // Create gradient along spike
      const gradient = ctx.createLinearGradient(startX, startY, tipX, tipY);
      gradient.addColorStop(0, brightColor);
      gradient.addColorStop(0.4, mainColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      // Draw spike as triangle
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(startX + Math.cos(perpAngle) * halfWidth, startY + Math.sin(perpAngle) * halfWidth);
      ctx.lineTo(startX - Math.cos(perpAngle) * halfWidth, startY - Math.sin(perpAngle) * halfWidth);
      ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fill();
      
      // Bright core line down the middle
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = brightColor;
      ctx.lineWidth = Math.max(1, width * 0.25);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  /**
   * Draw coin
   */
  drawCoin(ctx, coin) {
    const radius = consts.COIN_RADIUS || 8;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(coin.x + 2, coin.y + 2, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Main coin body
    ctx.fillStyle = '#FFD700';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Shine effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(coin.x - radius * 0.3, coin.y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  /**
   * Draw player
   */
  drawPlayer(ctx, player) {
    const scaledRadius = PLAYER_RADIUS * (player.sizeScale || 1.0);
    const color = player.base;
    const shadowColor = color.darker(0.3);
    const lightColor = color.lighter(0.1);
    const isSnipped = player.isSnipped;
    
    // Snipped visual effect
    let snipAlpha = 1;
    if (isSnipped) {
      const time = Date.now() / 100;
      snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
    }
    
    // Draw drone range indicator (only for local player with drones)
    if (player.num === this.playerId && player.drones && player.drones.length > 0) {
      this.drawDroneRangeIndicator(ctx, player);
    }
    
    // Draw drones
    for (const drone of player.drones) {
      this.drawDrone(ctx, drone, color, player);
    }
    
    // Player shadow
    ctx.fillStyle = shadowColor.deriveAlpha(snipAlpha).rgbString();
    ctx.beginPath();
    ctx.arc(player.x + 2, player.y + 4, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Player body
    if (isSnipped) {
      // Ghost effect: red-tinted, semi-transparent
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 4);
      ctx.fillStyle = `rgba(255, ${Math.floor(100 * pulse)}, ${Math.floor(100 * pulse)}, ${snipAlpha})`;
    } else {
      ctx.fillStyle = color.rgbString();
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Snipped glow ring
    if (isSnipped) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 6);
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 3 + 2 * pulse;
      ctx.beginPath();
      ctx.arc(player.x, player.y, scaledRadius + 4 + 2 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Direction indicator (dot, not line)
    const indicatorX = player.x + Math.cos(player.angle) * scaledRadius * 0.6;
    const indicatorY = player.y + Math.sin(player.angle) * scaledRadius * 0.6;
    ctx.fillStyle = lightColor.deriveAlpha(snipAlpha).rgbString();
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, scaledRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // HP bar (only show if damaged)
    if (player.hp < player.maxHp) {
      const barWidth = scaledRadius * 2.5;
      const barHeight = 6 * (player.sizeScale || 1.0);
      const barX = player.x - barWidth / 2;
      const barY = player.y + scaledRadius + 8;
      
      // Background
      ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // HP fill
      const hpRatio = Math.max(0, player.hp / player.maxHp);
      if (hpRatio > 0.5) {
        ctx.fillStyle = '#44ff44';
      } else if (hpRatio > 0.25) {
        ctx.fillStyle = '#ffcc00';
      } else {
        ctx.fillStyle = '#ff4444';
      }
      ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
      
      // Quarter divider lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = Math.max(1, 1.5 * (player.sizeScale || 1.0));
      for (let i = 1; i <= 3; i++) {
        const divX = barX + (barWidth * i / 4);
        ctx.beginPath();
        ctx.moveTo(divX, barY);
        ctx.lineTo(divX, barY + barHeight);
        ctx.stroke();
      }
      
      // Black outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, 2 * (player.sizeScale || 1.0));
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // Name (with snipped indicator)
    ctx.fillStyle = shadowColor.rgbString();
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    if (isSnipped) {
      ctx.fillStyle = 'rgba(255, 50, 50, 1)';
      ctx.fillText('SNIPPED!', player.x, player.y - scaledRadius - 22);
      ctx.fillStyle = shadowColor.deriveAlpha(snipAlpha).rgbString();
    }
    ctx.fillText(player.name, player.x, player.y - scaledRadius - 8);
    
    // Debug overlay
    if (this.debugMode && player.num !== this.playerId) {
      // Draw server position (green circle)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.serverX, player.serverY, scaledRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw line from client pos to server pos (red = error)
      const errorX = player.serverX - player.x;
      const errorY = player.serverY - player.y;
      const errorDist = Math.sqrt(errorX * errorX + errorY * errorY);
      
      if (errorDist > 1) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.serverX, player.serverY);
        ctx.stroke();
      }
      
      // Draw server angle (blue line)
      ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.serverX, player.serverY);
      ctx.lineTo(
        player.serverX + Math.cos(player.serverAngle) * 40,
        player.serverY + Math.sin(player.serverAngle) * 40
      );
      ctx.stroke();
      
      // Error text
      ctx.fillStyle = 'rgba(255, 255, 0, 1)';
      ctx.font = '10px monospace';
      ctx.fillText(`err: ${errorDist.toFixed(1)}px`, player.x, player.y + scaledRadius + 25);
    }
  }
  
  /**
   * Draw drone range indicator circle (only for local player)
   */
  drawDroneRangeIndicator(ctx, player) {
    const range = consts.DRONE_RANGE || 158;
    
    ctx.save();
    
    // Animated dash
    const time = Date.now() / 1000;
    
    // Draw subtle dashed circle
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -time * 30;
    ctx.beginPath();
    ctx.arc(player.x, player.y, range, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }
  
  /**
   * Draw drone
   */
  drawDrone(ctx, drone, color, owner) {
    const radius = DRONE_VISUAL_RADIUS;
    const isDisabled = owner && owner.isSnipped;
    const isUserDrone = owner && owner.num === this.playerId;
    
    ctx.save();
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(drone.x + 2, drone.y + 2, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Outer glow when targeting (not when disabled)
    if (drone.targetId !== null && !isDisabled) {
      const time = Date.now() / 150;
      const pulse = 0.4 + 0.3 * Math.sin(time * 4);
      ctx.shadowBlur = 12 * pulse;
      ctx.shadowColor = isUserDrone ? '#FFD700' : (color ? color.rgbString() : '#FF6600');
    }
    
    // Main body
    if (isDisabled) {
      ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    } else if (color) {
      ctx.fillStyle = color.deriveAlpha(isUserDrone ? 0.95 : 0.8).rgbString();
    } else {
      ctx.fillStyle = isUserDrone ? 'rgba(100, 200, 100, 0.95)' : 'rgba(200, 100, 100, 0.8)';
    }
    ctx.beginPath();
    ctx.arc(drone.x, drone.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    if (isDisabled) {
      ctx.strokeStyle = 'rgba(60, 60, 60, 0.6)';
    } else {
      ctx.strokeStyle = color ? color.darker(0.2).rgbString() : '#444';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Inner core (highlight)
    if (isDisabled) {
      ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
    } else {
      ctx.fillStyle = color ? color.lighter(0.3).deriveAlpha(0.7).rgbString() : 'rgba(255, 255, 255, 0.5)';
    }
    ctx.beginPath();
    ctx.arc(drone.x - radius * 0.25, drone.y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Targeting indicator (small dot when active)
    if (drone.targetId !== null && !isDisabled) {
      const time = Date.now() / 100;
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = `rgba(255, 100, 100, ${0.6 + 0.4 * pulse})`;
      ctx.beginPath();
      ctx.arc(drone.x, drone.y, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Disabled indicator (X mark) when snipped
    if (isDisabled) {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const xSize = radius * 0.5;
      ctx.beginPath();
      ctx.moveTo(drone.x - xSize, drone.y - xSize);
      ctx.lineTo(drone.x + xSize, drone.y + xSize);
      ctx.moveTo(drone.x + xSize, drone.y - xSize);
      ctx.lineTo(drone.x - xSize, drone.y + xSize);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  /**
   * Draw hitscan effect
   */
  drawHitscan(ctx, effect) {
    const alpha = effect.getAlpha();
    const color = effect.color;
    
    ctx.save();
    ctx.lineCap = 'round';
    
    // Outer glow (thicker, more transparent)
    ctx.lineWidth = 12 * alpha;
    ctx.strokeStyle = color.deriveAlpha(0.5 * alpha).rgbString();
    ctx.beginPath();
    ctx.moveTo(effect.fromX, effect.fromY);
    ctx.lineTo(effect.toX, effect.toY);
    ctx.stroke();
    
    // Core laser line (thinner, brighter)
    ctx.lineWidth = 5 * alpha;
    ctx.strokeStyle = color.lighter(0.4).deriveAlpha(0.95 * alpha).rgbString();
    ctx.beginPath();
    ctx.moveTo(effect.fromX, effect.fromY);
    ctx.lineTo(effect.toX, effect.toY);
    ctx.stroke();
    
    // Bright center
    ctx.lineWidth = 2 * alpha;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(effect.fromX, effect.fromY);
    ctx.lineTo(effect.toX, effect.toY);
    ctx.stroke();
    
    // Impact flash at target
    const flashSize = 20 * alpha;
    const gradient = ctx.createRadialGradient(effect.toX, effect.toY, 0, effect.toX, effect.toY, flashSize);
    gradient.addColorStop(0, color.lighter(0.6).deriveAlpha(alpha).rgbString());
    gradient.addColorStop(0.4, color.deriveAlpha(0.6 * alpha).rgbString());
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(effect.toX, effect.toY, flashSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  /**
   * Draw top UI bar
   */
  drawTopBar(ctx) {
    const player = this.players.get(this.playerId);
    if (!player) return;
    
    // Bar background - dark gray
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, this.canvas.width, BAR_HEIGHT);
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    
    // Get user stats
    const level = player.level || 1;
    const droneCount = player.drones ? player.drones.length : 1;
    
    // === TOP LEFT: Level, HP, Drones (horizontal) ===
    let xOffset = 15;
    const centerY = BAR_HEIGHT / 2 + 6;
    
    // RTT
    ctx.fillStyle = '#88CCFF';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('RTT:', xOffset, centerY);
    xOffset += ctx.measureText('RTT:').width + 5;
    ctx.fillStyle = 'white';
    ctx.fillText(`${Math.round(this.net.getRTT())}ms`, xOffset, centerY);
    xOffset += ctx.measureText(`${Math.round(this.net.getRTT())}ms`).width + 20;
    
    // Level
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Level:', xOffset, centerY);
    xOffset += ctx.measureText('Level:').width + 5;
    ctx.fillStyle = 'white';
    ctx.fillText(level, xOffset, centerY);
    xOffset += ctx.measureText(String(level)).width + 20;
    
    // HP
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('HP:', xOffset, centerY);
    xOffset += ctx.measureText('HP:').width + 5;
    ctx.fillStyle = 'white';
    ctx.fillText(`${Math.round(player.hp)}/${player.maxHp}`, xOffset, centerY);
    xOffset += ctx.measureText(`${Math.round(player.hp)}/${player.maxHp}`).width + 20;
    
    // XP
    ctx.fillStyle = '#9370DB';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('XP:', xOffset, centerY);
    xOffset += ctx.measureText('XP:').width + 5;
    ctx.fillStyle = 'white';
    ctx.fillText(player.xp, xOffset, centerY);
    xOffset += ctx.measureText(String(player.xp)).width + 20;
    
    // Territory %
    const territoryPercent = this.getTerritoryPercent(this.playerId);
    ctx.fillStyle = '#98FB98';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Territory:', xOffset, centerY);
    xOffset += ctx.measureText('Territory:').width + 5;
    ctx.fillStyle = 'white';
    ctx.fillText(`${territoryPercent.toFixed(2)}%`, xOffset, centerY);
  }
  
  /**
   * Draw leaderboard (ranked by territory %)
   */
  drawLeaderboard(ctx) {
    // Get leaderboard sorted by territory percentage
    const leaderboard = this.getLeaderboard().filter(e => !e.player.dead);
    const leaderboardNum = Math.min(consts.LEADERBOARD_NUM || 5, leaderboard.length);
    
    // Find max portion for bar scaling
    const maxPortion = leaderboard.length > 0 ? leaderboard[0].portion : 0;
    
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    
    for (let i = 0; i < leaderboardNum; i++) {
      const { player, portion } = leaderboard[i];
      const name = player.name || 'Unnamed';
      const color = player.base;
      const shadowColor = color.darker(0.3);
      
      // Calculate bar size (proportional to territory %)
      const barPortion = maxPortion > 0 ? portion / maxPortion : 0;
      const barSize = Math.ceil((LEADERBOARD_WIDTH - MIN_BAR_WIDTH) * barPortion + MIN_BAR_WIDTH);
      const barX = this.canvas.width - barSize;
      const barY = BAR_HEIGHT * (i + 1);
      const offsetY = i === 0 ? 10 : 0;
      
      // Shadow background
      ctx.fillStyle = 'rgba(10, 10, 10, 0.3)';
      ctx.fillRect(barX - 10, barY + 10 - offsetY, barSize + 10, BAR_HEIGHT + offsetY);
      
      // Main bar
      ctx.fillStyle = color.rgbString();
      ctx.fillRect(barX, barY, barSize, BAR_HEIGHT - SHADOW_OFFSET);
      
      // Shadow
      ctx.fillStyle = shadowColor.rgbString();
      ctx.fillRect(barX, barY + BAR_HEIGHT - SHADOW_OFFSET, barSize, SHADOW_OFFSET);
      
      // Name (to the left of bar)
      const nameWidth = ctx.measureText(name).width;
      ctx.fillStyle = 'black';
      ctx.fillText(name, barX - nameWidth - 15, barY + 27);
      
      // Territory % text on bar
      const isMe = player.num === this.playerId;
      const percentText = `${(portion * 100).toFixed(1)}%`;
      ctx.fillStyle = isMe ? '#FFD700' : 'white';
      ctx.fillText(percentText, barX + 5, barY + BAR_HEIGHT - 15);
    }
  }
  
  /**
   * Draw XP bar at bottom
   */
  drawXPBar(ctx) {
    const player = this.players.get(this.playerId);
    if (!player) return;
    
    const level = player.level || 1;
    const xp = player.xp || 0;
    const xpPerLevel = (consts.XP_BASE_PER_LEVEL || 50) + (level - 1) * (consts.XP_INCREMENT_PER_LEVEL || 25);
    
    // Bar dimensions
    const barWidth = 250;
    const barHeight = 28;
    const barX = (this.canvas.width - barWidth) / 2;
    const barY = this.canvas.height - 45;
    
    const progressRatio = Math.min(1, xp / xpPerLevel);
    const color = player.base;
    const shadowColor = color.darker(0.3);
    
    // Dark background
    ctx.fillStyle = 'rgba(10, 10, 10, 0.5)';
    ctx.fillRect(barX - 60, barY - 2, barWidth + 70, barHeight + 4);
    
    // Level text (left side)
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv.${level}`, barX - 55, barY + barHeight - 8);
    
    // XP bar track (gray background)
    ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
    ctx.fillRect(barX, barY, barWidth, barHeight - SHADOW_OFFSET);
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, barWidth, SHADOW_OFFSET);
    
    // XP bar fill
    if (progressRatio > 0) {
      const fillWidth = barWidth * progressRatio;
      ctx.fillStyle = color.rgbString();
      ctx.fillRect(barX, barY, fillWidth, barHeight - SHADOW_OFFSET);
      ctx.fillStyle = shadowColor.rgbString();
      ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, fillWidth, SHADOW_OFFSET);
    }
    
    // XP text on bar
    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(xp)}/${xpPerLevel} XP`, barX + barWidth / 2, barY + barHeight - 9);
  }
  
  /**
   * Get self player
   */
  getSelfPlayer() {
    return this.players.get(this.playerId);
  }
  
  /**
   * Resize canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

export { GameClient, InterpolatedEntity, Coin, HitscanEffect };
