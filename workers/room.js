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
import { BinaryWriter, BinaryWriterPool } from '../src/net/codec.js';
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

// Shared writer pool for all rooms (reduces allocations)
const writerPool = new BinaryWriterPool(32, 512);

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
const BOT_RESPAWN_DELAY = 0; // Instant respawn for stable bot counts during load testing

// AOI radius for visibility
const AOI_RADIUS = 800;

// Metrics logging interval (1 minute)
const METRICS_LOG_INTERVAL_MS = 60000;

/**
 * Metrics Logger for production monitoring
 * Logs JSON lines once per minute with comprehensive stats
 * 
 * Phase timing breakdown for capacity planning:
 * - botMs: Bot AI updates
 * - simMs: World simulation tick
 * - aoiMs: AOI queries (getPlayersInAOI, getCoinsInAOI)
 * - buildMs: Packet building (serialize)
 * - sendMs: WebSocket send calls
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
    
    // Tick timing stats - total tick time
    this.tickTimes = []; // Array of tick CPU times in ms
    this.simTickCount = 0;
    this.netTickCount = 0;
    
    // Phase-level timing for capacity planning (ms per tick)
    // These help compute marginal cost per player
    this.phaseTimes = {
      bot: [],    // Bot AI update time
      sim: [],    // World.tick() simulation time
      aoi: [],    // AOI query time (getPlayersInAOI, getCoinsInAOI)
      build: [],  // Packet building/serialization time
      send: [],   // WebSocket send time
    };
    
    // Player count samples (for regression analysis)
    this.playerCountSamples = []; // { players, bots, tickMs, phases }
    
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
  
  // Track tick CPU time (legacy - total only)
  trackTick(cpuTimeMs, isSim, isNet) {
    this.tickTimes.push(cpuTimeMs);
    if (isSim) this.simTickCount++;
    if (isNet) this.netTickCount++;
  }
  
  // Track detailed tick with phase breakdown
  trackTickDetailed(totalMs, phases, playerCount, botCount) {
    this.tickTimes.push(totalMs);
    this.simTickCount++;
    
    // Track phase times
    if (phases.bot !== undefined) this.phaseTimes.bot.push(phases.bot);
    if (phases.sim !== undefined) this.phaseTimes.sim.push(phases.sim);
    if (phases.aoi !== undefined) this.phaseTimes.aoi.push(phases.aoi);
    if (phases.build !== undefined) this.phaseTimes.build.push(phases.build);
    if (phases.send !== undefined) this.phaseTimes.send.push(phases.send);
    
    // Sample for regression (every 10th tick to avoid bloat)
    if (this.playerCountSamples.length < 360) { // Max 6 samples/sec for 1 min
      this.playerCountSamples.push({
        players: playerCount,
        bots: botCount,
        total: playerCount + botCount,
        tickMs: totalMs,
        phases,
      });
    }
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
  
  buildMetrics(activeConnections, activePlayers, botCount, now = Date.now()) {
    const elapsed = Math.max(1, now - this.lastLogTime);
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
    
    // Calculate phase timing averages
    const phaseAvg = {};
    const phaseP95 = {};
    for (const [phase, times] of Object.entries(this.phaseTimes)) {
      if (times.length > 0) {
        const sorted = [...times].sort((a, b) => a - b);
        phaseAvg[phase] = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100;
        phaseP95[phase] = Math.round(this.percentile(sorted, 0.95) * 100) / 100;
      }
    }
    
    // Compute capacity estimates using linear regression
    // avgTickMs ≈ baseTickMs + (msPerEntity * N)
    // Solve for max N given budget: N_max = (budgetMs - baseTickMs) / msPerEntity
    let capacityEstimate = null;
    if (this.playerCountSamples.length >= 10) {
      const regression = this.computeLinearRegression(this.playerCountSamples);
      if (regression) {
        const TICK_BUDGET_MS = 50; // Conservative budget (100ms at 10Hz, use 50ms for headroom)
        const maxEntitiesAvg = regression.baseMs > 0 && regression.msPerEntity > 0
          ? Math.floor((TICK_BUDGET_MS - regression.baseMs) / regression.msPerEntity)
          : null;
        
        capacityEstimate = {
          baseMs: Math.round(regression.baseMs * 100) / 100,
          msPerEntity: Math.round(regression.msPerEntity * 1000) / 1000, // More precision
          r2: Math.round(regression.r2 * 1000) / 1000,
          maxEntitiesAt50ms: maxEntitiesAvg,
          sampleCount: this.playerCountSamples.length,
        };
      }
    }
    
    // Build metrics object
    return {
      ts: new Date().toISOString(),
      roomId: this.roomId,
      uptimeSec: Math.round(uptimeSec),
      
      // Tick rates
      targetSimHz: SIM_TICK_RATE,
      targetNetHz: NETWORK_TICK_RATE,
      actualSimHz: Math.round(actualSimTickRate * 10) / 10,
      actualNetHz: Math.round(actualNetTickRate * 10) / 10,
      
      // Tick CPU time (ms) - total
      avgTickMs: Math.round(avgTickMs * 100) / 100,
      p95TickMs: Math.round(p95TickMs * 100) / 100,
      maxTickMs: Math.round(maxTickMs * 100) / 100,
      tickSamples: sortedTicks.length,
      
      // Phase breakdown (ms) - for capacity planning
      // bot: Bot AI, sim: World.tick(), aoi: AOI queries, build: packet serialize, send: WS send
      phaseAvgMs: phaseAvg,
      phaseP95Ms: phaseP95,
      
      // Capacity estimate (linear regression: tickMs = base + k*N)
      capacity: capacityEstimate,
      
      // Connections
      connections: activeConnections,
      players: activePlayers,
      bots: botCount,
      entities: entityCount,
      
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
  }

  reset(now = Date.now()) {
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
    
    // Reset phase times
    for (const phase of Object.keys(this.phaseTimes)) {
      this.phaseTimes[phase] = [];
    }
    this.playerCountSamples = [];
    
    // Reset message type tracking
    for (const stats of Object.values(this.messageTypeSizes)) {
      stats.count = 0;
      stats.totalBytes = 0;
    }
  }

  // Generate and log metrics (returns true if logged)
  maybeLog(activeConnections, activePlayers, botCount) {
    const now = Date.now();
    const elapsed = now - this.lastLogTime;

    if (elapsed < METRICS_LOG_INTERVAL_MS) {
      return false;
    }

    const metrics = this.buildMetrics(activeConnections, activePlayers, botCount, now);
    console.log('[METRICS]', JSON.stringify(metrics));
    this.reset(now);
    return true;
  }
  
  /**
   * Compute linear regression: tickMs = baseMs + msPerEntity * N
   * Returns { baseMs, msPerEntity, r2 } or null if insufficient data
   */
  computeLinearRegression(samples) {
    if (samples.length < 5) return null;
    
    // Use entity count (players + bots) as X, tickMs as Y
    const n = samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (const s of samples) {
      const x = s.total; // players + bots
      const y = s.tickMs;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }
    
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 0.0001) return null;
    
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R² (coefficient of determination)
    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (const s of samples) {
      const predicted = intercept + slope * s.total;
      ssRes += (s.tickMs - predicted) ** 2;
      ssTot += (s.tickMs - meanY) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    
    return {
      baseMs: Math.max(0, intercept), // Base cost shouldn't be negative
      msPerEntity: Math.max(0, slope), // Cost per entity shouldn't be negative
      r2,
    };
  }
}

/**
 * Client connection state
 * Optimized with AOI caching and reusable buffers
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
    
    // AOI caching - skip queries if player hasn't moved across grid cells
    this._lastGridKey = null;
    this._cachedNearbyPlayers = null;
    this._cachedNearbyCoins = null;
    
    // Reusable arrays for delta tracking (avoid allocations per frame)
    this._newEntities = [];
    this._updatedEntities = [];
    this._removedEntities = [];
    this._currentEntities = new Set();
  }
  
  /**
   * Invalidate AOI cache (called when player moves to new grid cell)
   */
  invalidateAOICache() {
    this._cachedNearbyPlayers = null;
    this._cachedNearbyCoins = null;
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
    this.roomName = null;         // Set from first request URL (e.g., "default", "loadtest")
    
    // Metrics logging (enabled via METRICS_ENABLED env var or always in dev)
    this.metricsEnabled = env.METRICS_ENABLED === 'true' || env.METRICS_ENABLED === '1';
    this.metrics = this.metricsEnabled ? new MetricsLogger(state.id.toString()) : null;
  }
  
  /**
   * Handle WebSocket connection
   */
  async fetch(request) {
    const url = new URL(request.url);

    // Prefer room name passed by the Worker router (see `workers/index.js`).
    const headerRoomName = request.headers.get('X-Room-Name');
    if (headerRoomName && !this.roomName) {
      this.roomName = headerRoomName;
    }

    // Cache the room name (best-effort) for gating debug endpoints.
    // `workers/index.js` forwards `/room/<name>` requests directly to this DO.
    if (!this.roomName && url.pathname.startsWith('/room/')) {
      this.roomName = url.pathname.split('/')[2] || 'default';
    }
    
    // Track DO fetch invocation for metrics (this is a real DO request)
    if (this.metrics) {
      this.metrics.trackDoRequest();
    }
    
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Accept and configure
      // Prefer Durable Object "hibernatable websockets" so the connection isn't dropped when the DO is evicted/hibernates.
      // Fall back to `server.accept()` for older runtimes / local simulators.
      let usingHibernatable = false;
      if (typeof this.state.acceptWebSocket === 'function') {
        this.state.acceptWebSocket(server);
        usingHibernatable = true;
      } else {
        server.accept();
      }
      
      // For hibernatable websockets, events are delivered via DO class methods:
      // `webSocketMessage`, `webSocketClose`, `webSocketError`.
      // Only attach event listeners for non-hibernatable fallback.
      if (!usingHibernatable) {
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
      }
      
      // Track pending connection (will be decremented when hello is received or on disconnect)
      this.pendingConnections++;
      console.log(`[ROOM] New WebSocket connection, pendingConnections=${this.pendingConnections}, clients=${this.clients.size}`);
      
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

  // Hibernatable WebSocket handlers (Cloudflare Durable Objects)
  webSocketMessage(ws, message) {
    this.handleMessage(ws, message);
  }

  webSocketClose(ws, code, reason, wasClean) {
    if (this.roomName === 'loadtest') {
      try {
        console.log(`[ROOM] WebSocketClose code=${code} clean=${wasClean} reason=${reason ? String(reason) : ''}`);
      } catch (_) {}
    }
    this.handleDisconnect(ws);
  }

  webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    this.handleDisconnect(ws);
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

    try {
      const tickStart = performance.now();
    const now = Date.now();
    
    // Phase timing for capacity planning
    const phases = {};
    let phaseStart;
    
    // Initialize bots gradually (not all at once to avoid blocking)
    if (!this.botsInitialized) {
      // Initialize a batch of bots per tick to avoid blocking the event loop
      const BOTS_PER_TICK = 10;
      const currentBots = this.botManager.count;
      
      if (currentBots < BOT_COUNT) {
        const toSpawn = Math.min(BOTS_PER_TICK, BOT_COUNT - currentBots);
        for (let i = 0; i < toSpawn; i++) {
          this.spawnBot(this.generateBotName());
        }
        
        if (currentBots + toSpawn >= BOT_COUNT) {
          this.botsInitialized = true;
          console.log(`Initialized ${BOT_COUNT} bots (pendingConnections=${this.pendingConnections}, clients=${this.clients.size})`);
        }
      } else {
        this.botsInitialized = true;
      }
    }
    
    // === BOT PHASE ===
    phaseStart = performance.now();
    this.botManager.update(this.world, now);
    phases.bot = performance.now() - phaseStart;
    
    // Simulation tick
    const simDelta = now - this.lastSimTick;
    this.lastSimTick = now;
    this.simAccumulator += simDelta;
    
    // === SIM PHASE ===
    phaseStart = performance.now();
    let simCount = 0;
    const maxSimTicks = 10;
    while (this.simAccumulator >= SIM_TICK_MS && simCount < maxSimTicks) {
      this.world.tick(SIM_TICK_MS / 1000);
      this.simAccumulator -= SIM_TICK_MS;
      simCount++;
    }
    phases.sim = performance.now() - phaseStart;
    
    // Check for dead bots AFTER world tick (so deaths are detected)
    // Then process respawns (so dead bots are removed before spawning new ones)
    this.checkDeadBots(now);
    this.processBotRespawns(now);
    
    // If we're still behind after max ticks, drop the excess time
    if (this.simAccumulator > SIM_TICK_MS * 2) {
      this.simAccumulator = 0;
    }
    
    // Network tick (lower rate)
    let didNetTick = false;
    const netDelta = now - this.lastNetTick;
    if (netDelta >= NETWORK_TICK_MS) {
      this.lastNetTick = now;
      // broadcastFrame tracks AOI, build, and send phases internally
      const netPhases = this.broadcastFrame();
      if (netPhases) {
        phases.aoi = netPhases.aoi;
        phases.build = netPhases.build;
        phases.send = netPhases.send;
      }
      didNetTick = true;
    }
    
      // Track tick timing for metrics
      if (this.metrics) {
        const tickEnd = performance.now();
        const tickCpuMs = tickEnd - tickStart;

        // Use detailed tracking with phase breakdown
        const humanPlayers = Array.from(this.clients.values()).filter(c => !c.isSpectator).length;
        this.metrics.trackTickDetailed(tickCpuMs, phases, humanPlayers, this.botManager.count);

        // Log metrics once per minute
        this.metrics.maybeLog(this.clients.size, humanPlayers, this.botManager.count);
      }

      // Continue running if there are active connections OR pending connections (awaiting hello)
      const hasActiveConnections = this.clients.size > 0 || this.pendingConnections > 0;

      if (hasActiveConnections) {
        this.scheduleNextTick();
      } else {
        // No connections - immediately stop tick loop (DO becomes idle)
        // Don't clear state yet - schedule cleanup after timeout
        console.log(`[ROOM] No active connections, stopping tick loop immediately (clients=${this.clients.size}, pending=${this.pendingConnections})`);
        this.stopTickLoop();
        this.scheduleCleanup();
      }
    } catch (err) {
      console.error('[ROOM] Tick loop error:', err?.stack || err);

      // For load testing, surface the error to the client before closing (so we can debug 1006s).
      if (this.roomName === 'loadtest') {
        const payload = JSON.stringify({
          type: 'serverError',
          where: 'tick',
          error: String(err?.message || err),
        });
        for (const ws of this.clients.keys()) {
          try {
            ws.send(payload);
          } catch (_) {}
          try {
            ws.close(1011, 'server_error');
          } catch (_) {}
        }
      }

      // Stop the loop to avoid tight crash loops.
      this.stopTickLoop();
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
  
  /**
   * Spawn a single bot
   * @returns {string|null} Player ID if successful, null if spawn failed
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
    // Spawn failed - log the reason with world state
    console.log(`[BOTS] Spawn failed for ${name}: ${result.error} (worldPlayers=${this.world.players.size}, maxPlayers=${consts.MAX_PLAYERS})`);
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
   * Process pending bot respawns and maintain target bot count
   */
  processBotRespawns(now) {
    const stillPending = [];
    const failedSpawns = [];
    let respawned = 0;
    let failed = 0;
    
    for (const respawn of this.pendingBotRespawns) {
      if (now >= respawn.respawnTime) {
        const playerId = this.spawnBot(respawn.name);
        if (!playerId) {
          // Spawn failed, re-queue with small delay
          failedSpawns.push({
            respawnTime: now + 100, // Retry in 100ms
            name: respawn.name,
          });
          failed++;
        } else {
          respawned++;
        }
      } else {
        stillPending.push(respawn);
      }
    }
    
    this.pendingBotRespawns = [...stillPending, ...failedSpawns];
    
    // Maintain target bot count - spawn new bots if we're below target
    // This handles cases where bots die faster than they can be tracked for respawn
    const currentBotCount = this.botManager.count;
    const pendingCount = this.pendingBotRespawns.length;
    const totalExpected = currentBotCount + pendingCount;
    
    let newSpawns = 0;
    let newFailed = 0;
    if (totalExpected < BOT_COUNT) {
      const toSpawn = BOT_COUNT - totalExpected;
      for (let i = 0; i < toSpawn; i++) {
        const playerId = this.spawnBot(this.generateBotName());
        if (!playerId) {
          // Spawn failed, queue for retry
          this.pendingBotRespawns.push({
            respawnTime: now + 100,
            name: this.generateBotName(),
          });
          newFailed++;
        } else {
          newSpawns++;
        }
      }
    }
    
    // Log bot status periodically (every ~10 seconds)
    if (!this.lastBotLog || now - this.lastBotLog > 10000) {
      this.lastBotLog = now;
      const worldBots = Array.from(this.world.players.values()).filter(p => this.botManager.bots.has(p.id)).length;
      console.log(`[BOTS] target=${BOT_COUNT} manager=${currentBotCount} world=${worldBots} pending=${pendingCount} respawned=${respawned} failed=${failed} newSpawns=${newSpawns} newFailed=${newFailed}`);
    }
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
          console.log(`[ROOM] Received hello from client (pendingConnections=${this.pendingConnections}, clients=${this.clients.size}, worldPlayers=${this.world.players.size})`);
          this.handleHello(ws, msg);
          console.log(`[ROOM] After handleHello (pendingConnections=${this.pendingConnections}, clients=${this.clients.size})`);
          break;
          
        case 'ping':
          this.handlePing(ws, msg);
          break;

        case 'getMetrics':
          this.handleGetMetrics(ws);
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
   * Load-test-only: return a metrics snapshot directly to the client.
   * This avoids relying on `wrangler tail`, and keeps metrics off normal rooms.
   */
  handleGetMetrics(ws) {
    if (this.roomName !== 'loadtest') {
      this.trackedSend(ws, JSON.stringify({ type: 'metrics', error: 'not_allowed' }), 'OTHER');
      return;
    }

    if (!this.metrics) {
      this.trackedSend(ws, JSON.stringify({ type: 'metrics', error: 'disabled' }), 'OTHER');
      return;
    }

    const humanPlayers = Array.from(this.clients.values()).filter(c => !c.isSpectator).length;
    const snapshot = this.metrics.buildMetrics(this.clients.size, humanPlayers, this.botManager.count);
    this.trackedSend(ws, JSON.stringify({ type: 'metrics', metrics: snapshot }), 'OTHER');
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
      console.log(`[ROOM] Failed to add player: ${result.error}`);
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
    
    const initJson = JSON.stringify(initData);
    console.log(`[ROOM] Sending init packet (${initJson.length} bytes, ${initData.players.length} players, ${initData.coins.length} coins)`);
    this.trackedSend(ws, initJson, 'INIT');
    
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
   * Optimized with AOI caching and early-exit for empty frames
   */
  broadcastFrame() {
    const frame = this.world.frame;
    const events = this.world.pendingEvents;
    
    // Clear events after capturing them (they'll be sent to all clients)
    this.world.pendingEvents = [];
    
    // Phase timing for capacity planning
    let aoiTime = 0;
    let buildTime = 0;
    let sendTime = 0;
    let phaseStart;
    
    // Grid cell size for AOI caching
    const gridCellSize = this.world.playerGrid.cellSize;
    
    for (const [ws, client] of this.clients) {
      try {
        // Spectators see everything
        if (client.isSpectator) {
          phaseStart = performance.now();
          const allPlayers = this.world.getAllPlayers();
          const allCoins = this.world.getAllCoins();
          aoiTime += performance.now() - phaseStart;
          
          phaseStart = performance.now();
          const packet = this.buildSpectatorFramePacket(client, allPlayers, allCoins, events, frame);
          buildTime += performance.now() - phaseStart;
          
          if (packet.byteLength > 1) {
            phaseStart = performance.now();
            this.trackedSend(ws, packet, 'FRAME');
            sendTime += performance.now() - phaseStart;
          }
          client.lastSentFrame = frame;
          continue;
        }
        
        const player = this.world.getPlayer(client.playerId);
        if (!player) continue;
        
        // === AOI PHASE with caching ===
        phaseStart = performance.now();
        
        // Check if player moved to a new grid cell
        const gridX = Math.floor(player.x / gridCellSize);
        const gridY = Math.floor(player.y / gridCellSize);
        const currentGridKey = `${gridX},${gridY}`;
        
        let nearbyPlayers, nearbyCoins;
        
        if (client._lastGridKey !== currentGridKey) {
          // Player moved to new cell - refresh AOI
          client._lastGridKey = currentGridKey;
          nearbyPlayers = this.world.getPlayersInAOI(player.x, player.y, AOI_RADIUS);
          nearbyCoins = this.world.getCoinsInAOI(player.x, player.y, AOI_RADIUS);
          // Cache fresh copies (getNearby returns reused buffer)
          client._cachedNearbyPlayers = nearbyPlayers.slice();
          client._cachedNearbyCoins = nearbyCoins.slice();
        } else if (client._cachedNearbyPlayers) {
          // Use cached AOI results
          nearbyPlayers = client._cachedNearbyPlayers;
          nearbyCoins = client._cachedNearbyCoins;
        } else {
          // First frame or cache miss
          nearbyPlayers = this.world.getPlayersInAOI(player.x, player.y, AOI_RADIUS);
          nearbyCoins = this.world.getCoinsInAOI(player.x, player.y, AOI_RADIUS);
          client._cachedNearbyPlayers = nearbyPlayers.slice();
          client._cachedNearbyCoins = nearbyCoins.slice();
        }
        
        aoiTime += performance.now() - phaseStart;
        
        // === BUILD PHASE ===
        phaseStart = performance.now();
        const packet = this.buildFramePacket(client, player, nearbyPlayers, nearbyCoins, events, frame);
        buildTime += performance.now() - phaseStart;
        
        if (packet.byteLength > 1) {
          // === SEND PHASE ===
          phaseStart = performance.now();
          this.trackedSend(ws, packet, 'FRAME');
          sendTime += performance.now() - phaseStart;
        }
        
        client.lastSentFrame = frame;
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    }
    
    // Return phase timings for metrics
    return {
      aoi: aoiTime,
      build: buildTime,
      send: sendTime,
    };
  }
  
  /**
   * Build binary frame packet for a client
   * Optimized to reuse client arrays and minimize allocations
   */
  buildFramePacket(client, selfPlayer, nearbyPlayers, nearbyCoins, events, frame) {
    const writer = writerPool.acquire();
    const mapSize = this.world.mapSize;
    
    // Header
    writer.writeU8(PacketType.FRAME);
    writer.writeU32(frame);
    
    // Self player (always full update)
    writer.writeU8(1); // has self
    this.writePlayerFull(writer, selfPlayer, mapSize);
    
    // Reuse client arrays to minimize allocations
    const currentEntities = client._currentEntities;
    currentEntities.clear();
    const newEntities = client._newEntities;
    newEntities.length = 0;
    const updatedEntities = client._updatedEntities;
    updatedEntities.length = 0;
    const removedEntities = client._removedEntities;
    removedEntities.length = 0;
    
    for (let i = 0; i < nearbyPlayers.length; i++) {
      const p = nearbyPlayers[i];
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
    
    // Swap sets instead of creating new one
    const temp = client.lastSeenEntities;
    client.lastSeenEntities = currentEntities;
    client._currentEntities = temp;
    
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
    
    // Write events relevant to this client - avoid filter() allocation
    let relevantCount = 0;
    for (let i = 0; i < events.length && relevantCount < 255; i++) {
      if (this.isEventRelevant(events[i], selfPlayer, AOI_RADIUS)) {
        relevantCount++;
      }
    }
    writer.writeU8(relevantCount);
    for (let i = 0, written = 0; i < events.length && written < 255; i++) {
      if (this.isEventRelevant(events[i], selfPlayer, AOI_RADIUS)) {
        this.writeEvent(writer, events[i], mapSize);
        written++;
      }
    }
    
    const result = writer.toArrayBuffer();
    writerPool.release(writer);
    return result;
  }
  
  /**
   * Build binary frame packet for a spectator (sees all entities)
   */
  buildSpectatorFramePacket(client, allPlayers, allCoins, events, frame) {
    const writer = writerPool.acquire(); // Pool handles sizing
    const mapSize = this.world.mapSize;
    
    // Header
    writer.writeU8(PacketType.FRAME);
    writer.writeU32(frame);
    
    // No self player for spectator
    writer.writeU8(0); // has self = false
    
    // Track entities for delta updates (spectators don't need optimized tracking)
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
    
    const result = writer.toArrayBuffer();
    writerPool.release(writer);
    return result;
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
    
    // Trail (U16 count to support longer trails)
    const trail = player.trail || [];
    writer.writeU16(trail.length);
    for (let i = 0; i < trail.length; i++) {
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
      writer.writeU16(trail.length);
      for (let i = 0; i < trail.length; i++) {
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
