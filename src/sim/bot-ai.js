/**
 * Bot AI System
 * 
 * Server-side bot behavior for paper.io style gameplay.
 * Bots claim territory by leaving trails and returning to their territory.
 * 
 * Design goals:
 * - Low CPU overhead (simple state machine)
 * - Runs at 4Hz (every 250ms) instead of 60Hz
 * - Natural-looking movement patterns
 * - Avoids walls, own trail, and enemy trails
 */

import { consts } from '../../config.js';

// Bot behavior states
const BotState = {
  WANDER_IN_TERRITORY: 0,  // Inside territory, wandering to find exit point
  CLAIMING_LAND: 1,        // Outside territory, creating trail
  RETURNING: 2,            // Heading back to territory to close trail
  AVOIDING: 3,             // Emergency avoidance (wall/trail)
};

// Map dimensions
const MAP_SIZE = consts.GRID_COUNT * consts.CELL_WIDTH;
const WALL_MARGIN = consts.CELL_WIDTH * 2;

/**
 * Bot AI controller
 * Manages AI state and decision-making for a single bot
 */
export class BotAI {
  constructor(playerId) {
    this.playerId = playerId;
    this.state = BotState.WANDER_IN_TERRITORY;
    
    // Movement
    this.targetAngle = Math.random() * Math.PI * 2;
    this.wanderAngle = this.targetAngle;
    
    // Trail tracking
    this.trailLength = 0;
    this.maxTrailLength = 40 + Math.random() * 60; // 40-100 trail points before returning
    
    // Timing
    this.stateTimer = 0;
    this.lastDecisionTime = 0;
    
    // Personality (varies per bot for diverse behavior)
    this.aggressiveness = Math.random(); // 0-1, affects trail length
    this.wanderSpeed = 0.1 + Math.random() * 0.2; // How fast angle changes
  }
  
  /**
   * Update bot AI and return new target angle
   * Called at bot tick rate (4Hz)
   * 
   * @param {Player} player - The bot's player entity
   * @param {World} world - Game world for collision checks
   * @returns {number} New target angle
   */
  update(player, world) {
    if (!player || player.dead) return this.targetAngle;
    
    const x = player.x;
    const y = player.y;
    
    // Check current state
    const inTerritory = this.isInTerritory(x, y, player.territory);
    const trailLength = player.trail ? player.trail.length : 0;
    
    // Priority 1: Avoid walls
    const wallAvoidAngle = this.getWallAvoidanceAngle(x, y);
    if (wallAvoidAngle !== null) {
      this.targetAngle = wallAvoidAngle;
      this.state = BotState.AVOIDING;
      return this.targetAngle;
    }
    
    // Priority 2: Avoid own trail (if outside territory)
    if (!inTerritory && player.trail && player.trail.length > 5) {
      const trailAvoidAngle = this.getTrailAvoidanceAngle(x, y, player.trail);
      if (trailAvoidAngle !== null) {
        this.targetAngle = trailAvoidAngle;
        return this.targetAngle;
      }
    }
    
    // Priority 3: Avoid enemy trails
    const enemyAvoidAngle = this.getEnemyTrailAvoidance(x, y, player, world);
    if (enemyAvoidAngle !== null) {
      this.targetAngle = enemyAvoidAngle;
      return this.targetAngle;
    }
    
    // State machine
    switch (this.state) {
      case BotState.WANDER_IN_TERRITORY:
        if (inTerritory) {
          // Wander around, eventually leaving territory
          this.wanderAngle += (Math.random() - 0.5) * this.wanderSpeed;
          this.targetAngle = this.wanderAngle;
          
          // Occasionally change direction significantly
          if (Math.random() < 0.05) {
            this.wanderAngle = Math.random() * Math.PI * 2;
          }
          
          this.trailLength = 0;
        } else {
          // Left territory, start claiming
          this.state = BotState.CLAIMING_LAND;
          this.trailLength = 0;
          this.maxTrailLength = 30 + Math.random() * 70 * (1 + this.aggressiveness);
        }
        break;
        
      case BotState.CLAIMING_LAND:
        this.trailLength = trailLength;
        
        if (inTerritory && trailLength > 3) {
          // Successfully returned with trail - reset
          this.state = BotState.WANDER_IN_TERRITORY;
          this.trailLength = 0;
        } else if (trailLength > this.maxTrailLength) {
          // Trail too long, head back
          this.state = BotState.RETURNING;
        } else {
          // Continue wandering outward
          this.wanderAngle += (Math.random() - 0.5) * this.wanderSpeed * 0.5;
          this.targetAngle = this.wanderAngle;
        }
        break;
        
      case BotState.RETURNING:
        if (inTerritory) {
          // Made it back
          this.state = BotState.WANDER_IN_TERRITORY;
          this.trailLength = 0;
        } else {
          // Navigate back to territory center
          const center = this.getTerritoryCenter(player.territory);
          this.targetAngle = Math.atan2(center.y - y, center.x - x);
        }
        break;
        
      case BotState.AVOIDING:
        // After avoiding, go back to appropriate state
        if (inTerritory) {
          this.state = BotState.WANDER_IN_TERRITORY;
        } else if (trailLength > this.maxTrailLength * 0.8) {
          this.state = BotState.RETURNING;
        } else {
          this.state = BotState.CLAIMING_LAND;
        }
        break;
    }
    
    return this.targetAngle;
  }
  
  /**
   * Check if point is inside territory polygon
   */
  isInTerritory(x, y, territory) {
    if (!territory || territory.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = territory.length - 1; i < territory.length; j = i++) {
      const xi = territory[i].x, yi = territory[i].y;
      const xj = territory[j].x, yj = territory[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  
  /**
   * Get territory center point
   */
  getTerritoryCenter(territory) {
    if (!territory || territory.length === 0) {
      return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
    }
    
    let cx = 0, cy = 0;
    for (const point of territory) {
      cx += point.x;
      cy += point.y;
    }
    return { x: cx / territory.length, y: cy / territory.length };
  }
  
  /**
   * Get angle to avoid walls, or null if not near wall
   */
  getWallAvoidanceAngle(x, y) {
    // Check each wall
    if (x < WALL_MARGIN) {
      return 0; // Go right
    }
    if (x > MAP_SIZE - WALL_MARGIN) {
      return Math.PI; // Go left
    }
    if (y < WALL_MARGIN) {
      return Math.PI / 2; // Go down
    }
    if (y > MAP_SIZE - WALL_MARGIN) {
      return -Math.PI / 2; // Go up
    }
    return null;
  }
  
  /**
   * Get angle to avoid own trail, or null if safe
   */
  getTrailAvoidanceAngle(x, y, trail) {
    const dangerDist = consts.CELL_WIDTH * 2;
    
    // Check trail points (skip recent ones)
    for (let i = 0; i < trail.length - 10; i++) {
      const point = trail[i];
      const dist = Math.hypot(point.x - x, point.y - y);
      
      if (dist < dangerDist) {
        // Turn away from trail point
        return Math.atan2(y - point.y, x - point.x);
      }
    }
    return null;
  }
  
  /**
   * Get angle to avoid enemy trails
   */
  getEnemyTrailAvoidance(x, y, self, world) {
    const dangerDist = consts.CELL_WIDTH * 3;
    
    for (const player of world.players.values()) {
      if (player.id === self.id || player.dead) continue;
      if (!player.trail || player.trail.length === 0) continue;
      
      for (const point of player.trail) {
        const dist = Math.hypot(point.x - x, point.y - y);
        
        if (dist < dangerDist) {
          // Turn away from enemy trail
          return Math.atan2(y - point.y, x - point.x);
        }
      }
    }
    return null;
  }
}

/**
 * Bot Manager
 * Manages all bots in a game room
 */
export class BotManager {
  constructor() {
    this.bots = new Map(); // playerId -> BotAI
    this.lastTickTime = 0;
    this.tickInterval = 250; // 4Hz bot updates
  }
  
  /**
   * Add a bot for a player
   */
  addBot(playerId) {
    const bot = new BotAI(playerId);
    this.bots.set(playerId, bot);
    return bot;
  }
  
  /**
   * Remove a bot
   */
  removeBot(playerId) {
    this.bots.delete(playerId);
  }
  
  /**
   * Check if player is a bot
   */
  isBot(playerId) {
    return this.bots.has(playerId);
  }
  
  /**
   * Update all bots (called from game loop)
   * Returns true if bots were updated this tick
   */
  update(world, now) {
    // Only update at bot tick rate (4Hz)
    if (now - this.lastTickTime < this.tickInterval) {
      return false;
    }
    this.lastTickTime = now;
    
    // Update each bot
    for (const [playerId, bot] of this.bots) {
      const player = world.players.get(playerId);
      if (!player || player.dead) {
        // Bot died, respawn after delay
        this.handleBotDeath(playerId, world);
        continue;
      }
      
      // Get new target angle from AI
      const newAngle = bot.update(player, world);
      
      // Apply to player (simulates input)
      world.handleInput(playerId, newAngle);
    }
    
    return true;
  }
  
  /**
   * Handle bot death - respawn after delay
   */
  handleBotDeath(playerId, world) {
    // Remove dead bot
    this.bots.delete(playerId);
    
    // Schedule respawn (handled by room.js)
    // We just clean up here
  }
  
  /**
   * Get bot count
   */
  get count() {
    return this.bots.size;
  }
}




