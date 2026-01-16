/**
 * Network Client for SwarmBlitz
 * 
 * Handles:
 * - WebSocket connection to Cloudflare Worker
 * - Binary protocol encoding/decoding
 * - Input batching and throttling
 * - RTT measurement
 */

import { BinaryReader } from './codec.js';
import { 
  PacketType, 
  Quant, 
  EventType,
  dequantizePosition,
  dequantizeAngle,
  dequantizeHP,
  decodeColor,
  DeltaFlags,
} from './protocol.js';

/**
 * Connection states
 */
export const ConnectionState = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2,
  RECONNECTING: 3,
};

/**
 * Network client
 */
export default class NetClient {
  constructor(options = {}) {
    this.url = options.url || 'ws://localhost:8787/room/default';
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.inputThrottleMs = options.inputThrottleMs || 50; // 20 Hz input rate
    
    this.ws = null;
    this.state = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    
    // Player state
    this.playerId = null;
    this.mapSize = 0;
    
    // RTT tracking
    this.rtt = 0;
    this.lastPingTime = 0;
    this.pingInterval = null;
    
    // Input throttling
    this.lastInputTime = 0;
    this.pendingAngle = null;
    
    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onInit = options.onInit || (() => {});
    this.onFrame = options.onFrame || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.onError = options.onError || (() => {});
    this.onReset = options.onReset || (() => {});
  }
  
  /**
   * Connect to server
   */
  connect(playerName) {
    if (this.state !== ConnectionState.DISCONNECTED) {
      return;
    }
    
    this.playerName = playerName;
    this.isSpectator = false;
    this.setState(ConnectionState.CONNECTING);
    
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (e) => this.handleMessage(e);
      this.ws.onclose = (e) => this.handleClose(e);
      this.ws.onerror = (e) => this.handleError(e);
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Connect as spectator (no player, just watching)
   */
  connectSpectate() {
    if (this.state !== ConnectionState.DISCONNECTED) {
      return;
    }
    
    this.playerName = null;
    this.isSpectator = true;
    this.setState(ConnectionState.CONNECTING);
    
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => this.handleOpenSpectate();
      this.ws.onmessage = (e) => this.handleMessage(e);
      this.ws.onclose = (e) => this.handleClose(e);
      this.ws.onerror = (e) => this.handleError(e);
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    this.reconnectAttempts = 0;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    
    this.setState(ConnectionState.DISCONNECTED);
  }
  
  /**
   * Send input (angle)
   */
  sendInput(angle) {
    if (this.state !== ConnectionState.CONNECTED) return;
    
    const now = Date.now();
    
    // Throttle inputs
    if (now - this.lastInputTime < this.inputThrottleMs) {
      this.pendingAngle = angle;
      return;
    }
    
    this.lastInputTime = now;
    this.pendingAngle = null;
    
    // Encode and send
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, PacketType.INPUT);
    
    // Quantize angle to 0-65535
    const normalized = (angle + Math.PI) / (Math.PI * 2);
    const quantized = Math.round(normalized * Quant.ANGLE_SCALE) & 0xFFFF;
    view.setUint16(1, quantized, true);
    
    this.ws.send(buffer);
  }
  
  /**
   * Flush pending input
   */
  flushInput() {
    if (this.pendingAngle !== null) {
      const angle = this.pendingAngle;
      this.pendingAngle = null;
      this.lastInputTime = 0;
      this.sendInput(angle);
    }
  }
  
  /**
   * Send ping
   */
  sendPing() {
    if (this.state !== ConnectionState.CONNECTED) return;
    
    this.lastPingTime = performance.now();
    
    const buffer = new ArrayBuffer(9);
    const view = new DataView(buffer);
    view.setUint8(0, PacketType.PING);
    view.setFloat64(1, this.lastPingTime, true);
    
    this.ws.send(buffer);
  }
  
  /**
   * Send reset command (debug)
   */
  sendReset() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.ws.send(JSON.stringify({ type: 'reset' }));
  }
  
  /**
   * Handle WebSocket open
   */
  handleOpen() {
    this.reconnectAttempts = 0;
    
    // Send hello
    this.ws.send(JSON.stringify({
      type: 'hello',
      name: this.playerName,
    }));
    
    // Start ping interval
    this.pingInterval = setInterval(() => this.sendPing(), 2000);
  }
  
  /**
   * Handle WebSocket open for spectator
   */
  handleOpenSpectate() {
    this.reconnectAttempts = 0;
    
    // Send spectate hello
    this.ws.send(JSON.stringify({
      type: 'hello',
      spectate: true,
    }));
    
    // Start ping interval
    this.pingInterval = setInterval(() => this.sendPing(), 2000);
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(event) {
    try {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      } else {
        this.handleTextMessage(JSON.parse(event.data));
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  }
  
  /**
   * Handle binary message
   */
  handleBinaryMessage(data) {
    const view = new DataView(data);
    const type = view.getUint8(0);
    
    switch (type) {
      case PacketType.FRAME:
        this.handleFrame(data);
        break;
        
      case PacketType.PONG:
        this.handlePong(view);
        break;
        
      case PacketType.DEAD:
        this.handleDead(view);
        break;
    }
  }
  
  /**
   * Handle text message
   */
  handleTextMessage(msg) {
    switch (msg.type) {
      case 'init':
        this.handleInit(msg);
        break;
        
      case 'error':
        this.onError(new Error(msg.error));
        break;
        
      case 'pong':
        // Legacy text pong
        this.rtt = Date.now() - msg.t;
        break;
        
      case 'reset':
        // Room was reset - reconnect
        console.log('%c🔄 Room reset, reconnecting...', 'color: orange; font-weight: bold;');
        this.onReset();
        break;
        
      default:
        // Event
        this.onEvent(msg);
    }
  }
  
  /**
   * Handle init message
   */
  handleInit(msg) {
    this.playerId = msg.playerId;
    this.mapSize = msg.mapSize;
    
    this.setState(ConnectionState.CONNECTED);
    
    this.onInit({
      playerId: msg.playerId,
      mapSize: msg.mapSize,
      player: msg.player,
      players: msg.players,
      coins: msg.coins,
    });
  }
  
  /**
   * Handle frame packet
   */
  handleFrame(data) {
    const reader = new BinaryReader(data);
    const mapSize = this.mapSize;
    
    // Skip packet type
    reader.readU8();
    
    // Read frame number
    const frame = reader.readU32();
    
    // Read self player
    const hasSelf = reader.readU8();
    let selfPlayer = null;
    if (hasSelf) {
      selfPlayer = this.readPlayerFull(reader, mapSize);
    }
    
    // Read new players
    const newCount = reader.readU8();
    const newPlayers = [];
    for (let i = 0; i < newCount; i++) {
      newPlayers.push(this.readPlayerFull(reader, mapSize));
    }
    
    // Read updated players
    const updateCount = reader.readU8();
    const updatedPlayers = [];
    for (let i = 0; i < updateCount; i++) {
      updatedPlayers.push(this.readPlayerDelta(reader, mapSize));
    }
    
    // Read removed players
    const removeCount = reader.readU8();
    const removedPlayerIds = [];
    for (let i = 0; i < removeCount; i++) {
      removedPlayerIds.push(reader.readU16());
    }
    
    // Read coins
    const coinCount = reader.readU8();
    const coins = [];
    for (let i = 0; i < coinCount; i++) {
      coins.push({
        id: reader.readU16(),
        x: reader.readU16(),
        y: reader.readU16(),
      });
    }
    
    // Read events
    const eventCount = reader.readU8();
    const events = [];
    for (let i = 0; i < eventCount; i++) {
      events.push(this.readEvent(reader, mapSize));
    }
    
    this.onFrame({
      frame,
      selfPlayer,
      newPlayers,
      updatedPlayers,
      removedPlayerIds,
      coins,
      events,
    });
  }
  
  /**
   * Read full player data
   */
  readPlayerFull(reader, mapSize) {
    const num = reader.readU16();
    const name = reader.readString();
    const x = dequantizePosition(reader.readU16(), mapSize);
    const y = dequantizePosition(reader.readU16(), mapSize);
    const angle = dequantizeAngle(reader.readU16());
    const hp = dequantizeHP(reader.readU8(), 100);
    const level = reader.readU8();
    const xp = reader.readU16();
    const sizeScale = reader.readU8() / 100;
    
    const flags = reader.readU8();
    const dead = (flags & 0x01) !== 0;
    const isSnipped = (flags & 0x02) !== 0;
    
    // Color
    const hue = decodeColor(reader.readU8());
    const sat = reader.readU8() / 255;
    const lum = reader.readU8() / 255;
    
    // Territory
    const territoryCount = reader.readU8();
    const territory = [];
    for (let i = 0; i < territoryCount; i++) {
      territory.push({
        x: dequantizePosition(reader.readU16(), mapSize),
        y: dequantizePosition(reader.readU16(), mapSize),
      });
    }
    
    // Trail
    const trailCount = reader.readU8();
    const trail = [];
    for (let i = 0; i < trailCount; i++) {
      trail.push({
        x: dequantizePosition(reader.readU16(), mapSize),
        y: dequantizePosition(reader.readU16(), mapSize),
      });
    }
    
    // Drones
    // Drones - only receive count, client simulates positions
    const droneCount = reader.readU8();
    
    return {
      num,
      name,
      x,
      y,
      angle,
      hp,
      maxHp: 100,
      level,
      xp,
      sizeScale,
      dead,
      isSnipped,
      base: { hue, sat, lum },
      territory,
      trail,
      droneCount,
    };
  }
  
  /**
   * Read delta player data
   */
  readPlayerDelta(reader, mapSize) {
    const num = reader.readU16();
    const dirty = reader.readU8();
    
    const delta = { num };
    
    if (dirty & DeltaFlags.POSITION) {
      delta.x = dequantizePosition(reader.readU16(), mapSize);
      delta.y = dequantizePosition(reader.readU16(), mapSize);
    }
    
    if (dirty & DeltaFlags.ANGLE) {
      delta.angle = dequantizeAngle(reader.readU16());
    }
    
    if (dirty & DeltaFlags.HP) {
      delta.hp = dequantizeHP(reader.readU8(), 100);
    }
    
    if (dirty & DeltaFlags.XP) {
      delta.xp = reader.readU16();
    }
    
    if (dirty & DeltaFlags.LEVEL) {
      delta.level = reader.readU8();
    }
    
    if (dirty & DeltaFlags.DRONES) {
      // Only receive drone count, client simulates positions
      delta.droneCount = reader.readU8();
    }
    
    if (dirty & DeltaFlags.TERRITORY) {
      const count = reader.readU8();
      delta.territory = [];
      for (let i = 0; i < count; i++) {
        delta.territory.push({
          x: dequantizePosition(reader.readU16(), mapSize),
          y: dequantizePosition(reader.readU16(), mapSize),
        });
      }
    }
    
    if (dirty & DeltaFlags.TRAIL) {
      const count = reader.readU8();
      delta.trail = [];
      for (let i = 0; i < count; i++) {
        delta.trail.push({
          x: dequantizePosition(reader.readU16(), mapSize),
          y: dequantizePosition(reader.readU16(), mapSize),
        });
      }
    }
    
    return delta;
  }
  
  /**
   * Read event
   */
  readEvent(reader, mapSize) {
    const type = reader.readU8();
    const event = { type };
    
    switch (type) {
      case EventType.PLAYER_JOIN:
        event.player = this.readPlayerFull(reader, mapSize);
        break;
        
      case EventType.PLAYER_LEAVE:
        event.num = reader.readU16();
        event.silent = reader.readU8() === 1;
        break;
        
      case EventType.PLAYER_KILL:
        event.killerNum = reader.readU16();
        event.victimNum = reader.readU16();
        event.killType = reader.readU8();
        break;
        
      case EventType.COIN_SPAWN:
        event.id = reader.readU16();
        event.x = dequantizePosition(reader.readU16(), mapSize);
        event.y = dequantizePosition(reader.readU16(), mapSize);
        event.value = reader.readU8();
        break;
        
      case EventType.COIN_PICKUP:
        event.id = reader.readU16();
        event.playerNum = reader.readU16();
        break;
        
      case EventType.HITSCAN:
        // Optimized: server only sends player IDs, client calculates positions
        event.ownerNum = reader.readU16();
        event.targetNum = reader.readU16();
        event.damage = reader.readU8();
        // fromX, fromY, toX, toY will be calculated by game-client from player positions
        break;
        
      case EventType.CAPTURE:
        event.playerNum = reader.readU16();
        event.x = dequantizePosition(reader.readU16(), mapSize);
        event.y = dequantizePosition(reader.readU16(), mapSize);
        event.xpGained = reader.readU8();
        break;
        
      case EventType.LEVEL_UP:
        event.playerNum = reader.readU16();
        event.newLevel = reader.readU8();
        break;
        
      case EventType.SNIP_START:
        event.playerNum = reader.readU16();
        event.snipperNum = reader.readU16();
        break;
    }
    
    return event;
  }
  
  /**
   * Handle pong
   */
  handlePong(view) {
    const sentTime = view.getFloat64(1, true);
    this.rtt = performance.now() - sentTime;
  }
  
  /**
   * Handle dead packet
   */
  handleDead(view) {
    const killerNum = view.getUint16(1, true);
    const killType = view.getUint8(3);
    
    this.onEvent({
      type: 'dead',
      killerNum,
      killType,
    });
  }
  
  /**
   * Handle WebSocket close
   */
  handleClose(event) {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.ws = null;
    
    if (this.state !== ConnectionState.DISCONNECTED) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket error
   */
  handleError(event) {
    console.error('WebSocket error:', event);
    this.onError(new Error('WebSocket error'));
  }
  
  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    this.setState(ConnectionState.RECONNECTING);
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (this.state === ConnectionState.RECONNECTING) {
        this.setState(ConnectionState.DISCONNECTED);
        this.connect(this.playerName);
      }
    }, delay);
  }
  
  /**
   * Set connection state
   */
  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange(state);
    }
  }
  
  /**
   * Get current RTT
   */
  getRTT() {
    return this.rtt;
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED;
  }
}

export { NetClient };
