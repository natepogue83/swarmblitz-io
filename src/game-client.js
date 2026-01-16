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
    if (data.territory) this.territory = data.territory;
    if (data.trail) this.trail = data.trail;
    
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
   * Extrapolates movement based on angle, with correction towards server position
   */
  interpolateOther(deltaMs, speed) {
    // Smoothly interpolate angle towards server angle
    let angleDiff = this.serverAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Fast angle lerp (50% per frame at 60fps)
    const angleLerp = Math.min(1, 0.5 * (deltaMs / 16.67));
    this.angle += angleDiff * angleLerp;
    
    // Normalize angle
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;
    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
    
    // Always move forward in the direction we're facing (extrapolation)
    const moveAmount = speed * (deltaMs / 1000) * 60;
    this.x += Math.cos(this.angle) * moveAmount;
    this.y += Math.sin(this.angle) * moveAmount;
    
    // Correct towards server position to prevent drift
    const errorX = this.serverX - this.x;
    const errorY = this.serverY - this.y;
    const errorDist = Math.sqrt(errorX * errorX + errorY * errorY);
    
    if (errorDist > 150) {
      // Too far off (teleport/respawn), snap immediately
      this.x = this.serverX;
      this.y = this.serverY;
    } else {
      // Correction: 15% base + more for larger errors
      // This keeps us close to server position without stopping
      const correctionRate = Math.min(0.5, 0.15 + errorDist * 0.005);
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
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    
    // Setup input handlers
    this.setupInput();
  }
  
  /**
   * Setup input handlers
   */
  setupInput() {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchstart', this.handleTouchMove, { passive: false });
    
    // Debug toggle (press D)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.debugMode = !this.debugMode;
        console.log('Debug mode:', this.debugMode ? 'ON' : 'OFF');
      }
    });
  }
  
  /**
   * Handle mouse move
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
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
    
    // Send to server
    this.net.sendInput(this.targetAngle);
  }
  
  /**
   * Connect to server
   */
  connect(playerName) {
    this.net.connect(playerName);
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    this.net.disconnect();
    this.stopGameLoop();
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
    
    // Center camera on player (instant snap on join, then smooth follow)
    const player = this.players.get(this.playerId);
    if (player) {
      this.cameraX = player.x;
      this.cameraY = player.y;
      this.cameraTargetX = player.x;
      this.cameraTargetY = player.y;
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
    
    // Remove players
    for (const id of data.removedPlayerIds) {
      this.players.delete(id);
    }
    
    // Update coins (replace with visible set)
    this.coins.clear();
    for (const c of data.coins) {
      this.coins.set(c.id, new Coin(c));
    }
    
    // Process events
    for (const event of data.events) {
      this.handleEvent(event);
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
        
      case EventType.PLAYER_KILL:
        if (event.victimNum === this.playerId) {
          this.onDeath(event);
        } else if (event.killerNum === this.playerId) {
          this.onKill(event);
        }
        break;
        
      case EventType.LEVEL_UP:
        if (event.playerNum === this.playerId) {
          this.onLevelUp(event);
        }
        break;
        
      case EventType.PLAYER_JOIN:
        if (event.player && !this.players.has(event.player.num)) {
          this.players.set(event.player.num, new InterpolatedEntity(event.player));
        }
        break;
        
      case EventType.PLAYER_LEAVE:
        this.players.delete(event.num);
        break;
        
      case EventType.COIN_SPAWN:
        this.coins.set(event.id, new Coin(event));
        break;
        
      case EventType.COIN_PICKUP:
        this.coins.delete(event.id);
        break;
        
      case 'dead':
        this.onDeath(event);
        break;
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
    
    for (const [id, player] of this.players) {
      if (id === this.playerId && localPlayer && !localPlayer.dead) {
        // Local player: use client-side prediction
        player.predict(deltaMs, consts.SPEED, this.mapSize, this.targetAngle);
      } else {
        // Other players: extrapolate movement + gentle correction
        player.interpolateOther(deltaMs, consts.SPEED);
      }
    }
    
    // Camera smoothly follows local player
    // This prevents jarring camera movement when server corrections happen
    if (localPlayer) {
      this.cameraTargetX = localPlayer.x;
      this.cameraTargetY = localPlayer.y;
      
      // Smooth camera movement - lerp towards target
      // Higher value = more responsive, lower = smoother
      // At 60fps, 0.15 means camera reaches ~90% of target in ~15 frames (~250ms)
      const cameraLerp = 0.15;
      this.cameraX += (this.cameraTargetX - this.cameraX) * cameraLerp;
      this.cameraY += (this.cameraTargetY - this.cameraY) * cameraLerp;
    }
    
    // Clean up expired effects
    this.effects = this.effects.filter(e => !e.isExpired());
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
    
    // Apply camera transform
    ctx.translate(width / 2, gameHeight / 2);
    ctx.scale(this.cameraScale, this.cameraScale);
    ctx.translate(-this.cameraX, -this.cameraY);
    
    // Draw grid background
    this.drawGrid(ctx);
    
    // Draw territories (sorted by num for consistent z-ordering)
    const sortedPlayers = Array.from(this.players.values()).sort((a, b) => a.num - b.num);
    for (const player of sortedPlayers) {
      this.drawTerritory(ctx, player);
    }
    
    // Draw coins
    for (const coin of this.coins.values()) {
      this.drawCoin(ctx, coin);
    }
    
    // Draw trails
    for (const player of sortedPlayers) {
      this.drawTrail(ctx, player);
    }
    
    // Draw players
    for (const player of sortedPlayers) {
      if (!player.dead) {
        this.drawPlayer(ctx, player);
      }
    }
    
    // Draw effects
    for (const effect of this.effects) {
      this.drawHitscan(ctx, effect);
    }
    
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
    
    // Territory outline
    ctx.strokeStyle = color.deriveAlpha(0.9 * snipAlpha).rgbString();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  
  /**
   * Draw player trail
   */
  drawTrail(ctx, player) {
    if (!player.trail || player.trail.length < 2) return;
    
    const color = player.base;
    const tailColor = color.lighter(0.2);
    
    ctx.strokeStyle = tailColor.rgbString();
    ctx.lineWidth = PLAYER_RADIUS;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(player.trail[0].x, player.trail[0].y);
    for (let i = 1; i < player.trail.length; i++) {
      ctx.lineTo(player.trail[i].x, player.trail[i].y);
    }
    // Connect to player
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
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
  }
  
  /**
   * Draw leaderboard
   */
  drawLeaderboard(ctx) {
    // Sort players by level then XP
    const sorted = Array.from(this.players.values())
      .filter(p => !p.dead)
      .sort((a, b) => b.level - a.level || b.xp - a.xp);
    
    const leaderboardNum = Math.min(consts.LEADERBOARD_NUM || 5, sorted.length);
    
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    
    for (let i = 0; i < leaderboardNum; i++) {
      const player = sorted[i];
      const name = player.name || 'Unnamed';
      const color = player.base;
      const shadowColor = color.darker(0.3);
      
      // Calculate bar size (proportional to rank)
      const portion = 1 - (i / leaderboardNum);
      const barSize = Math.ceil((LEADERBOARD_WIDTH - MIN_BAR_WIDTH) * portion + MIN_BAR_WIDTH);
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
      
      // Level text on bar
      const isMe = player.num === this.playerId;
      ctx.fillStyle = isMe ? '#FFD700' : 'white';
      ctx.fillText(`Lv.${player.level}`, barX + 5, barY + BAR_HEIGHT - 15);
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
