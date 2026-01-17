/**
 * Binary Codec for SwarmBlitz
 * 
 * Encodes/decodes packets using ArrayBuffer for minimal bandwidth.
 * Uses DataView for cross-platform byte order consistency.
 */

import {
  PacketType,
  EntityFlags,
  DeltaFlags,
  EventType,
  Quant,
  quantizePosition,
  dequantizePosition,
  quantizeAngle,
  dequantizeAngle,
  quantizeHP,
  dequantizeHP,
  encodeColor,
  decodeColor,
} from './protocol.js';

/**
 * Binary writer helper
 * Optimized with reset() for pooling and reuse
 */
class BinaryWriter {
  constructor(initialSize = 256) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
    this._textEncoder = new TextEncoder(); // Reuse encoder
  }
  
  /**
   * Reset writer for reuse (pooling optimization)
   */
  reset() {
    this.offset = 0;
  }
  
  ensureCapacity(bytes) {
    if (this.offset + bytes > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.offset + bytes);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }
  
  writeU8(value) {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset++, value);
  }
  
  writeU16(value) {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true); // little-endian
    this.offset += 2;
  }
  
  writeU32(value) {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }
  
  writeI8(value) {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset++, value);
  }
  
  writeI16(value) {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }
  
  writeF32(value) {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }
  
  writeString(str) {
    const encoded = this._textEncoder.encode(str);
    this.writeU8(Math.min(encoded.length, 255));
    this.ensureCapacity(encoded.length);
    new Uint8Array(this.buffer, this.offset, encoded.length).set(encoded.slice(0, 255));
    this.offset += Math.min(encoded.length, 255);
  }
  
  writeBytes(bytes) {
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer, this.offset, bytes.length).set(bytes);
    this.offset += bytes.length;
  }
  
  toArrayBuffer() {
    return this.buffer.slice(0, this.offset);
  }
}

/**
 * BinaryWriter pool for reducing allocations
 * Writers are acquired, used, and released back to the pool
 */
class BinaryWriterPool {
  constructor(poolSize = 16, initialWriterSize = 512) {
    this._pool = [];
    this._initialWriterSize = initialWriterSize;
    // Pre-populate pool
    for (let i = 0; i < poolSize; i++) {
      this._pool.push(new BinaryWriter(initialWriterSize));
    }
  }
  
  /**
   * Acquire a writer from the pool (or create new if empty)
   */
  acquire() {
    if (this._pool.length > 0) {
      const writer = this._pool.pop();
      writer.reset();
      return writer;
    }
    return new BinaryWriter(this._initialWriterSize);
  }
  
  /**
   * Release a writer back to the pool
   */
  release(writer) {
    // Only pool writers up to a reasonable size to avoid memory bloat
    if (writer.buffer.byteLength <= 8192) {
      writer.reset();
      this._pool.push(writer);
    }
  }
}

/**
 * Binary reader helper
 */
class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }
  
  readU8() {
    return this.view.getUint8(this.offset++);
  }
  
  readU16() {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }
  
  readU32() {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }
  
  readI8() {
    return this.view.getInt8(this.offset++);
  }
  
  readI16() {
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }
  
  readF32() {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }
  
  readString() {
    const len = this.readU8();
    const bytes = new Uint8Array(this.buffer, this.offset, len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }
  
  readBytes(length) {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }
  
  hasMore() {
    return this.offset < this.buffer.byteLength;
  }
}

// ============================================
// ENCODING FUNCTIONS (Server -> Client)
// ============================================

/**
 * Encode HELLO_ACK packet
 */
export function encodeHelloAck(ok, error = '') {
  const w = new BinaryWriter(64);
  w.writeU8(PacketType.HELLO_ACK);
  w.writeU8(ok ? 1 : 0);
  if (!ok) {
    w.writeString(error);
  }
  return w.toArrayBuffer();
}

/**
 * Encode INIT packet (full state snapshot for a joining player)
 */
export function encodeInit(data, mapSize) {
  const w = new BinaryWriter(4096);
  w.writeU8(PacketType.INIT);
  
  // Player's own ID
  w.writeU16(data.num);
  
  // Frame number
  w.writeU32(data.frame);
  
  // Map size (for client-side dequantization)
  w.writeU16(mapSize);
  
  // Player count
  w.writeU8(data.players.length);
  
  // Encode each player
  for (const p of data.players) {
    encodePlayerFull(w, p, mapSize);
  }
  
  // Coin count
  w.writeU8(data.coins ? data.coins.length : 0);
  
  // Encode coins
  if (data.coins) {
    for (const c of data.coins) {
      w.writeU16(c.id);
      w.writeU16(quantizePosition(c.x, mapSize));
      w.writeU16(quantizePosition(c.y, mapSize));
      w.writeU8(c.value);
    }
  }
  
  return w.toArrayBuffer();
}

/**
 * Encode a full player state (used in INIT)
 */
function encodePlayerFull(w, p, mapSize) {
  // ID
  w.writeU16(p.num);
  
  // Name
  w.writeString(p.name || '');
  
  // Color (packed HSL)
  const colorPacked = encodeColor(
    p.base?.hue ?? p.baseColor?.hue ?? 0.5,
    p.base?.sat ?? p.baseColor?.sat ?? 0.8,
    p.base?.lum ?? p.baseColor?.lum ?? 0.5
  );
  w.writeU16(colorPacked);
  
  // Position
  w.writeU16(quantizePosition(p.x, mapSize));
  w.writeU16(quantizePosition(p.y, mapSize));
  
  // Angle
  w.writeU8(quantizeAngle(p.angle));
  
  // HP (as ratio 0-255)
  const maxHp = p.maxHp || 100;
  w.writeU8(quantizeHP(p.hp ?? maxHp, maxHp));
  
  // Level
  w.writeU8(p.level || 1);
  
  // XP
  w.writeU16(p.xp || 0);
  
  // Size scale (quantized to 8-bit, 1.0 = 100, range 0.5-2.5)
  const sizeScaleQ = Math.round(((p.sizeScale || 1.0) - 0.5) * 50);
  w.writeU8(Math.max(0, Math.min(255, sizeScaleQ)));
  
  // Flags
  let flags = 0;
  if (p.dead) flags |= EntityFlags.DEAD;
  if (p.isSnipped) flags |= EntityFlags.SNIPPED;
  if (p.territory && p.territory.length > 0) flags |= EntityFlags.TERRITORY_DIRTY;
  if (p.trail && p.trail.length > 0) flags |= EntityFlags.HAS_TRAIL;
  w.writeU8(flags);
  
  // Territory (simplified: just point count + points)
  const territory = p.territory || [];
  const territoryCount = Math.min(territory.length, Quant.TERRITORY_POINTS_MAX);
  w.writeU8(territoryCount);
  for (let i = 0; i < territoryCount; i++) {
    w.writeU16(quantizePosition(territory[i].x, mapSize));
    w.writeU16(quantizePosition(territory[i].y, mapSize));
  }
  
  // Trail (U16 count to support longer trails)
  const trail = p.trail || [];
  w.writeU16(trail.length);
  for (let i = 0; i < trail.length; i++) {
    w.writeU16(quantizePosition(trail[i].x, mapSize));
    w.writeU16(quantizePosition(trail[i].y, mapSize));
  }
  
  // Drones
  const drones = p.drones || [];
  w.writeU8(drones.length);
  for (const d of drones) {
    w.writeU16(d.id);
    // Drone position as offset from player (saves bytes)
    const dx = Math.round(d.x - p.x);
    const dy = Math.round(d.y - p.y);
    w.writeI8(Math.max(-128, Math.min(127, dx)));
    w.writeI8(Math.max(-128, Math.min(127, dy)));
    w.writeU8(d.targetId !== null ? d.targetId : 255); // 255 = no target
  }
}

/**
 * Encode FRAME packet (delta update)
 * This is the main bandwidth-critical packet
 */
export function encodeFrame(data, mapSize) {
  const w = new BinaryWriter(2048);
  w.writeU8(PacketType.FRAME);
  
  // Frame number
  w.writeU32(data.frame);
  
  // Server tick timestamp (for interpolation)
  w.writeU32(data.serverTime || Date.now());
  
  // === PLAYER DELTAS ===
  const playerDeltas = data.playerDeltas || [];
  w.writeU8(playerDeltas.length);
  
  for (const delta of playerDeltas) {
    w.writeU16(delta.num);
    w.writeU8(delta.flags); // DeltaFlags bitmask
    
    if (delta.flags & DeltaFlags.POSITION) {
      w.writeU16(quantizePosition(delta.x, mapSize));
      w.writeU16(quantizePosition(delta.y, mapSize));
    }
    
    if (delta.flags & DeltaFlags.ANGLE) {
      w.writeU8(quantizeAngle(delta.angle));
    }
    
    if (delta.flags & DeltaFlags.HP) {
      w.writeU8(delta.hp); // Already 0-255
    }
    
    if (delta.flags & DeltaFlags.XP) {
      w.writeU16(delta.xp);
    }
    
    if (delta.flags & DeltaFlags.LEVEL) {
      w.writeU8(delta.level);
    }
    
    if (delta.flags & DeltaFlags.DRONES) {
      // Only send drone count, client simulates positions
      w.writeU8(delta.droneCount || 0);
    }
    
    if (delta.flags & DeltaFlags.TERRITORY) {
      const territory = delta.territory || [];
      w.writeU8(Math.min(territory.length, 255));
      for (let i = 0; i < Math.min(territory.length, 255); i++) {
        w.writeU16(quantizePosition(territory[i].x, mapSize));
        w.writeU16(quantizePosition(territory[i].y, mapSize));
      }
    }
    
    if (delta.flags & DeltaFlags.TRAIL) {
      const trail = delta.trail || [];
      w.writeU16(trail.length);
      for (let i = 0; i < trail.length; i++) {
        w.writeU16(quantizePosition(trail[i].x, mapSize));
        w.writeU16(quantizePosition(trail[i].y, mapSize));
      }
    }
  }
  
  // === EVENTS ===
  const events = data.events || [];
  w.writeU8(events.length);
  
  for (const evt of events) {
    w.writeU8(evt.type);
    
    switch (evt.type) {
      case EventType.PLAYER_JOIN:
        encodePlayerFull(w, evt.player, mapSize);
        break;
        
      case EventType.PLAYER_LEAVE:
        w.writeU16(evt.num);
        w.writeU8(evt.silent ? 1 : 0); // Silent = left AOI, not death
        break;
        
      case EventType.PLAYER_KILL:
        w.writeU16(evt.killerNum);
        w.writeU16(evt.victimNum);
        w.writeU8(evt.killType); // 0=collision, 1=snip, 2=drone
        break;
        
      case EventType.COIN_SPAWN:
        w.writeU16(evt.id);
        w.writeU16(quantizePosition(evt.x, mapSize));
        w.writeU16(quantizePosition(evt.y, mapSize));
        w.writeU8(evt.value);
        break;
        
      case EventType.COIN_PICKUP:
        w.writeU16(evt.id);
        w.writeU16(evt.playerNum);
        break;
        
      case EventType.HITSCAN:
        // Optimized: only send player IDs, client calculates positions
        w.writeU16(evt.ownerNum);
        w.writeU16(evt.targetNum);
        w.writeU8(evt.damage);
        break;
        
      case EventType.CAPTURE:
        w.writeU16(evt.playerNum);
        w.writeU16(quantizePosition(evt.x, mapSize));
        w.writeU16(quantizePosition(evt.y, mapSize));
        w.writeU8(evt.xpGained);
        break;
        
      case EventType.LEVEL_UP:
        w.writeU16(evt.playerNum);
        w.writeU8(evt.newLevel);
        break;
        
      case EventType.SNIP_START:
        w.writeU16(evt.playerNum);
        w.writeU16(evt.snipperNum);
        break;
        
      case EventType.SNIP_END:
        w.writeU16(evt.playerNum);
        w.writeU8(evt.survived ? 1 : 0);
        break;
    }
  }
  
  return w.toArrayBuffer();
}

/**
 * Encode DEAD packet
 */
export function encodeDead() {
  const w = new BinaryWriter(1);
  w.writeU8(PacketType.DEAD);
  return w.toArrayBuffer();
}

/**
 * Encode PONG packet
 */
export function encodePong(clientTime) {
  const w = new BinaryWriter(9);
  w.writeU8(PacketType.PONG);
  w.writeU32(clientTime);
  w.writeU32(Date.now());
  return w.toArrayBuffer();
}

// ============================================
// DECODING FUNCTIONS (Client -> Server)
// ============================================

/**
 * Decode any incoming packet
 */
export function decodePacket(buffer) {
  const r = new BinaryReader(buffer);
  const type = r.readU8();
  
  switch (type) {
    case PacketType.HELLO:
      return { type, data: decodeHello(r) };
    case PacketType.INPUT:
      return { type, data: decodeInput(r) };
    case PacketType.PING:
      return { type, data: decodePing(r) };
    default:
      return { type, data: null };
  }
}

function decodeHello(r) {
  return {
    name: r.readString(),
    viewportWidth: r.readU16(),
    viewportHeight: r.readU16(),
  };
}

function decodeInput(r) {
  return {
    frame: r.readU32(),
    targetAngle: dequantizeAngle(r.readU8()),
  };
}

function decodePing(r) {
  return {
    clientTime: r.readU32(),
  };
}

// ============================================
// CLIENT-SIDE ENCODING (Client -> Server)
// ============================================

/**
 * Encode HELLO packet (client joining)
 */
export function encodeHello(name, viewportWidth, viewportHeight) {
  const w = new BinaryWriter(64);
  w.writeU8(PacketType.HELLO);
  w.writeString(name);
  w.writeU16(viewportWidth);
  w.writeU16(viewportHeight);
  return w.toArrayBuffer();
}

/**
 * Encode INPUT packet (client input)
 */
export function encodeInput(frame, targetAngle) {
  const w = new BinaryWriter(6);
  w.writeU8(PacketType.INPUT);
  w.writeU32(frame);
  w.writeU8(quantizeAngle(targetAngle));
  return w.toArrayBuffer();
}

/**
 * Encode PING packet
 */
export function encodePing() {
  const w = new BinaryWriter(5);
  w.writeU8(PacketType.PING);
  w.writeU32(Date.now());
  return w.toArrayBuffer();
}

// ============================================
// CLIENT-SIDE DECODING (Server -> Client)
// ============================================

/**
 * Decode server packet on client
 */
export function decodeServerPacket(buffer, mapSize) {
  const r = new BinaryReader(buffer);
  const type = r.readU8();
  
  switch (type) {
    case PacketType.HELLO_ACK:
      return { type, data: decodeHelloAck(r) };
    case PacketType.INIT:
      return { type, data: decodeInit(r) };
    case PacketType.FRAME:
      return { type, data: decodeFrame(r, mapSize) };
    case PacketType.DEAD:
      return { type, data: {} };
    case PacketType.PONG:
      return { type, data: decodePong(r) };
    default:
      return { type, data: null };
  }
}

function decodeHelloAck(r) {
  const ok = r.readU8() === 1;
  let error = '';
  if (!ok) {
    error = r.readString();
  }
  return { ok, error };
}

function decodeInit(r) {
  const num = r.readU16();
  const frame = r.readU32();
  const mapSize = r.readU16();
  
  const playerCount = r.readU8();
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(decodePlayerFull(r, mapSize));
  }
  
  const coinCount = r.readU8();
  const coins = [];
  for (let i = 0; i < coinCount; i++) {
    coins.push({
      id: r.readU16(),
      x: dequantizePosition(r.readU16(), mapSize),
      y: dequantizePosition(r.readU16(), mapSize),
      value: r.readU8(),
    });
  }
  
  return { num, frame, mapSize, players, coins };
}

function decodePlayerFull(r, mapSize) {
  // Must match server encoding order in room.js writePlayerFull()
  const num = r.readU16();
  const name = r.readString();
  const x = dequantizePosition(r.readU16(), mapSize);
  const y = dequantizePosition(r.readU16(), mapSize);
  const angle = dequantizeAngle16(r.readU16()); // Server uses 16-bit angle
  const hpRatio = r.readU8() / 255;
  const level = r.readU8();
  const xp = r.readU16();
  const sizeScaleQ = r.readU8();
  const sizeScale = sizeScaleQ / 100; // Server writes sizeScale * 100
  const flags = r.readU8();
  
  // Color is 3 separate bytes (hue, sat, lum)
  const hue = r.readU8() / 255; // Decode from 0-255 to 0-1
  const sat = r.readU8() / 255;
  const lum = r.readU8() / 255;
  const color = { hue, sat, lum };
  
  const territoryCount = r.readU8();
  const territory = [];
  for (let i = 0; i < territoryCount; i++) {
    territory.push({
      x: dequantizePosition(r.readU16(), mapSize),
      y: dequantizePosition(r.readU16(), mapSize),
    });
  }
  
  const trailCount = r.readU16();
  const trail = [];
  for (let i = 0; i < trailCount; i++) {
    trail.push({
      x: dequantizePosition(r.readU16(), mapSize),
      y: dequantizePosition(r.readU16(), mapSize),
    });
  }
  
  // Drones - only receive count, client simulates positions based on level
  const droneCount = r.readU8();
  
  return {
    num,
    name,
    base: color,
    x,
    y,
    angle,
    hp: hpRatio * 100, // Assume maxHp = 100
    maxHp: 100,
    level,
    xp,
    sizeScale,
    dead: !!(flags & EntityFlags.DEAD),
    isSnipped: !!(flags & EntityFlags.SNIPPED),
    territory,
    trail,
    droneCount, // Client uses this to simulate drones
  };
}

// Helper for 16-bit angle decoding
function dequantizeAngle16(quantized) {
  return (quantized / 65535) * Math.PI * 2;
}

function decodeFrame(r, mapSize) {
  const frame = r.readU32();
  const serverTime = r.readU32();
  
  const deltaCount = r.readU8();
  const playerDeltas = [];
  
  for (let i = 0; i < deltaCount; i++) {
    const num = r.readU16();
    const flags = r.readU8();
    const delta = { num, flags };
    
    if (flags & DeltaFlags.POSITION) {
      delta.x = dequantizePosition(r.readU16(), mapSize);
      delta.y = dequantizePosition(r.readU16(), mapSize);
    }
    
    if (flags & DeltaFlags.ANGLE) {
      delta.angle = dequantizeAngle(r.readU8());
    }
    
    if (flags & DeltaFlags.HP) {
      delta.hp = r.readU8();
    }
    
    if (flags & DeltaFlags.XP) {
      delta.xp = r.readU16();
    }
    
    if (flags & DeltaFlags.LEVEL) {
      delta.level = r.readU8();
    }
    
    if (flags & DeltaFlags.DRONES) {
      // Only receive drone count, client simulates positions
      delta.droneCount = r.readU8();
    }
    
    if (flags & DeltaFlags.TERRITORY) {
      const count = r.readU8();
      delta.territory = [];
      for (let j = 0; j < count; j++) {
        delta.territory.push({
          x: dequantizePosition(r.readU16(), mapSize),
          y: dequantizePosition(r.readU16(), mapSize),
        });
      }
    }
    
    if (flags & DeltaFlags.TRAIL) {
      const count = r.readU16();
      delta.trail = [];
      for (let j = 0; j < count; j++) {
        delta.trail.push({
          x: dequantizePosition(r.readU16(), mapSize),
          y: dequantizePosition(r.readU16(), mapSize),
        });
      }
    }
    
    playerDeltas.push(delta);
  }
  
  const eventCount = r.readU8();
  const events = [];
  
  for (let i = 0; i < eventCount; i++) {
    const evtType = r.readU8();
    const evt = { type: evtType };
    
    switch (evtType) {
      case EventType.PLAYER_JOIN:
        evt.player = decodePlayerFull(r, mapSize);
        break;
        
      case EventType.PLAYER_LEAVE:
        evt.num = r.readU16();
        evt.silent = r.readU8() === 1;
        break;
        
      case EventType.PLAYER_KILL:
        evt.killerNum = r.readU16();
        evt.victimNum = r.readU16();
        evt.killType = r.readU8();
        break;
        
      case EventType.COIN_SPAWN:
        evt.id = r.readU16();
        evt.x = dequantizePosition(r.readU16(), mapSize);
        evt.y = dequantizePosition(r.readU16(), mapSize);
        evt.value = r.readU8();
        break;
        
      case EventType.COIN_PICKUP:
        evt.id = r.readU16();
        evt.playerNum = r.readU16();
        break;
        
      case EventType.HITSCAN:
        // Optimized: only receive player IDs, client calculates positions
        evt.ownerNum = r.readU16();
        evt.targetNum = r.readU16();
        evt.damage = r.readU8();
        break;
        
      case EventType.CAPTURE:
        evt.playerNum = r.readU16();
        evt.x = dequantizePosition(r.readU16(), mapSize);
        evt.y = dequantizePosition(r.readU16(), mapSize);
        evt.xpGained = r.readU8();
        break;
        
      case EventType.LEVEL_UP:
        evt.playerNum = r.readU16();
        evt.newLevel = r.readU8();
        break;
        
      case EventType.SNIP_START:
        evt.playerNum = r.readU16();
        evt.snipperNum = r.readU16();
        break;
        
      case EventType.SNIP_END:
        evt.playerNum = r.readU16();
        evt.survived = r.readU8() === 1;
        break;
    }
    
    events.push(evt);
  }
  
  return { frame, serverTime, playerDeltas, events };
}

function decodePong(r) {
  return {
    clientTime: r.readU32(),
    serverTime: r.readU32(),
  };
}

export { BinaryWriter, BinaryReader, BinaryWriterPool };

