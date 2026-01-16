/**
 * Binary Protocol Definition for SwarmBlitz
 * 
 * Design goals:
 * - Minimal bytes per update (quantized positions, bit-packed flags)
 * - Delta-only replication (only send what changed)
 * - Batched frames (one packet per network tick)
 * 
 * Packet structure:
 * [1 byte: packet type][variable: payload]
 */

// Packet types (1 byte)
export const PacketType = {
  // Client -> Server
  HELLO: 0x01,
  INPUT: 0x02,
  PING: 0x03,
  
  // Server -> Client
  HELLO_ACK: 0x10,
  INIT: 0x11,
  FRAME: 0x12,
  DEAD: 0x13,
  PONG: 0x14,
};

// Entity flags (bit-packed into 1 byte)
export const EntityFlags = {
  DEAD: 0x01,
  SNIPPED: 0x02,
  IN_TERRITORY: 0x04,
  HAS_TRAIL: 0x08,
  TERRITORY_DIRTY: 0x10,
};

// Delta flags (what changed this frame)
export const DeltaFlags = {
  POSITION: 0x01,
  ANGLE: 0x02,
  HP: 0x04,
  XP: 0x08,
  LEVEL: 0x10,
  DRONES: 0x20,
  TERRITORY: 0x40,
  TRAIL: 0x80,
};

// Event types for batched events
export const EventType = {
  PLAYER_JOIN: 0x01,
  PLAYER_LEAVE: 0x02,
  PLAYER_KILL: 0x03,
  COIN_SPAWN: 0x04,
  COIN_PICKUP: 0x05,
  HITSCAN: 0x06,
  CAPTURE: 0x07,
  LEVEL_UP: 0x08,
  SNIP_START: 0x09,
  SNIP_END: 0x0A,
};

// Quantization constants
export const Quant = {
  // Position: 16-bit unsigned (0-65535) maps to map coordinates
  // Map is typically 4000x4000, so 1 unit = ~0.06 pixels (plenty precise)
  POS_BITS: 16,
  POS_MAX: 65535,
  
  // Angle: 8-bit (0-255) maps to 0-2π radians for server->client
  // Resolution: ~1.4 degrees per step (good enough for smooth movement)
  ANGLE_BITS: 8,
  ANGLE_MAX: 255,
  
  // Angle: 16-bit (0-65535) for client->server input (higher precision)
  ANGLE_SCALE: 65535,
  
  // HP: 8-bit (0-255)
  HP_BITS: 8,
  HP_MAX: 255,
  
  // XP: 16-bit (0-65535)
  XP_BITS: 16,
  XP_MAX: 65535,
  
  // Level: 8-bit (1-255)
  LEVEL_BITS: 8,
  LEVEL_MAX: 255,
  
  // Drone position offset from player: 8-bit signed (-128 to 127)
  DRONE_OFFSET_BITS: 8,
  
  // Territory point count: 8-bit (max 255 points per territory)
  TERRITORY_POINTS_MAX: 255,
  
  // Trail point count: 8-bit
  TRAIL_POINTS_MAX: 255,
};

/**
 * Quantize a world position to 16-bit
 * @param {number} value - World coordinate
 * @param {number} mapSize - Total map size
 * @returns {number} Quantized value (0-65535)
 */
export function quantizePosition(value, mapSize) {
  const normalized = Math.max(0, Math.min(1, value / mapSize));
  return Math.round(normalized * Quant.POS_MAX);
}

/**
 * Dequantize a 16-bit position back to world coordinates
 * @param {number} quantized - Quantized value (0-65535)
 * @param {number} mapSize - Total map size
 * @returns {number} World coordinate
 */
export function dequantizePosition(quantized, mapSize) {
  return (quantized / Quant.POS_MAX) * mapSize;
}

/**
 * Quantize an angle (radians) to 8-bit
 * @param {number} angle - Angle in radians
 * @returns {number} Quantized value (0-255)
 */
export function quantizeAngle(angle) {
  // Normalize to 0-2π
  let normalized = angle % (Math.PI * 2);
  if (normalized < 0) normalized += Math.PI * 2;
  return Math.round((normalized / (Math.PI * 2)) * Quant.ANGLE_MAX);
}

/**
 * Dequantize an 8-bit angle back to radians
 * @param {number} quantized - Quantized value (0-255)
 * @returns {number} Angle in radians
 */
export function dequantizeAngle(quantized) {
  return (quantized / Quant.ANGLE_MAX) * Math.PI * 2;
}

/**
 * Quantize HP to 8-bit
 * @param {number} hp - Current HP
 * @param {number} maxHp - Maximum HP
 * @returns {number} Quantized value (0-255)
 */
export function quantizeHP(hp, maxHp) {
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  return Math.round(ratio * Quant.HP_MAX);
}

/**
 * Dequantize 8-bit HP
 * @param {number} quantized - Quantized value (0-255)
 * @param {number} maxHp - Maximum HP
 * @returns {number} HP value
 */
export function dequantizeHP(quantized, maxHp) {
  return (quantized / Quant.HP_MAX) * maxHp;
}

// Color encoding: HSL packed into 3 bytes (H: 8-bit, S: 4-bit, L: 4-bit)
export function encodeColor(hue, sat, lum) {
  const h = Math.round(hue * 255);
  const s = Math.round(sat * 15);
  const l = Math.round(lum * 15);
  return (h << 8) | (s << 4) | l;
}

export function decodeColor(packed) {
  const h = (packed >> 8) & 0xFF;
  const s = (packed >> 4) & 0x0F;
  const l = packed & 0x0F;
  return {
    hue: h / 255,
    sat: s / 15,
    lum: l / 15,
  };
}

