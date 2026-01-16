/**
 * Room Durable Object
 * 
 * Manages a single game room with:
 * - Authoritative simulation
 * - AOI-based delta broadcasting
 * - Binary protocol
 * - Batched network frames
 * - Server-side bots
 */

import World from '../src/sim/world.js';
import { BinaryWriter } from '../src/net/codec.js';
import { 
  PacketType, 
  EventType, 
  Quant,
  quantizePosition,
  quantizeAngle,
  quantizeHP,
  encodeColor,
  DeltaFlags,
} from '../src/net/protocol.js';
import { BotManager } from '../src/sim/bot-ai.js';
import { config, consts } from '../config.js';

// Network tick rate (Hz) - decoupled from simulation
// 10Hz = 100ms between updates, client interpolates for smoothness
const NETWORK_TICK_RATE = 10;
const NETWORK_TICK_MS = 1000 / NETWORK_TICK_RATE;

// Simulation tick rate (Hz) - runs faster for smooth physics
const SIM_TICK_RATE = 60;
const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

// In-memory tick loop interval (ms)
// Using setTimeout self-scheduling loop instead of setInterval to prevent tick stacking
const TICK_LOOP_MS = 16; // ~60Hz target

// Empty room cleanup timeout (ms) - time to wait before clearing large in-memory state
// This allows for quick reconnects without losing world state
const EMPTY_ROOM_CLEANUP_MS = 60000; // 60 seconds

// Bot configuration
const BOT_COUNT = config.bots || 10;
const BOT_RESPAWN_DELAY = 3000; // 3 seconds before respawning dead bot

// AOI radius for visibility
const AOI_RADIUS = 800;

// Metrics logging interval (1 minute)
const METRICS_LOG_INTERVAL_MS = 60000;

/**
 * Metrics Logger for production monitoring
 * Logs JSON lines once per minute with comprehensive stats
 */
class MetricsLogger {
  constructor(roomId) {
    this.roomId = roomId;
    this.startTime = Date.now();
    this.lastLogTime = Date.now();
    
    // Per-minute counters (reset each log)
    this.inboundWsMessages = 0;
    this.outboundWsMessages = 0;
    this.inboundBytes = 0;
    this.outboundBytes = 0;
    this.doRequests = 0;
    
    // Tick timing stats
    this.tickTimes = []; // Array of tick CPU times in ms
    this.simTickCount = 0;
    this.netTickCount = 0;
    
    // Message type byte tracking
    this.messageTypeSizes = {
      FRAME: { count: 0, totalBytes: 0 },
      INPUT: { count: 0, totalBytes: 0 },
      PING: { count: 0, totalBytes: 0 },
      PONG: { count: 0, totalBytes: 0 },
      HELLO: { count: 0, totalBytes: 0 },
      INIT: { count: 0, totalBytes: 0 },
      OTHER: { count: 0, totalBytes: 0 },
    };
  }
  
  // Track inbound message
  trackInbound(type, bytes) {
    this.inboundWsMessages++;
    this.inboundBytes += bytes;
    const category = this.messageTypeSizes[type] || this.messageTypeSizes.OTHER;
    category.count++;
    category.totalBytes += bytes;
  }
  
  // Track outbound message
  trackOutbound(type, bytes) {
    this.outboundWsMessages++;
    this.outboundBytes += bytes;
    const category = this.messageTypeSizes[type] || this.messageTypeSizes.OTHER;
    category.count++;
    category.totalBytes += bytes;
  }
  
  // Track tick CPU time
  trackTick(cpuTimeMs, isSim, isNet) {
    this.tickTimes.push(cpuTimeMs);
    if (isSim) this.simTickCount++;
    if (isNet) this.netTickCount++;
  }
  
  // Track DO request
  trackDoRequest() {
    this.doRequests++;
  }
  
  // Calculate percentile from sorted array
  percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.ceil(p * sortedArr.length) - 1;
    return sortedArr[Math.max(0, idx)];
  }
  
  // Generate and log metrics (returns true if logged)
  maybeLog(activeConnections, activePlayers, botCount) {
    const now = Date.now();
    const elapsed = now - this.lastLogTime;
    
    if (elapsed < METRICS_LOG_INTERVAL_MS) {
      return false;
    }
    
    const elapsedSec = elapsed / 1000;
    const elapsedMin = elapsed / 60000;
    const uptimeSec = (now - this.startTime) / 1000;
    
    // Calculate tick stats
    const sortedTicks = [...this.tickTimes].sort((a, b) => a - b);
    const avgTickMs = sortedTicks.length > 0 
      ? sortedTicks.reduce((a, b) => a + b, 0) / sortedTicks.length 
      : 0;
    const p95TickMs = this.percentile(sortedTicks, 0.95);
    const maxTickMs = sortedTicks.length > 0 ? sortedTicks[sortedTicks.length - 1] : 0;
    
    // Calculate actual tick rates
    const actualSimTickRate = this.simTickCount / elapsedSec;
    const actualNetTickRate = this.netTickCount / elapsedSec;
    
    // Calculate per-hour metrics for different denominators
    // - Per human player (for ad revenue math)
    // - Per connection (for actual bandwidth cost)
    // - Per entity (players + bots, for game scaling analysis)
    const humanHours = (activePlayers * elapsedSec) / 3600;
    const connectionHours = (activeConnections * elapsedSec) / 3600;
    const entityCount = activePlayers + botCount;
    const entityHours = (entityCount * elapsedSec) / 3600;
    
    // Calculate average packet sizes
    const packetSizes = {};
    for (const [type, stats] of Object.entries(this.messageTypeSizes)) {
      if (stats.count > 0) {
        packetSizes[type] = {
          avgBytes: Math.round(stats.totalBytes / stats.count),
          count: stats.count,
        };
      }
    }
    
    // Build metrics object
    const metrics = {
      ts: new Date().toISOString(),
      roomId: this.roomId,
      uptimeSec: Math.round(uptimeSec),
      
      // Tick rates
      targetSimHz: SIM_TICK_RATE,
      targetNetHz: NETWORK_TICK_RATE,
      actualSimHz: Math.round(actualSimTickRate * 10) / 10,
      actualNetHz: Math.round(actualNetTickRate * 10) / 10,
      
      // Tick CPU time (ms)
      avgTickMs: Math.round(avgTickMs * 100) / 100,
      p95TickMs: Math.round(p95TickMs * 100) / 100,
      maxTickMs: Math.round(maxTickMs * 100) / 100,
      tickSamples: sortedTicks.length,
      
      // Connections
      connections: activeConnections,
      players: activePlayers,
      bots: botCount,
      
      // Per-minute message counts
      wsInPerMin: Math.round(this.inboundWsMessages / elapsedMin),
      wsOutPerMin: Math.round(this.outboundWsMessages / elapsedMin),
      doReqPerMin: Math.round(this.doRequests / elapsedMin),
      
      // Bandwidth (bytes per minute)
      bytesInPerMin: Math.round(this.inboundBytes / elapsedMin),
      bytesOutPerMin: Math.round(this.outboundBytes / elapsedMin),
      
      // Per-hour bandwidth metrics (different denominators for different use cases)
      // Per human player (for ad revenue / monetization math)
      bytesInPerHumanHour: humanHours > 0 ? Math.round(this.inboundBytes / humanHours) : 0,
      bytesOutPerHumanHour: humanHours > 0 ? Math.round(this.outboundBytes / humanHours) : 0,
      // Per WebSocket connection (actual bandwidth cost per connected client)
      bytesInPerConnHour: connectionHours > 0 ? Math.round(this.inboundBytes / connectionHours) : 0,
      bytesOutPerConnHour: connectionHours > 0 ? Math.round(this.outboundBytes / connectionHours) : 0,
      // Per game entity (players + bots, for scaling analysis)
      bytesOutPerEntityHour: entityHours > 0 ? Math.round(this.outboundBytes / entityHours) : 0,
      
      // Packet size estimates
      packetSizes,
    };
    
    // Log as single JSON line
    console.log('[METRICS]', JSON.stringify(metrics));
    
    // Reset counters
    this.lastLogTime = now;
    this.inboundWsMessages = 0;
    this.outboundWsMessages = 0;
    this.inboundBytes = 0;
    this.outboundBytes = 0;
    this.doRequests = 0;
    this.tickTimes = [];
    this.simTickCount = 0;
    this.netTickCount = 0;
    
    // Reset message type tracking
    for (const stats of Object.values(this.messageTypeSizes)) {
      stats.count = 0;
      stats.totalBytes = 0;
    }
    
    return true;
  }
}

/**
 * Client connection state
 */
class Client {
  constructor(ws, playerId, isSpectator = false) {
    this.ws = ws;
    this.playerId = playerId;
    this.isSpectator = isSpectator;
    this.lastSeenEntities = new Set();
    this.lastSentFrame = 0;
    this.lastPing = Date.now();
    this.rtt = 0;
  }
}

/**
 * Room Durable Object
 */
export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // Game state
    this.world = new World();
    this.clients = new Map(); // ws -> Client
    this.playerToClient = new Map(); // playerId -> Client
    
    // Bot management
    this.botManager = new BotManager();
    this.pendingBotRespawns = []; // { respawnTime, name }
    this.botsInitialized = false;
    
    // Timing
    this.lastSimTick = Date.now();
    this.lastNetTick = Date.now();
    this.simAccumulator = 0;
    
    // In-memory tick loop state (replaces alarm-based loop for cost efficiency)
    // Using setTimeout self-scheduling instead of setInterval to prevent tick stacking
    this.tickTimer = null;        // setTimeout handle for tick loop
    this.cleanupTimer = null;     // setTimeout handle for empty room cleanup
    this.running = false;         // Guard to prevent multiple tick loops
    this.pendingConnections = 0;  // WebSocket connections awaiting hello handshake
    
    // Metrics logging (enabled via METRICS_ENABLED env var or always in dev)
    this.metricsEnabled = env.METRICS_ENABLED === 'true' || env.METRICS_ENABLED === '1';
    this.metrics = this.metricsEnabled ? new MetricsLogger(state.id.toString()) : null;
  }
  
  /**
   * Handle WebSocket connection
   */
  async fetch(request) {
    const url = new URL(request.url);
    
    // Track DO fetch invocation for metrics (this is a real DO request)
    if (this.metrics) {
      this.metrics.trackDoRequest();
    }
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Accept and configure
      server.accept();
      
      // Handle messages
      server.addEventListener('message', (event) => {
        this.handleMessage(server, event.data);
      });
      
      server.addEventListener('close', () => {
        this.handleDisconnect(server);
      });
      
      server.addEventListener('error', (err) => {
        console.error('WebSocket error:', err);
        this.handleDisconnect(server);
      });
      
      // Track pending connection (will be decremented when hello is received or on disconnect)
      this.pendingConnections++;
      
      // Cancel any pending cleanup - a new connection arrived
      // This is race-safe: if cleanup was about to run, we cancel it
      this.cancelCleanup();
      
      // Start in-memory tick loop if not already running
      this.startTickLoop();
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // Status endpoint
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        players: this.world.players.size,
        bots: this.botManager.count,
        humans: this.clients.size,
        coins: this.world.coins.size,
        frame: this.world.frame,
        running: this.running,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  /**
   * Start the in-memory tick loop
   * Uses setTimeout self-scheduling to prevent tick stacking
   * Only starts if not already running (guard against multiple loops)
   */
  startTickLoop() {
    // Guard: prevent multiple tick loops (race-safe)
    if (this.running) {
      return;
    }
    
    this.running = true;
    this.lastSimTick = Date.now();
    this.lastNetTick = Date.now();
    this.simAccumulator = 0;
    
    console.log('[ROOM] Starting in-memory tick loop');
    
    // Schedule first tick
    this.scheduleNextTick();
  }
  
  /**
   * Stop the in-memory tick loop immediately
   * Clears the timer and resets running state
   * Does NOT clear world state - that's handled by scheduleCleanup()
   */
  stopTickLoop() {
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    this.running = false;
    console.log('[ROOM] Stopped tick loop');
  }
  
  /**
   * Schedule cleanup of large in-memory state after empty room timeout
   * This allows quick reconnects to preserve world state
   * Race-safe: checks connections==0 before actually cleaning up
   */
  scheduleCleanup() {
    // Don't schedule if already scheduled
    if (this.cleanupTimer) {
      return;
    }
    
    console.log(`[ROOM] Scheduling cleanup in ${EMPTY_ROOM_CLEANUP_MS / 1000}s`);
    
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      
      // Race-safe: double-check no connections (including pending) before cleanup
      if (this.clients.size > 0 || this.pendingConnections > 0) {
        console.log('[ROOM] Cleanup cancelled - connections exist');
        return;
      }
      
      // Double-check tick loop is stopped
      if (this.running) {
        console.log('[ROOM] Cleanup cancelled - tick loop still running');
        return;
      }
      
      console.log('[ROOM] Cleaning up empty room state');
      
      // Clear large in-memory state
      this.world = new World();
      this.botManager = new BotManager();
      this.pendingBotRespawns = [];
      this.botsInitialized = false;
      
      // Reset timing state
      this.lastSimTick = Date.now();
      this.lastNetTick = Date.now();
      this.simAccumulator = 0;
      
      // Clear player mappings (should already be empty)
      this.playerToClient.clear();
      
      console.log('[ROOM] Empty room cleanup complete - DO now idle');
    }, EMPTY_ROOM_CLEANUP_MS);
  }
  
  /**
   * Cancel any pending cleanup (called when new connection arrives)
   */
  cancelCleanup() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[ROOM] Cancelled pending cleanup');
    }
  }
  
  /**
   * Schedule the next tick using setTimeout (self-scheduling pattern)
   * This prevents tick stacking if a tick runs long
   */
  scheduleNextTick() {
    if (!this.running) return;
    
    this.tickTimer = setTimeout(() => {
      this.tick();
    }, TICK_LOOP_MS);
  }
  
  /**
   * Main game tick - runs simulation and network updates
   * Called from in-memory setTimeout loop (NOT from alarm)
   */
  tick() {
    if (!this.running) return;
    
    const tickStart = performance.now();
    const now = Date.now();
    
    // Initialize bots on first tick (after world is ready)
    if (!this.botsInitialized) {
      this.initializeBots();
      this.botsInitialized = true;
    }
    
    // Handle bot respawns
    this.processBotRespawns(now);
    
    // Update bot AI (runs at 4Hz internally)
    this.botManager.update(this.world, now);
    
    // Check for dead bots and schedule respawns
    this.checkDeadBots(now);
    
    // Simulation tick
    const simDelta = now - this.lastSimTick;
    this.lastSimTick = now;
    this.simAccumulator += simDelta;
    
    // Run simulation at fixed timestep
    let simCount = 0;
    const maxSimTicks = 10;
    while (this.simAccumulator >= SIM_TICK_MS && simCount < maxSimTicks) {
      this.world.tick(SIM_TICK_MS / 1000);
      this.simAccumulator -= SIM_TICK_MS;
      simCount++;
    }
    
    // If we're still behind after max ticks, drop the excess time
    if (this.simAccumulator > SIM_TICK_MS * 2) {
      this.simAccumulator = 0;
    }
    
    // Network tick (lower rate)
    let didNetTick = false;
    const netDelta = now - this.lastNetTick;
    if (netDelta >= NETWORK_TICK_MS) {
      this.lastNetTick = now;
      this.broadcastFrame();
      didNetTick = true;
    }
    
    // Track tick timing for metrics
    if (this.metrics) {
      const tickEnd = performance.now();
      const tickCpuMs = tickEnd - tickStart;
      this.metrics.trackTick(tickCpuMs, simCount > 0, didNetTick);
      
      // Log metrics once per minute
      const humanPlayers = Array.from(this.clients.values()).filter(c => !c.isSpectator).length;
      this.metrics.maybeLog(this.clients.size, humanPlayers, this.botManager.count);
    }
    
    // Continue running if there are active connections OR pending connections (awaiting hello)
    const hasActiveConnections = this.clients.size > 0 || this.pendingConnections > 0;
    
    if (hasActiveConnections) {
      this.scheduleNextTick();
    } else {
      // No connections - immediately stop tick loop (DO becomes idle)
      // Don't clear state yet - schedule cleanup after timeout
      console.log('[ROOM] No active connections, stopping tick loop immediately');
      this.stopTickLoop();
      this.scheduleCleanup();
    }
  }
  
  /**
   * Alarm handler - used only for low-frequency housekeeping
   * NOT used for game tick loop (that's now in-memory setTimeout)
   */
  async alarm() {
    // Track DO alarm invocation for metrics
    if (this.metrics) {
      this.metrics.trackDoRequest();
    }
    
    // Housekeeping tasks could go here (e.g., periodic state persistence)
    // Currently not used since we use in-memory tick loop
    console.log('[ROOM] Alarm fired (housekeeping)');
  }
  
  /**
   * Initialize bots at game start
   */
  initializeBots() {
    const prefixes = consts.PREFIXES.split(' ');
    const names = consts.NAMES.split(' ');
    
    for (let i = 0; i < BOT_COUNT; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const name = names[Math.floor(Math.random() * names.length)];
      const botName = `[BOT] ${prefix} ${name}`;
      
      this.spawnBot(botName);
    }
    
    console.log(`Initialized ${BOT_COUNT} bots`);
  }
  
  /**
   * Spawn a single bot
   */
  spawnBot(name) {
    const result = this.world.addPlayer(name);
    if (result.ok) {
      const player = result.player;
      player.hasReceivedInput = true; // Bots start moving immediately
      player.waitLag = consts.NEW_PLAYER_LAG; // Skip spawn protection
      this.botManager.addBot(player.id);
      return player.id;
    }
    return null;
  }
  
  /**
   * Check for dead bots and schedule respawns
   */
  checkDeadBots(now) {
    // Collect dead bots first (can't modify map while iterating)
    const deadBots = [];
    
    for (const [playerId, bot] of this.botManager.bots) {
      const player = this.world.players.get(playerId);
      if (!player || player.dead) {
        deadBots.push({
          playerId,
          name: player ? player.name : this.generateBotName(),
        });
      }
    }
    
    // Process dead bots
    for (const { playerId, name } of deadBots) {
      // Remove from bot manager
      this.botManager.removeBot(playerId);
      
      // Remove from world if still there
      const player = this.world.players.get(playerId);
      if (player) {
        this.world.removePlayer(playerId);
      }
      
      // Schedule respawn
      this.pendingBotRespawns.push({
        respawnTime: now + BOT_RESPAWN_DELAY,
        name: name,
      });
    }
  }
  
  /**
   * Process pending bot respawns
   */
  processBotRespawns(now) {
    const stillPending = [];
    
    for (const respawn of this.pendingBotRespawns) {
      if (now >= respawn.respawnTime) {
        this.spawnBot(respawn.name);
      } else {
        stillPending.push(respawn);
      }
    }
    
    this.pendingBotRespawns = stillPending;
  }
  
  /**
   * Generate a random bot name
   */
  generateBotName() {
    const prefixes = consts.PREFIXES.split(' ');
    const names = consts.NAMES.split(' ');
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    return `[BOT] ${prefix} ${name}`;
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(ws, data) {
    try {
      // Binary message
      if (data instanceof ArrayBuffer) {
        // Track metrics
        if (this.metrics) {
          const view = new DataView(data);
          const type = view.getUint8(0);
          const typeName = type === PacketType.INPUT ? 'INPUT' : type === PacketType.PING ? 'PING' : 'OTHER';
          this.metrics.trackInbound(typeName, data.byteLength);
        }
        this.handleBinaryMessage(ws, data);
        return;
      }
      
      // Text message (for initial handshake)
      const msg = JSON.parse(data);
      const bytes = typeof data === 'string' ? data.length : 0;
      
      // Track metrics
      if (this.metrics) {
        const typeName = msg.type === 'hello' ? 'HELLO' : msg.type === 'ping' ? 'PING' : 'OTHER';
        this.metrics.trackInbound(typeName, bytes);
      }
      
      switch (msg.type) {
        case 'hello':
          this.handleHello(ws, msg);
          break;
          
        case 'ping':
          this.handlePing(ws, msg);
          break;
          
        case 'reset':
          this.handleReset(ws);
          break;
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  }
  
  /**
   * Handle binary message
   */
  handleBinaryMessage(ws, data) {
    const view = new DataView(data);
    const type = view.getUint8(0);
    
    switch (type) {
      case PacketType.INPUT:
        this.handleInput(ws, view);
        break;
        
      case PacketType.PING:
        this.handleBinaryPing(ws, view);
        break;
    }
  }
  
  /**
   * Handle hello (join game or spectate)
   */
  handleHello(ws, msg) {
    // Decrement pending connections - handshake is completing
    if (this.pendingConnections > 0) {
      this.pendingConnections--;
    }
    
    // Check if spectator
    if (msg.spectate) {
      this.handleSpectateHello(ws);
      return;
    }
    
    const name = (msg.name || 'Player').slice(0, 16);
    
    // Add player to world
    const result = this.world.addPlayer(name);
    
    if (!result.ok) {
      this.trackedSend(ws, JSON.stringify({ type: 'error', error: result.error }), 'OTHER');
      ws.close();
      return;
    }
    
    const player = result.player;
    
    // Create client
    const client = new Client(ws, player.id);
    this.clients.set(ws, client);
    this.playerToClient.set(player.id, client);
    
    // Send hello ack with player info
    const initData = {
      type: 'init',
      playerId: player.id,
      mapSize: this.world.mapSize,
      player: player.serialize(),
      players: this.world.getAllPlayers().map(p => p.serialize()),
      coins: this.world.getAllCoins().map(c => ({ id: c.id, x: c.x, y: c.y, value: c.value })),
    };
    
    this.trackedSend(ws, JSON.stringify(initData), 'INIT');
    
    // Broadcast join to others
    this.broadcastEvent({
      type: EventType.PLAYER_JOIN,
      player: player.serialize(),
    }, player.id);
  }
  
  /**
   * Handle spectator hello (join as spectator, no player)
   */
  handleSpectateHello(ws) {
    // Create spectator client (no player ID)
    const client = new Client(ws, null, true);
    this.clients.set(ws, client);
    
    // Send init with all players/coins but no playerId
    const initData = {
      type: 'init',
      playerId: null, // Spectator has no player
      mapSize: this.world.mapSize,
      player: null,
      players: this.world.getAllPlayers().map(p => p.serialize()),
      coins: this.world.getAllCoins().map(c => ({ id: c.id, x: c.x, y: c.y, value: c.value })),
    };
    
    this.trackedSend(ws, JSON.stringify(initData), 'INIT');
    console.log('[ROOM] Spectator joined');
  }
  
  /**
   * Handle input packet
   */
  handleInput(ws, view) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    // Decode input: [1 byte type][2 bytes angle (quantized)]
    const quantizedAngle = view.getUint16(1, true);
    const angle = (quantizedAngle / Quant.ANGLE_SCALE) * Math.PI * 2 - Math.PI;
    
    this.world.handleInput(client.playerId, angle);
  }
  
  /**
   * Send data with metrics tracking
   */
  trackedSend(ws, data, type = 'OTHER') {
    const bytes = data instanceof ArrayBuffer ? data.byteLength : 
                  typeof data === 'string' ? data.length : 0;
    if (this.metrics) {
      this.metrics.trackOutbound(type, bytes);
    }
    ws.send(data);
  }
  
  /**
   * Handle ping
   */
  handlePing(ws, msg) {
    const response = JSON.stringify({ type: 'pong', t: msg.t });
    this.trackedSend(ws, response, 'PONG');
  }
  
  /**
   * Handle binary ping
   */
  handleBinaryPing(ws, view) {
    const timestamp = view.getFloat64(1, true);
    
    // Send pong
    const buffer = new ArrayBuffer(9);
    const pongView = new DataView(buffer);
    pongView.setUint8(0, PacketType.PONG);
    pongView.setFloat64(1, timestamp, true);
    
    this.trackedSend(ws, buffer, 'PONG');
  }
  
  /**
   * Handle reset command (debug) - resets the entire room
   */
  handleReset(ws) {
    console.log('[DEBUG] Room reset requested');
    
    // Stop the tick loop and cancel any pending cleanup
    this.stopTickLoop();
    this.cancelCleanup();
    
    // Create fresh world
    this.world = new World();
    
    // Reset bot manager
    this.botManager = new BotManager();
    this.pendingBotRespawns = [];
    this.botsInitialized = false;
    
    // Reset timing
    this.lastSimTick = Date.now();
    this.lastNetTick = Date.now();
    this.simAccumulator = 0;
    
    // Notify all clients to reconnect
    for (const [clientWs, client] of this.clients) {
      try {
        this.trackedSend(clientWs, JSON.stringify({ type: 'reset' }), 'OTHER');
        clientWs.close(1000, 'Room reset');
      } catch (e) {
        // Ignore errors on close
      }
    }
    
    // Clear all clients
    this.clients.clear();
    this.playerToClient.clear();
    
    console.log('[DEBUG] Room reset complete');
  }
  
  /**
   * Handle disconnect
   */
  handleDisconnect(ws) {
    const client = this.clients.get(ws);
    
    // If client wasn't registered yet (disconnected before hello), decrement pending
    if (!client) {
      if (this.pendingConnections > 0) {
        this.pendingConnections--;
        console.log('[ROOM] Pending connection disconnected before hello');
      }
      return;
    }
    
    // Spectators don't have a player
    if (client.isSpectator) {
      this.clients.delete(ws);
      console.log('[ROOM] Spectator disconnected');
      // Note: tick loop handles stopping when hasActiveConnections() === false
      return;
    }
    
    // Remove from world
    this.world.removePlayer(client.playerId);
    
    // Clean up
    this.playerToClient.delete(client.playerId);
    this.clients.delete(ws);
    
    console.log(`[ROOM] Player disconnected, ${this.clients.size} connections remaining`);
    
    // Note: tick loop handles stopping when hasActiveConnections() === false
    // Cleanup is scheduled by the tick loop, not here
    
    // Broadcast leave to remaining clients
    this.broadcastEvent({
      type: EventType.PLAYER_LEAVE,
      num: client.playerId,
    });
  }
  
  /**
   * Broadcast frame to all clients
   */
  broadcastFrame() {
    const frame = this.world.frame;
    const events = this.world.pendingEvents;
    
    // Clear events after capturing them (they'll be sent to all clients)
    this.world.pendingEvents = [];
    
    for (const [ws, client] of this.clients) {
      try {
        // Spectators see everything
        if (client.isSpectator) {
          const allPlayers = this.world.getAllPlayers();
          const allCoins = this.world.getAllCoins();
          const packet = this.buildSpectatorFramePacket(client, allPlayers, allCoins, events, frame);
          
          if (packet.byteLength > 1) {
            this.trackedSend(ws, packet, 'FRAME');
          }
          client.lastSentFrame = frame;
          continue;
        }
        
        const player = this.world.getPlayer(client.playerId);
        if (!player) continue;
        
        // Get entities in AOI
        const nearbyPlayers = this.world.getPlayersInAOI(player.x, player.y, AOI_RADIUS);
        const nearbyCoins = this.world.getCoinsInAOI(player.x, player.y, AOI_RADIUS);
        
        // Build frame packet
        const packet = this.buildFramePacket(client, player, nearbyPlayers, nearbyCoins, events, frame);
        
        if (packet.byteLength > 1) {
          this.trackedSend(ws, packet, 'FRAME');
        }
        
        client.lastSentFrame = frame;
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    }
  }
  
  /**
   * Build binary frame packet for a client
   */
  buildFramePacket(client, selfPlayer, nearbyPlayers, nearbyCoins, events, frame) {
    const writer = new BinaryWriter(512);
    const mapSize = this.world.mapSize;
    
    // Header
    writer.writeU8(PacketType.FRAME);
    writer.writeU32(frame);
    
    // Self player (always full update)
    writer.writeU8(1); // has self
    this.writePlayerFull(writer, selfPlayer, mapSize);
    
    // Nearby players (delta)
    const currentEntities = new Set();
    const newEntities = [];
    const updatedEntities = [];
    const removedEntities = [];
    
    for (const p of nearbyPlayers) {
      if (p.id === selfPlayer.id) continue;
      currentEntities.add(p.id);
      
      if (!client.lastSeenEntities.has(p.id)) {
        newEntities.push(p);
      } else {
        const dirty = p._dirty; // Don't consume, just read
        if (dirty !== 0) {
          updatedEntities.push({ player: p, dirty });
        }
      }
    }
    
    // Find removed entities
    for (const id of client.lastSeenEntities) {
      if (!currentEntities.has(id)) {
        removedEntities.push(id);
      }
    }
    
    client.lastSeenEntities = currentEntities;
    
    // Write new entities (full)
    writer.writeU8(newEntities.length);
    for (const p of newEntities) {
      this.writePlayerFull(writer, p, mapSize);
    }
    
    // Write updated entities (delta)
    writer.writeU8(updatedEntities.length);
    for (const { player, dirty } of updatedEntities) {
      this.writePlayerDelta(writer, player, dirty, mapSize);
    }
    
    // Write removed entities
    writer.writeU8(removedEntities.length);
    for (const id of removedEntities) {
      writer.writeU16(id);
    }
    
    // Write coins in AOI
    writer.writeU8(Math.min(nearbyCoins.length, 255));
    for (let i = 0; i < Math.min(nearbyCoins.length, 255); i++) {
      const coin = nearbyCoins[i];
      writer.writeU16(coin.id);
      writer.writeU16(Math.round(coin.x));
      writer.writeU16(Math.round(coin.y));
    }
    
    // Write events relevant to this client
    const relevantEvents = events.filter(e => this.isEventRelevant(e, selfPlayer, AOI_RADIUS));
    writer.writeU8(Math.min(relevantEvents.length, 255));
    for (let i = 0; i < Math.min(relevantEvents.length, 255); i++) {
      this.writeEvent(writer, relevantEvents[i], mapSize);
    }
    
    return writer.toArrayBuffer();
  }
  
  /**
   * Build binary frame packet for a spectator (sees all entities)
   */
  buildSpectatorFramePacket(client, allPlayers, allCoins, events, frame) {
    const writer = new BinaryWriter(2048); // Larger buffer for full state
    const mapSize = this.world.mapSize;
    
    // Header
    writer.writeU8(PacketType.FRAME);
    writer.writeU32(frame);
    
    // No self player for spectator
    writer.writeU8(0); // has self = false
    
    // Track entities for delta updates
    const currentEntities = new Set();
    const newEntities = [];
    const updatedEntities = [];
    const removedEntities = [];
    
    for (const p of allPlayers) {
      currentEntities.add(p.id);
      
      if (!client.lastSeenEntities.has(p.id)) {
        newEntities.push(p);
      } else {
        const dirty = p._dirty;
        if (dirty !== 0) {
          updatedEntities.push({ player: p, dirty });
        }
      }
    }
    
    // Find removed entities
    for (const id of client.lastSeenEntities) {
      if (!currentEntities.has(id)) {
        removedEntities.push(id);
      }
    }
    
    client.lastSeenEntities = currentEntities;
    
    // Write new entities (full)
    writer.writeU8(Math.min(newEntities.length, 255));
    for (let i = 0; i < Math.min(newEntities.length, 255); i++) {
      this.writePlayerFull(writer, newEntities[i], mapSize);
    }
    
    // Write updated entities (delta)
    writer.writeU8(Math.min(updatedEntities.length, 255));
    for (let i = 0; i < Math.min(updatedEntities.length, 255); i++) {
      const { player, dirty } = updatedEntities[i];
      this.writePlayerDelta(writer, player, dirty, mapSize);
    }
    
    // Write removed entities
    writer.writeU8(Math.min(removedEntities.length, 255));
    for (let i = 0; i < Math.min(removedEntities.length, 255); i++) {
      writer.writeU16(removedEntities[i]);
    }
    
    // Write all coins (spectator sees everything)
    writer.writeU8(Math.min(allCoins.length, 255));
    for (let i = 0; i < Math.min(allCoins.length, 255); i++) {
      const coin = allCoins[i];
      writer.writeU16(coin.id);
      writer.writeU16(Math.round(coin.x));
      writer.writeU16(Math.round(coin.y));
    }
    
    // Write all events (spectator sees everything)
    writer.writeU8(Math.min(events.length, 255));
    for (let i = 0; i < Math.min(events.length, 255); i++) {
      this.writeEvent(writer, events[i], mapSize);
    }
    
    return writer.toArrayBuffer();
  }
  
  /**
   * Write full player data
   */
  writePlayerFull(writer, player, mapSize) {
    // Handle both real player objects (id, color) and serialized format (num, base)
    const playerId = player.id !== undefined ? player.id : player.num;
    const color = player.color || player.base;
    
    writer.writeU16(playerId);
    writer.writeString(player.name);
    writer.writeU16(quantizePosition(player.x, mapSize));
    writer.writeU16(quantizePosition(player.y, mapSize));
    writer.writeU16(quantizeAngle(player.angle));
    writer.writeU8(quantizeHP(player.hp, player.maxHp));
    writer.writeU8(player.level);
    writer.writeU16(player.xp);
    writer.writeU8(Math.round(player.sizeScale * 100));
    
    // Flags
    let flags = 0;
    if (player.dead) flags |= 0x01;
    if (player.isSnipped) flags |= 0x02;
    writer.writeU8(flags);
    
    // Color
    writer.writeU8(encodeColor(color.hue));
    writer.writeU8(Math.round(color.sat * 255));
    writer.writeU8(Math.round(color.lum * 255));
    
    // Territory (simplified - just point count and points)
    const territory = player.territory || [];
    writer.writeU8(Math.min(territory.length, 255));
    for (let i = 0; i < Math.min(territory.length, 255); i++) {
      writer.writeU16(quantizePosition(territory[i].x, mapSize));
      writer.writeU16(quantizePosition(territory[i].y, mapSize));
    }
    
    // Trail
    const trail = player.trail || [];
    writer.writeU8(Math.min(trail.length, 255));
    for (let i = 0; i < Math.min(trail.length, 255); i++) {
      writer.writeU16(quantizePosition(trail[i].x, mapSize));
      writer.writeU16(quantizePosition(trail[i].y, mapSize));
    }
    
    // Drones - only send count, client simulates positions
    // This saves 8 bytes per drone (was: id + x + y + targetId)
    const drones = player.drones || [];
    writer.writeU8(drones.length);
  }
  
  /**
   * Write delta player data
   */
  writePlayerDelta(writer, player, dirty, mapSize) {
    writer.writeU16(player.id);
    writer.writeU8(dirty);
    
    if (dirty & DeltaFlags.POSITION) {
      writer.writeU16(quantizePosition(player.x, mapSize));
      writer.writeU16(quantizePosition(player.y, mapSize));
    }
    
    if (dirty & DeltaFlags.ANGLE) {
      writer.writeU16(quantizeAngle(player.angle));
    }
    
    if (dirty & DeltaFlags.HP) {
      writer.writeU8(quantizeHP(player.hp, player.maxHp));
    }
    
    if (dirty & DeltaFlags.XP) {
      writer.writeU16(player.xp);
    }
    
    if (dirty & DeltaFlags.LEVEL) {
      writer.writeU8(player.level);
    }
    
    if (dirty & DeltaFlags.DRONES) {
      // Drones - only send count, client simulates positions
      const drones = player.drones || [];
      writer.writeU8(drones.length);
    }
    
    if (dirty & DeltaFlags.TERRITORY) {
      const territory = player.territory || [];
      writer.writeU8(Math.min(territory.length, 255));
      for (let i = 0; i < Math.min(territory.length, 255); i++) {
        writer.writeU16(quantizePosition(territory[i].x, mapSize));
        writer.writeU16(quantizePosition(territory[i].y, mapSize));
      }
    }
    
    if (dirty & DeltaFlags.TRAIL) {
      const trail = player.trail || [];
      writer.writeU8(Math.min(trail.length, 255));
      for (let i = 0; i < Math.min(trail.length, 255); i++) {
        writer.writeU16(quantizePosition(trail[i].x, mapSize));
        writer.writeU16(quantizePosition(trail[i].y, mapSize));
      }
    }
  }
  
  /**
   * Write event
   */
  writeEvent(writer, event, mapSize) {
    writer.writeU8(event.type);
    
    switch (event.type) {
      case EventType.PLAYER_JOIN:
        this.writePlayerFull(writer, event.player, mapSize);
        break;
        
      case EventType.PLAYER_LEAVE:
        writer.writeU16(event.num);
        writer.writeU8(event.silent ? 1 : 0);
        break;
        
      case EventType.PLAYER_KILL:
        writer.writeU16(event.killerNum);
        writer.writeU16(event.victimNum);
        writer.writeU8(event.killType);
        break;
        
      case EventType.COIN_SPAWN:
        writer.writeU16(event.id);
        writer.writeU16(quantizePosition(event.x, mapSize));
        writer.writeU16(quantizePosition(event.y, mapSize));
        writer.writeU8(event.value);
        break;
        
      case EventType.COIN_PICKUP:
        writer.writeU16(event.id);
        writer.writeU16(event.playerNum);
        break;
        
      case EventType.HITSCAN:
        // Optimized: only send player IDs, client calculates positions
        // Saves 8 bytes per hitscan (was 13 bytes, now 5 bytes)
        writer.writeU16(event.ownerNum);
        writer.writeU16(event.targetNum);
        writer.writeU8(event.damage);
        break;
        
      case EventType.CAPTURE:
        writer.writeU16(event.playerNum);
        writer.writeU16(quantizePosition(event.x, mapSize));
        writer.writeU16(quantizePosition(event.y, mapSize));
        writer.writeU8(event.xpGained);
        break;
        
      case EventType.LEVEL_UP:
        writer.writeU16(event.playerNum);
        writer.writeU8(event.newLevel);
        break;
        
      case EventType.SNIP_START:
        writer.writeU16(event.playerNum);
        writer.writeU16(event.snipperNum);
        break;
    }
  }
  
  /**
   * Check if event is relevant to player
   */
  isEventRelevant(event, player, aoiRadius) {
    switch (event.type) {
      case EventType.HITSCAN:
        // Relevant if player is involved or nearby
        if (event.ownerNum === player.id || event.targetNum === player.id) return true;
        const dist = Math.hypot(event.fromX - player.x, event.fromY - player.y);
        return dist < aoiRadius;
        
      case EventType.PLAYER_KILL:
        return event.killerNum === player.id || event.victimNum === player.id;
        
      case EventType.LEVEL_UP:
        return event.playerNum === player.id;
        
      case EventType.CAPTURE:
        return event.playerNum === player.id;
        
      case EventType.SNIP_START:
        return event.playerNum === player.id || event.snipperNum === player.id;
        
      case EventType.COIN_PICKUP:
        return event.playerNum === player.id;
        
      case EventType.COIN_SPAWN:
        const coinDist = Math.hypot(event.x - player.x, event.y - player.y);
        return coinDist < aoiRadius;
        
      case EventType.PLAYER_JOIN:
      case EventType.PLAYER_LEAVE:
        return true; // Always relevant
        
      default:
        return true;
    }
  }
  
  /**
   * Broadcast event to all clients except one
   */
  broadcastEvent(event, excludePlayerId = null) {
    const data = JSON.stringify(event);
    
    for (const [ws, client] of this.clients) {
      if (client.playerId !== excludePlayerId) {
        try {
          this.trackedSend(ws, data, 'OTHER');
        } catch (err) {
          console.error('Event broadcast error:', err);
        }
      }
    }
  }
}

export default Room;
