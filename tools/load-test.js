/**
 * Load Test for SwarmBlitz
 * 
 * Tests the new Cloudflare Workers + Durable Objects backend
 * with bandwidth metrics tracking.
 * 
 * Usage:
 *   node tools/load-test.js [botCount] [wsUrl] [durationMs]
 * 
 * Example:
 *   node tools/load-test.js 50 ws://localhost:8787/room/default 30000
 */

import WebSocket from "ws";
import { PacketType, Quant } from "../src/net/protocol.js";

const targetCount = parseInt(process.argv[2] || "50", 10);
const url = process.argv[3] || "ws://localhost:8787/room/default";
const durationMs = parseInt(process.argv[4] || "30000", 10);

// Metrics
let bytesIn = 0;
let bytesOut = 0;
let packetsIn = 0;
let packetsOut = 0;
let connected = 0;
let ready = 0;
let maxConnected = 0;

// Per-second tracking
const secondMetrics = [];
let currentSecondIn = 0;
let currentSecondOut = 0;
let lastSecondTime = Date.now();

const sockets = [];
const botData = new Map(); // ws -> { playerId, lastX, lastY }

/**
 * Track bytes for a message
 */
function trackBytes(data) {
  if (!data) return 0;
  if (Buffer.isBuffer(data)) return data.length;
  if (data.byteLength) return data.byteLength;
  if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
  return 0;
}

/**
 * Create input packet (binary)
 */
function createInputPacket(angle) {
  const buffer = Buffer.alloc(3);
  buffer.writeUInt8(PacketType.INPUT, 0);
  
  // Quantize angle to 0-65535
  const normalized = (angle + Math.PI) / (Math.PI * 2);
  const quantized = Math.round(normalized * Quant.ANGLE_SCALE) & 0xFFFF;
  buffer.writeUInt16LE(quantized, 1);
  
  return buffer;
}

/**
 * Spawn a bot
 */
function spawnBot(idx) {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  
  const data = { playerId: null, lastX: 0, lastY: 0, angle: Math.random() * Math.PI * 2 };
  botData.set(ws, data);
  
  ws.on("open", () => {
    connected += 1;
    maxConnected = Math.max(maxConnected, connected);
    
    // Send hello (JSON for initial handshake)
    const hello = JSON.stringify({
      type: 'hello',
      name: `[LOAD]${idx}`,
    });
    const helloBytes = trackBytes(hello);
    bytesOut += helloBytes;
    currentSecondOut += helloBytes;
    packetsOut += 1;
    ws.send(hello);
  });
  
  ws.on("message", (raw) => {
    const bytes = trackBytes(raw);
    bytesIn += bytes;
    currentSecondIn += bytes;
    packetsIn += 1;
    
    // Handle binary messages
    if (raw instanceof ArrayBuffer || Buffer.isBuffer(raw)) {
      const view = new DataView(raw instanceof ArrayBuffer ? raw : raw.buffer);
      const type = view.getUint8(0);
      
      if (type === PacketType.FRAME) {
        // Frame update - bot is receiving game state
        // Could parse and track delta sizes here
      }
      return;
    }
    
    // Handle JSON messages
    try {
      const msg = JSON.parse(raw.toString());
      
      if (msg.type === 'init') {
        ready += 1;
        data.playerId = msg.playerId;
        if (msg.player) {
          data.lastX = msg.player.x;
          data.lastY = msg.player.y;
        }
      } else if (msg.type === 'error') {
        console.error(`Bot ${idx} error:`, msg.error);
        ws.close();
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  ws.on("close", () => {
    connected = Math.max(0, connected - 1);
    botData.delete(ws);
  });
  
  ws.on("error", (err) => {
    console.error(`Bot ${idx} WebSocket error:`, err.message);
  });
  
  sockets.push(ws);
}

/**
 * Record per-second metrics
 */
function recordSecondMetrics() {
  const now = Date.now();
  const elapsed = (now - lastSecondTime) / 1000;
  
  if (elapsed >= 1) {
    secondMetrics.push({
      inBps: currentSecondIn / elapsed,
      outBps: currentSecondOut / elapsed,
      connected,
      ready,
    });
    
    currentSecondIn = 0;
    currentSecondOut = 0;
    lastSecondTime = now;
  }
}

// Spawn bots with staggered timing
console.log(`[LOAD] Starting ${targetCount} bots connecting to ${url}`);
console.log(`[LOAD] Duration: ${durationMs / 1000}s`);
console.log('');

for (let i = 0; i < targetCount; i++) {
  setTimeout(() => spawnBot(i), i * 20); // 20ms between spawns
}

// Send inputs periodically (4 Hz - typical for .io games)
const inputInterval = setInterval(() => {
  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    
    const data = botData.get(ws);
    if (!data) continue;
    
    // Random angle change
    data.angle += (Math.random() - 0.5) * 0.5;
    
    const payload = createInputPacket(data.angle);
    const bytes = trackBytes(payload);
    bytesOut += bytes;
    currentSecondOut += bytes;
    packetsOut += 1;
    ws.send(payload);
  }
}, 250);

// Record metrics every 100ms
const metricsInterval = setInterval(recordSecondMetrics, 100);

// Progress logging
const progressInterval = setInterval(() => {
  const elapsed = (Date.now() - startTime) / 1000;
  const inBps = bytesIn / elapsed;
  const outBps = bytesOut / elapsed;
  
  process.stdout.write(`\r[LOAD] ${elapsed.toFixed(0)}s | connected=${connected}/${targetCount} ready=${ready} | in=${formatBytes(inBps)}/s out=${formatBytes(outBps)}/s`);
}, 1000);

const startTime = Date.now();

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

// End test
setTimeout(() => {
  clearInterval(inputInterval);
  clearInterval(metricsInterval);
  clearInterval(progressInterval);
  
  // Close all connections
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }
  
  setTimeout(() => {
    const seconds = durationMs / 1000;
    const avgInBps = bytesIn / seconds;
    const avgOutBps = bytesOut / seconds;
    const avgInPps = packetsIn / seconds;
    const avgOutPps = packetsOut / seconds;
    
    // Calculate per-player bandwidth
    const perPlayerInBps = ready > 0 ? avgInBps / ready : 0;
    const perPlayerOutBps = ready > 0 ? avgOutBps / ready : 0;
    
    // Calculate peak bandwidth
    let peakInBps = 0;
    let peakOutBps = 0;
    for (const m of secondMetrics) {
      peakInBps = Math.max(peakInBps, m.inBps);
      peakOutBps = Math.max(peakOutBps, m.outBps);
    }
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    LOAD TEST RESULTS                       ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  CONNECTIONS');
    console.log(`    Target:        ${targetCount}`);
    console.log(`    Max Connected: ${maxConnected}`);
    console.log(`    Ready:         ${ready}`);
    console.log('');
    console.log('  BANDWIDTH (Total)');
    console.log(`    Avg In:        ${formatBytes(avgInBps)}/s`);
    console.log(`    Avg Out:       ${formatBytes(avgOutBps)}/s`);
    console.log(`    Peak In:       ${formatBytes(peakInBps)}/s`);
    console.log(`    Peak Out:      ${formatBytes(peakOutBps)}/s`);
    console.log('');
    console.log('  BANDWIDTH (Per Player)');
    console.log(`    Avg In:        ${formatBytes(perPlayerInBps)}/s`);
    console.log(`    Avg Out:       ${formatBytes(perPlayerOutBps)}/s`);
    console.log('');
    console.log('  PACKETS');
    console.log(`    Total In:      ${packetsIn} (${avgInPps.toFixed(1)}/s)`);
    console.log(`    Total Out:     ${packetsOut} (${avgOutPps.toFixed(1)}/s)`);
    console.log('');
    console.log('  DATA TRANSFERRED');
    console.log(`    Total In:      ${formatBytes(bytesIn)}`);
    console.log(`    Total Out:     ${formatBytes(bytesOut)}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Cost estimation (Cloudflare Workers pricing)
    const gbTransferred = (bytesIn + bytesOut) / (1024 * 1024 * 1024);
    const estimatedCostPer1M = gbTransferred * 0.045; // $0.045 per GB after free tier
    console.log('');
    console.log('  COST ESTIMATE (Cloudflare Workers)');
    console.log(`    Data transferred: ${(gbTransferred * 1000).toFixed(2)} MB`);
    console.log(`    Est. cost/1M requests: $${estimatedCostPer1M.toFixed(4)}`);
    console.log('');
    
    process.exit(0);
  }, 1000);
}, durationMs);
