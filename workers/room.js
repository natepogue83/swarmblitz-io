/**
 * Room Durable Object
 * 
 * Manages a single game room with:
 * - Authoritative simulation
 * - AOI-based delta broadcasting
 * - Binary protocol
 * - Batched network frames
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

// Network tick rate (Hz) - decoupled from simulation
const NETWORK_TICK_RATE = 20;
const NETWORK_TICK_MS = 1000 / NETWORK_TICK_RATE;

// Simulation tick rate (Hz) - runs faster for smooth physics
const SIM_TICK_RATE = 60;
const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

// AOI radius for visibility
const AOI_RADIUS = 800;

/**
 * Client connection state
 */
class Client {
  constructor(ws, playerId) {
    this.ws = ws;
    this.playerId = playerId;
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
    
    // Timing
    this.lastSimTick = Date.now();
    this.lastNetTick = Date.now();
    this.simAccumulator = 0;
    
    // Start game loop
    this.running = false;
  }
  
  /**
   * Handle WebSocket connection
   */
  async fetch(request) {
    const url = new URL(request.url);
    
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
      
      // Start game loop if not running
      if (!this.running) {
        this.running = true;
        this.scheduleLoop();
      }
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // Status endpoint
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        players: this.world.players.size,
        coins: this.world.coins.size,
        frame: this.world.frame,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  /**
   * Schedule next game loop iteration
   */
  scheduleLoop() {
    // Use alarm for Durable Objects
    this.state.storage.setAlarm(Date.now() + SIM_TICK_MS);
  }
  
  /**
   * Alarm handler - game loop
   */
  async alarm() {
    if (!this.running) return;
    
    const now = Date.now();
    
    // Simulation tick
    const simDelta = now - this.lastSimTick;
    this.lastSimTick = now;
    this.simAccumulator += simDelta;
    
    // Run simulation at fixed timestep
    while (this.simAccumulator >= SIM_TICK_MS) {
      this.world.tick(SIM_TICK_MS / 1000);
      this.simAccumulator -= SIM_TICK_MS;
    }
    
    // Network tick (lower rate)
    const netDelta = now - this.lastNetTick;
    if (netDelta >= NETWORK_TICK_MS) {
      this.lastNetTick = now;
      this.broadcastFrame();
    }
    
    // Continue loop if players connected
    if (this.clients.size > 0) {
      this.scheduleLoop();
    } else {
      this.running = false;
    }
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(ws, data) {
    try {
      // Binary message
      if (data instanceof ArrayBuffer) {
        this.handleBinaryMessage(ws, data);
        return;
      }
      
      // Text message (for initial handshake)
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'hello':
          this.handleHello(ws, msg);
          break;
          
        case 'ping':
          this.handlePing(ws, msg);
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
   * Handle hello (join game)
   */
  handleHello(ws, msg) {
    const name = (msg.name || 'Player').slice(0, 16);
    
    // Add player to world
    const result = this.world.addPlayer(name);
    
    if (!result.ok) {
      ws.send(JSON.stringify({ type: 'error', error: result.error }));
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
    
    ws.send(JSON.stringify(initData));
    
    // Broadcast join to others
    this.broadcastEvent({
      type: EventType.PLAYER_JOIN,
      player: player.serialize(),
    }, player.id);
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
   * Handle ping
   */
  handlePing(ws, msg) {
    ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
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
    
    ws.send(buffer);
  }
  
  /**
   * Handle disconnect
   */
  handleDisconnect(ws) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    // Remove from world
    this.world.removePlayer(client.playerId);
    
    // Clean up
    this.playerToClient.delete(client.playerId);
    this.clients.delete(ws);
    
    // Broadcast leave
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
    
    for (const [ws, client] of this.clients) {
      try {
        const player = this.world.getPlayer(client.playerId);
        if (!player) continue;
        
        // Get entities in AOI
        const nearbyPlayers = this.world.getPlayersInAOI(player.x, player.y, AOI_RADIUS);
        const nearbyCoins = this.world.getCoinsInAOI(player.x, player.y, AOI_RADIUS);
        
        // Build frame packet
        const packet = this.buildFramePacket(client, player, nearbyPlayers, nearbyCoins, events, frame);
        
        if (packet.byteLength > 1) {
          ws.send(packet);
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
   * Write full player data
   */
  writePlayerFull(writer, player, mapSize) {
    writer.writeU16(player.id);
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
    writer.writeU8(encodeColor(player.color.hue));
    writer.writeU8(Math.round(player.color.sat * 255));
    writer.writeU8(Math.round(player.color.lum * 255));
    
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
          ws.send(data);
        } catch (err) {
          console.error('Event broadcast error:', err);
        }
      }
    }
  }
}

export default Room;
