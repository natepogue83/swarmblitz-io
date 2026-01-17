#!/usr/bin/env node
/**
 * Automated Load Testing Script
 * 
 * Runs the server at different bot counts and collects metrics.
 * Each level runs for a configurable duration (default 10 minutes).
 * 
 * Usage: npm run dev:autometrics
 * 
 * Output: metrics-report-{timestamp}.json
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = 8787;

// Configuration
const BOT_LEVELS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const DURATION_PER_LEVEL_MS = 10 * 60 * 1000; // 10 minutes per level
const WARMUP_MS = 30 * 1000; // 30 seconds warmup before collecting metrics
const METRICS_PREFIX = '[METRICS]';

// Results storage
const results = {
  startTime: new Date().toISOString(),
  config: {
    botLevels: BOT_LEVELS,
    durationPerLevelMs: DURATION_PER_LEVEL_MS,
    warmupMs: WARMUP_MS,
  },
  levels: [],
};

// Incremental save file path (set once at start)
let incrementalSavePath = null;

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    botLevels: BOT_LEVELS,
    durationMs: DURATION_PER_LEVEL_MS,
    quick: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--quick') {
      // Quick mode: 2 minutes per level, fewer levels
      config.quick = true;
      config.durationMs = 2 * 60 * 1000;
      config.botLevels = [50, 100, 150, 200];
    } else if (args[i] === '--duration' && args[i + 1]) {
      config.durationMs = parseInt(args[i + 1]) * 60 * 1000;
      i++;
    } else if (args[i] === '--levels' && args[i + 1]) {
      config.botLevels = args[i + 1].split(',').map(n => parseInt(n.trim()));
      i++;
    }
  }
  
  return config;
}

/**
 * Kill any existing wrangler processes
 */
function killWrangler() {
  try {
    // Kill any existing wrangler processes
    execSync('pkill -9 -f "wrangler dev" 2>/dev/null || true', { stdio: 'ignore' });
    execSync('pkill -9 -f "workerd" 2>/dev/null || true', { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors - process might not exist
  }
}

/**
 * Check if port is in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * Wait for port to be free
 */
async function waitForPortFree(port, maxWaitMs = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (!(await isPortInUse(port))) {
      return true;
    }
    // Kill again in case something respawned
    killWrangler();
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

/**
 * Update config.js with new bot count and scale map size accordingly
 * Also increases MAX_PLAYERS to accommodate bots + test client
 */
function updateBotCount(count) {
  const configPath = join(PROJECT_ROOT, 'config.js');
  
  try {
    // Read existing config
    let content = readFileSync(configPath, 'utf-8');
    
    // Replace the bots value in config object
    content = content.replace(
      /((?:"bots"|bots)\s*:\s*)\d+/g,
      `$1${count}`
    );
    
    // Scale map size with bot count to prevent overcrowding
    // Base: 100 grid cells for ~30 bots, scale up proportionally
    const baseGridCount = 100;
    const baseBots = 30;
    const scaledGridCount = Math.max(baseGridCount, Math.ceil(count * (baseGridCount / baseBots)));
    
    content = content.replace(
      /((?:"GRID_COUNT"|GRID_COUNT)\s*:\s*)\d+/g,
      `$1${scaledGridCount}`
    );
    
    // Increase MAX_PLAYERS to accommodate bots + human players
    // Add 10 extra slots for human players
    const maxPlayers = count + 10;
    content = content.replace(
      /((?:"MAX_PLAYERS"|MAX_PLAYERS)\s*:\s*)\d+/g,
      `$1${maxPlayers}`
    );
    
    writeFileSync(configPath, content);
    console.log(`[CONFIG] Updated: bots=${count}, map=${scaledGridCount}x${scaledGridCount}, maxPlayers=${maxPlayers}`);
  } catch (err) {
    console.error(`[CONFIG] Error updating config:`, err.message);
  }
}

/**
 * Run wrangler dev and collect metrics for a duration
 * @param {number} botCount - Number of bots to run
 * @param {number} durationMs - Duration in milliseconds
 * @param {object} levelData - Level data object to populate (passed by reference)
 */
async function runLevel(botCount, durationMs, levelData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[LEVEL] Starting test with ${botCount} bots for ${durationMs / 60000} minutes`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Kill any existing wrangler processes and wait for port to be free
  console.log(`[CLEANUP] Killing existing wrangler processes...`);
  killWrangler();
  
  const portFree = await waitForPortFree(PORT);
  if (!portFree) {
    console.error(`[ERROR] Port ${PORT} still in use after cleanup. Skipping level.`);
    levelData.errors.push(`Port ${PORT} still in use`);
    return;
  }
  console.log(`[CLEANUP] Port ${PORT} is free`);
  
  // Update config
  updateBotCount(botCount);
  
  return new Promise((resolve) => {
    // Start wrangler
    const wrangler = spawn('npx', ['wrangler', 'dev', '--var', 'METRICS_ENABLED:true'], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    
    let serverReady = false;
    let warmupComplete = false;
    let warmupTimer = null;
    let endTimer = null;
    
    // Handle stdout
    wrangler.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      
      // Check if server is ready
      if (!serverReady && output.includes('Ready on')) {
        serverReady = true;
        console.log(`[TEST] Server ready, starting ${WARMUP_MS / 1000}s warmup...`);
        
        // Start warmup timer
        warmupTimer = setTimeout(() => {
          warmupComplete = true;
          console.log(`[TEST] Warmup complete, collecting metrics for ${(durationMs - WARMUP_MS) / 60000} minutes...`);
          
          // Set end timer
          endTimer = setTimeout(() => {
            console.log(`[TEST] Level complete, stopping server...`);
            wrangler.kill('SIGTERM');
          }, durationMs - WARMUP_MS);
        }, WARMUP_MS);
      }
      
      // Capture metrics lines (only after warmup)
      if (warmupComplete && output.includes(METRICS_PREFIX)) {
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes(METRICS_PREFIX)) {
            try {
              const jsonStart = line.indexOf('{');
              if (jsonStart !== -1) {
                const json = JSON.parse(line.slice(jsonStart));
                levelData.metrics.push(json);
                // Update aggregate on each sample
                levelData.aggregate = calculateAggregate(levelData.metrics);
                console.log(`[METRICS] Captured sample #${levelData.metrics.length}`);
                // Save incrementally after each sample
                saveIncremental();
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    });
    
    // Handle stderr
    wrangler.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);
      
      // Also check stderr for metrics (wrangler sometimes outputs there)
      if (warmupComplete && output.includes(METRICS_PREFIX)) {
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes(METRICS_PREFIX)) {
            try {
              const jsonStart = line.indexOf('{');
              if (jsonStart !== -1) {
                const json = JSON.parse(line.slice(jsonStart));
                levelData.metrics.push(json);
                // Update aggregate on each sample
                levelData.aggregate = calculateAggregate(levelData.metrics);
                console.log(`[METRICS] Captured sample #${levelData.metrics.length}`);
                // Save incrementally after each sample
                saveIncremental();
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    });
    
    // Handle process exit
    wrangler.on('close', (code) => {
      clearTimeout(warmupTimer);
      clearTimeout(endTimer);
      
      // Stop the test client cleanly
      if (global.stopTestClient) {
        global.stopTestClient();
      }
      
      levelData.endTime = new Date().toISOString();
      levelData.exitCode = code;
      
      // Calculate final aggregates
      if (levelData.metrics.length > 0) {
        levelData.aggregate = calculateAggregate(levelData.metrics);
      }
      
      // Final save for this level
      saveIncremental();
      
      console.log(`[LEVEL] Completed ${botCount} bots with ${levelData.metrics.length} metric samples`);
      resolve();
    });
    
    // Handle errors
    wrangler.on('error', (err) => {
      console.error(`[ERROR] Wrangler error:`, err);
      levelData.errors.push(err.message);
    });
    
    // Simulate a client connection to start the game loop
    setTimeout(() => {
      if (serverReady) {
        simulateClient();
      }
    }, 5000);
  });
}

/**
 * Simulate a client connection to trigger the game loop
 * Includes reconnection logic to handle disconnects
 */
async function simulateClient() {
  // Dynamic import for ws
  const { default: WebSocket } = await import('ws');
  
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  let shouldReconnect = true;
  
  function connect() {
    if (!shouldReconnect) return;
    
    try {
      const ws = new WebSocket('ws://localhost:8787/room/loadtest', {
        // Increase timeouts for large payloads
        handshakeTimeout: 30000,
      });
      
      ws.on('open', () => {
        console.log('[CLIENT] Connected to server');
        reconnectAttempts = 0;
        // Send hello message
        ws.send(JSON.stringify({ type: 'hello', name: 'LoadTestClient' }));
      });
      
      ws.on('message', (data) => {
        // Just keep connection alive - don't log to avoid spam
      });
      
      ws.on('error', (err) => {
        console.log('[CLIENT] Connection error:', err.message);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`[CLIENT] Disconnected (code: ${code})`);
        
        // Reconnect if we should and haven't exceeded attempts
        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`[CLIENT] Reconnecting in 2s (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
          setTimeout(connect, 2000);
        }
      });
      
      // Keep reference to prevent GC
      global.testClient = ws;
      global.stopTestClient = () => {
        shouldReconnect = false;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (err) {
      console.log('[CLIENT] Could not connect:', err.message);
      if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connect, 2000);
      }
    }
  }
  
  connect();
}

/**
 * Calculate aggregate statistics from metrics samples
 */
function calculateAggregate(metrics) {
  if (metrics.length === 0) return null;
  
  const agg = {
    sampleCount: metrics.length,
    avgTickMs: { avg: 0, min: Infinity, max: -Infinity },
    p95TickMs: { avg: 0, min: Infinity, max: -Infinity },
    actualSimHz: { avg: 0, min: Infinity, max: -Infinity },
    bytesOutPerMin: { avg: 0, min: Infinity, max: -Infinity },
    wsOutPerMin: { avg: 0, min: Infinity, max: -Infinity },
    entities: { avg: 0, min: Infinity, max: -Infinity },
    capacity: null,
    phaseAvgMs: {},
  };
  
  // Collect all values
  const values = {
    avgTickMs: [],
    p95TickMs: [],
    actualSimHz: [],
    bytesOutPerMin: [],
    wsOutPerMin: [],
    entities: [],
  };
  
  // Phase timing aggregation
  const phaseValues = {};
  
  // Capacity samples
  const capacitySamples = [];
  
  for (const m of metrics) {
    if (m.avgTickMs !== undefined) values.avgTickMs.push(m.avgTickMs);
    if (m.p95TickMs !== undefined) values.p95TickMs.push(m.p95TickMs);
    if (m.actualSimHz !== undefined) values.actualSimHz.push(m.actualSimHz);
    if (m.bytesOutPerMin !== undefined) values.bytesOutPerMin.push(m.bytesOutPerMin);
    if (m.wsOutPerMin !== undefined) values.wsOutPerMin.push(m.wsOutPerMin);
    if (m.entities !== undefined) values.entities.push(m.entities);
    
    // Phase timing
    if (m.phaseAvgMs) {
      for (const [phase, val] of Object.entries(m.phaseAvgMs)) {
        if (!phaseValues[phase]) phaseValues[phase] = [];
        phaseValues[phase].push(val);
      }
    }
    
    // Capacity
    if (m.capacity && m.capacity.msPerEntity > 0) {
      capacitySamples.push(m.capacity);
    }
  }
  
  // Calculate stats for each metric
  for (const [key, vals] of Object.entries(values)) {
    if (vals.length > 0) {
      agg[key].avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      agg[key].min = Math.round(Math.min(...vals) * 100) / 100;
      agg[key].max = Math.round(Math.max(...vals) * 100) / 100;
    }
  }
  
  // Phase timing averages
  for (const [phase, vals] of Object.entries(phaseValues)) {
    if (vals.length > 0) {
      agg.phaseAvgMs[phase] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    }
  }
  
  // Average capacity estimate
  if (capacitySamples.length > 0) {
    agg.capacity = {
      baseMs: Math.round((capacitySamples.reduce((a, b) => a + b.baseMs, 0) / capacitySamples.length) * 100) / 100,
      msPerEntity: Math.round((capacitySamples.reduce((a, b) => a + b.msPerEntity, 0) / capacitySamples.length) * 1000) / 1000,
      r2: Math.round((capacitySamples.reduce((a, b) => a + b.r2, 0) / capacitySamples.length) * 1000) / 1000,
      maxEntitiesAt50ms: Math.round(capacitySamples.reduce((a, b) => a + (b.maxEntitiesAt50ms || 0), 0) / capacitySamples.length),
    };
  }
  
  return agg;
}

/**
 * Initialize the incremental save file
 */
function initSaveFile() {
  // Create reports directory if needed
  const reportsDir = join(PROJECT_ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir);
  }
  
  // Generate filename once at start
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `metrics-report-${timestamp}.json`;
  incrementalSavePath = join(reportsDir, filename);
  
  console.log(`[SAVE] Incremental saves to: ${incrementalSavePath}`);
  
  // Initial save
  saveIncremental();
  
  return incrementalSavePath;
}

/**
 * Save current results incrementally (called after each metrics sample)
 */
function saveIncremental() {
  if (!incrementalSavePath) return;
  
  try {
    // Build current summary
    const saveData = {
      ...results,
      lastSaveTime: new Date().toISOString(),
      status: 'in_progress',
      summary: {
        levelsCompleted: results.levels.filter(l => l.endTime).length,
        levelsInProgress: results.levels.filter(l => !l.endTime).length,
        totalSamples: results.levels.reduce((a, l) => a + (l.metrics?.length || 0), 0),
        scalingCurve: results.levels.map(l => ({
          bots: l.botCount,
          samples: l.metrics?.length || 0,
          avgTickMs: l.aggregate?.avgTickMs?.avg,
          p95TickMs: l.aggregate?.p95TickMs?.avg,
          msPerEntity: l.aggregate?.capacity?.msPerEntity,
          maxEntities: l.aggregate?.capacity?.maxEntitiesAt50ms,
        })),
      },
    };
    
    writeFileSync(incrementalSavePath, JSON.stringify(saveData, null, 2));
  } catch (err) {
    console.error('[SAVE] Error saving:', err.message);
  }
}

/**
 * Generate final report
 */
function generateReport(results) {
  // Add summary
  results.endTime = new Date().toISOString();
  results.status = 'complete';
  results.summary = {
    levelsCompleted: results.levels.length,
    totalSamples: results.levels.reduce((a, l) => a + (l.metrics?.length || 0), 0),
    scalingCurve: results.levels.map(l => ({
      bots: l.botCount,
      samples: l.metrics?.length || 0,
      avgTickMs: l.aggregate?.avgTickMs?.avg,
      p95TickMs: l.aggregate?.p95TickMs?.avg,
      msPerEntity: l.aggregate?.capacity?.msPerEntity,
      maxEntities: l.aggregate?.capacity?.maxEntitiesAt50ms,
    })),
  };
  
  // Final save
  writeFileSync(incrementalSavePath, JSON.stringify(results, null, 2));
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[REPORT] Final report saved to: ${incrementalSavePath}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Print summary table
  console.log('SCALING CURVE SUMMARY:');
  console.log('-'.repeat(80));
  console.log('Bots\t| Samples\t| Avg Tick (ms)\t| P95 Tick (ms)\t| ms/Entity\t| Max Entities');
  console.log('-'.repeat(80));
  for (const row of results.summary.scalingCurve) {
    console.log(`${row.bots}\t| ${row.samples}\t\t| ${row.avgTickMs || 'N/A'}\t\t| ${row.p95TickMs || 'N/A'}\t\t| ${row.msPerEntity || 'N/A'}\t\t| ${row.maxEntities || 'N/A'}`);
  }
  console.log('-'.repeat(80));
  
  return incrementalSavePath;
}

/**
 * Main entry point
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           SWARMBLITZ AUTOMATED LOAD TESTING                  ║
║                                                               ║
║  This will run the server at different bot counts and        ║
║  collect metrics for capacity planning.                       ║
╚═══════════════════════════════════════════════════════════════╝
`);
  
  // Clean up any existing wrangler processes at start
  console.log('[INIT] Cleaning up any existing wrangler processes...');
  killWrangler();
  await waitForPortFree(PORT);
  console.log('[INIT] Cleanup complete\n');
  
  const config = parseArgs();
  
  console.log('Configuration:');
  console.log(`  Bot levels: ${config.botLevels.join(', ')}`);
  console.log(`  Duration per level: ${config.durationMs / 60000} minutes`);
  console.log(`  Warmup period: ${WARMUP_MS / 1000} seconds`);
  console.log(`  Total estimated time: ${(config.botLevels.length * config.durationMs) / 60000} minutes`);
  console.log('');
  
  results.config.botLevels = config.botLevels;
  results.config.durationPerLevelMs = config.durationMs;
  
  // Initialize incremental save file
  initSaveFile();
  
  // Run each level
  for (const botCount of config.botLevels) {
    // Create level data entry before running (so it shows in incremental saves)
    const levelData = {
      botCount,
      startTime: new Date().toISOString(),
      metrics: [],
      errors: [],
    };
    results.levels.push(levelData);
    saveIncremental();
    
    // Run the level (modifies levelData in place)
    await runLevel(botCount, config.durationMs, levelData);
    
    // Brief pause between levels
    console.log('[TEST] Pausing 5 seconds before next level...');
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Generate report
  generateReport(results);
  
  console.log('\n[DONE] Load testing complete!');
  process.exit(0);
}

// Handle exit signals to clean up wrangler
process.on('SIGINT', () => {
  console.log('\n[EXIT] Received SIGINT, cleaning up...');
  killWrangler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[EXIT] Received SIGTERM, cleaning up...');
  killWrangler();
  process.exit(0);
});

// Run
main().catch(err => {
  console.error('[FATAL]', err);
  killWrangler();
  process.exit(1);
});

