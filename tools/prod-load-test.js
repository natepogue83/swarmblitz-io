#!/usr/bin/env node
/**
 * Production Load Testing Script
 * 
 * Deploys to production with different bot counts and collects metrics.
 * This tests against real Cloudflare Workers infrastructure.
 * 
 * Usage: node tools/prod-load-test.js [--quick] [--levels 50,100,150]
 * 
 * WARNING: This will deploy to production and may incur costs!
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Configuration
const DEFAULT_BOT_LEVELS = [50, 100, 150, 200, 250, 300];
const DURATION_PER_LEVEL_MS = 10 * 60 * 1000; // 10 minutes per level
const WARMUP_MS = 60 * 1000; // 60 seconds warmup (longer for prod deploy)
const METRICS_PREFIX = '[METRICS]';
// Defaults to the same workers.dev host the client uses in `src/index.js`.
// You can override with `--ws-url wss://.../room/loadtest`.
const DEFAULT_PROD_WS_URL = 'wss://swarmblitz.dev-1dd.workers.dev/room/loadtest';
const DEFAULT_WORKER_NAME = 'swarmblitz';

// Results storage
const results = {
  startTime: new Date().toISOString(),
  environment: 'production',
  config: {
    botLevels: [],
    durationPerLevelMs: DURATION_PER_LEVEL_MS,
    warmupMs: WARMUP_MS,
  },
  levels: [],
};

let incrementalSavePath = null;
let activeRunConfig = null;

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    botLevels: DEFAULT_BOT_LEVELS,
    durationMs: DURATION_PER_LEVEL_MS,
    quick: false,
    wsUrl: DEFAULT_PROD_WS_URL,
    workerName: DEFAULT_WORKER_NAME,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--quick') {
      config.quick = true;
      config.durationMs = 3 * 60 * 1000; // 3 minutes per level
      config.botLevels = [50, 100, 150, 200];
    } else if (args[i] === '--duration' && args[i + 1]) {
      config.durationMs = parseInt(args[i + 1]) * 60 * 1000;
      i++;
    } else if (args[i] === '--levels' && args[i + 1]) {
      config.botLevels = args[i + 1].split(',').map(n => parseInt(n.trim()));
      i++;
    } else if (args[i] === '--ws-url' && args[i + 1]) {
      config.wsUrl = args[i + 1];
      i++;
    } else if (args[i] === '--worker' && args[i + 1]) {
      config.workerName = args[i + 1];
      i++;
    }
  }
  
  return config;
}

/**
 * Update config.js with new bot count
 */
function updateBotCount(count) {
  const configPath = join(PROJECT_ROOT, 'config.js');
  
  try {
    let content = readFileSync(configPath, 'utf-8');
    
    // Replace bots value
    content = content.replace(
      /((?:"bots"|bots)\s*:\s*)\d+/g,
      `$1${count}`
    );
    
    // Scale map size with bot count
    const baseGridCount = 100;
    const baseBots = 30;
    const scaledGridCount = Math.max(baseGridCount, Math.ceil(count * (baseGridCount / baseBots)));
    
    content = content.replace(
      /((?:"GRID_COUNT"|GRID_COUNT)\s*:\s*)\d+/g,
      `$1${scaledGridCount}`
    );
    
    // Update MAX_PLAYERS to accommodate bots + test clients
    const maxPlayers = count + 10;
    content = content.replace(
      /((?:"MAX_PLAYERS"|MAX_PLAYERS)\s*:\s*)\d+/g,
      `$1${maxPlayers}`
    );
    
    writeFileSync(configPath, content);
    console.log(`[CONFIG] Updated: bots=${count}, GRID_COUNT=${scaledGridCount}, MAX_PLAYERS=${maxPlayers}`);
    return true;
  } catch (e) {
    console.error(`[CONFIG] Failed to update config: ${e.message}`);
    return false;
  }
}

/**
 * Deploy to production
 */
function deployToProduction(workerName) {
  return new Promise((resolve, reject) => {
    console.log(`[DEPLOY] Deploying Worker (${workerName})...`);
    
    try {
      // Deploy with metrics enabled (Worker deploy only; no client build)
      // Use "1" to avoid any boolean-vs-string mismatch in the Worker runtime.
      execSync('npx wrangler deploy --var METRICS_ENABLED:1', {
        cwd: PROJECT_ROOT, 
        stdio: 'inherit' 
      });
      
      console.log('[DEPLOY] Deployment complete!');
      resolve();
    } catch (e) {
      reject(new Error(`Deployment failed: ${e.message}`));
    }
  });
}

/**
 * Connect test client to production (single attempt)
 */
function connectTestClientOnce(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    let keepaliveTimer = null;
    
    ws.on('open', () => {
      console.log('[CLIENT] Connected to production');
      ws.send(JSON.stringify({ type: 'hello', name: 'LoadTest' }));

      // Keep the DO tick loop alive. Cloudflare will drop completely idle websockets.
      const sendPing = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
        }
      };
      // Send an immediate ping (the connection often drops before the first 10s interval).
      sendPing();
      keepaliveTimer = setInterval(sendPing, 2_000);
    });
    
    ws.on('message', (data) => {
      try {
        // Check for init message
        if (data.toString().startsWith('{')) {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'serverError') {
            console.error('[SERVER ERROR]', msg);
          }
          if (msg.type === 'init' && !resolved) {
            resolved = true;
            console.log('[CLIENT] Received init, player spawned');
            resolve(ws);
          }
        }
      } catch (e) {
        // Binary frame, ignore
      }
    });
    
    ws.on('error', (err) => {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
      if (!resolved) {
        reject(err);
      }
    });
    
    ws.on('close', (code, reason) => {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
      const reasonText = reason ? reason.toString() : '';
      if (!resolved) {
        reject(new Error(`WebSocket closed before init (code: ${code})${reasonText ? ` reason=${reasonText}` : ''}`));
      } else {
        console.log(`[CLIENT] Disconnected (code: ${code})${reasonText ? ` reason=${reasonText}` : ''}`);
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 30000);
  });
}

/**
 * Connect test client to production with retries
 */
async function connectTestClient(wsUrl, maxRetries = 5) {
  console.log(`[CLIENT] Connecting to ${wsUrl}...`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ws = await connectTestClientOnce(wsUrl);
      return ws;
    } catch (err) {
      console.log(`[CLIENT] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        // Wait before retry, with exponential backoff
        const delay = Math.min(2000 * attempt, 10000);
        console.log(`[CLIENT] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`Failed to connect after ${maxRetries} attempts: ${err.message}`);
      }
    }
  }
}

function waitWithSocketAbort(ms, ws) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not open'));
      return;
    }

    const onClose = (code) => {
      cleanup();
      reject(new Error(`WebSocket closed during wait (code: ${code})`));
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('close', onClose);
    };

    ws.on('close', onClose);
  });
}

// NOTE: We do NOT rely on `wrangler tail` here. In practice it can miss or buffer
// websocket/DO logs. Instead, the loadtest room exposes a gated `getMetrics` message
// (see `workers/room.js`) and we collect snapshots over the websocket.

/**
 * Calculate aggregate statistics
 */
function calculateAggregate(metrics) {
  if (metrics.length === 0) return null;
  
  const validMetrics = metrics.filter(m => m.avgTickMs > 0 && m.actualSimHz > 1);
  if (validMetrics.length === 0) return null;
  
  const avg = (arr, key) => arr.reduce((s, m) => s + m[key], 0) / arr.length;
  const minMax = (arr, key) => ({
    avg: avg(arr, key),
    min: Math.min(...arr.map(m => m[key])),
    max: Math.max(...arr.map(m => m[key])),
  });
  
  return {
    sampleCount: validMetrics.length,
    avgTickMs: minMax(validMetrics, 'avgTickMs'),
    p95TickMs: minMax(validMetrics, 'p95TickMs'),
    maxTickMs: { max: Math.max(...validMetrics.map(m => m.maxTickMs)) },
    actualSimHz: minMax(validMetrics, 'actualSimHz'),
    entities: minMax(validMetrics, 'entities'),
  };
}

/**
 * Save results incrementally
 */
function saveIncremental() {
  if (!incrementalSavePath) return;
  
  try {
    writeFileSync(incrementalSavePath, JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(`[SAVE] Failed to save: ${e.message}`);
  }
}

/**
 * Run a single level
 */
async function runLevel(botCount, durationMs, levelData, runConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[LEVEL] Testing ${botCount} bots for ${durationMs / 60000} minutes`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Update config
  if (!updateBotCount(botCount)) {
    levelData.errors.push('Failed to update config');
    return;
  }
  
  // Deploy to production
  try {
    await deployToProduction(runConfig.workerName);
  } catch (e) {
    levelData.errors.push(`Deploy failed: ${e.message}`);
    return;
  }
  
  // Wait for deployment to propagate
  console.log('[DEPLOY] Waiting 10s for deployment to propagate...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Connect test client
  let ws;
  try {
    ws = await connectTestClient(runConfig.wsUrl);
  } catch (e) {
    levelData.errors.push(`Connection failed: ${e.message}`);
    return;
  }

  // Capture metrics snapshots over the websocket connection.
  ws.on('message', (data) => {
    try {
      const text = data.toString();
      if (!text.startsWith('{')) return;
      const msg = JSON.parse(text);
      if (msg.type === 'metrics' && msg.metrics) {
        levelData.metrics.push(msg.metrics);
        console.log(
          `[METRICS] Sample #${levelData.metrics.length}: entities=${msg.metrics.entities}, avgTickMs=${msg.metrics.avgTickMs}, actualSimHz=${msg.metrics.actualSimHz}`
        );
        saveIncremental();
      }
    } catch (e) {
      // ignore
    }
  });

  const requestMetrics = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getMetrics' }));
    }
  };

  // Warmup, then collect for remaining duration.
  try {
    await waitWithSocketAbort(WARMUP_MS, ws);
  } catch (e) {
    levelData.errors.push(`Warmup aborted: ${e.message}`);
    return;
  }
  console.log('[METRICS] Warmup complete, collecting metrics...');

  // Request immediately and then every 30s.
  requestMetrics();
  const metricsTimer = setInterval(requestMetrics, 30_000);

  try {
    await waitWithSocketAbort(Math.max(0, durationMs - WARMUP_MS), ws);
  } catch (e) {
    clearInterval(metricsTimer);
    levelData.errors.push(`Collection aborted: ${e.message}`);
    return;
  }
  clearInterval(metricsTimer);

  // Final sample before close
  requestMetrics();
  await new Promise((r) => setTimeout(r, 1500));

  console.log('[METRICS] Collection complete');

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  
  // Calculate aggregates
  levelData.aggregate = calculateAggregate(levelData.metrics);
  levelData.endTime = new Date().toISOString();
}

/**
 * Main entry point
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        SWARMBLITZ PRODUCTION LOAD TESTING                     ║
║                                                               ║
║  ⚠️  WARNING: This deploys to PRODUCTION!                     ║
║  This will modify your live game and may incur costs.         ║
╚═══════════════════════════════════════════════════════════════╝
`);
  
  const config = parseArgs();
  activeRunConfig = config;
  results.config.botLevels = config.botLevels;
  results.config.durationPerLevelMs = config.durationMs;
  results.config.wsUrl = config.wsUrl;
  results.config.workerName = config.workerName;
  
  // Create reports directory
  const reportsDir = join(PROJECT_ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  
  // Set up incremental save path
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  incrementalSavePath = join(reportsDir, `prod-metrics-${timestamp}.json`);
  console.log(`[SAVE] Results will be saved to: ${incrementalSavePath}`);
  
  // Initial save
  saveIncremental();
  
  // Confirm before proceeding
  console.log('\nPress Ctrl+C within 5 seconds to cancel...\n');
  await new Promise(r => setTimeout(r, 5000));
  
  // Run each level
  for (const botCount of config.botLevels) {
    const levelData = {
      botCount,
      startTime: new Date().toISOString(),
      metrics: [],
      errors: [],
      aggregate: null,
    };
    
    results.levels.push(levelData);
    
    try {
      await runLevel(botCount, config.durationMs, levelData, config);
    } catch (e) {
      console.error(`[ERROR] Level ${botCount} failed: ${e.message}`);
      levelData.errors.push(e.message);
    }
    
    saveIncremental();
    
    // Brief pause between levels
    console.log('\n[PAUSE] Waiting 10s before next level...\n');
    await new Promise(r => setTimeout(r, 10000));
  }
  
  // Final summary
  results.endTime = new Date().toISOString();
  results.status = 'complete';
  
  // Generate summary
  results.summary = {
    levelsCompleted: results.levels.filter(l => l.metrics.length > 0).length,
    totalSamples: results.levels.reduce((s, l) => s + l.metrics.length, 0),
    scalingCurve: results.levels
      .filter(l => l.aggregate)
      .map(l => ({
        bots: l.botCount,
        samples: l.aggregate.sampleCount,
        avgTickMs: l.aggregate.avgTickMs.avg,
        p95TickMs: l.aggregate.p95TickMs.avg,
        actualSimHz: l.aggregate.actualSimHz.avg,
      })),
  };
  
  saveIncremental();
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    TEST COMPLETE                              ║
╠═══════════════════════════════════════════════════════════════╣
║  Levels completed: ${results.summary.levelsCompleted.toString().padEnd(40)}║
║  Total samples:    ${results.summary.totalSamples.toString().padEnd(40)}║
║  Report saved to:  ${incrementalSavePath.split('/').pop().padEnd(40)}║
╚═══════════════════════════════════════════════════════════════╝
`);
  
  // Restore default config
  console.log('[CLEANUP] Restoring default config (30 bots)...');
  updateBotCount(30);
  await deployToProduction(config.workerName);
}

// Handle exit signals
process.on('SIGINT', async () => {
  console.log('\n[EXIT] Interrupted, restoring default config...');
  updateBotCount(30);
  try {
    await deployToProduction(activeRunConfig?.workerName || DEFAULT_WORKER_NAME);
  } catch (e) {
    console.error('[EXIT] Failed to restore config');
  }
  process.exit(0);
});

// Run
main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});


