/**
 * SwarmBlitz Entry Point
 * 
 * Initializes the game client and handles UI interactions.
 * Works with the existing HTML structure.
 */

import GameClient from './game-client.js';
import { config } from '../config.js';

// DOM elements
let canvas;
let beginScreen;
let wastedScreen;
let settingsPanel;
let nameInput;
let playButton;
let spectateButton;
let errorSpan;
let gameClient;

// Death screen elements
let deathScore;
let deathKills;
let deathLevel;
let deathKillerInfo;
let deathKillerName;
let playAgainButton;
let menuButton;
let spectateDeathButton;

// Settings
let settingsToggle;
let settingsClose;
let settingsMenuBtn;

// Game stats
let kills = 0;
let maxLevel = 1;

/**
 * Initialize the game
 */
function init() {
  // Get DOM elements
  canvas = document.getElementById('main-ui');
  beginScreen = document.getElementById('begin');
  wastedScreen = document.getElementById('wasted');
  settingsPanel = document.getElementById('settings');
  nameInput = document.getElementById('name');
  playButton = document.querySelector('.start.start-btn.primary');
  spectateButton = document.querySelector('.spectate.start-btn.secondary');
  errorSpan = document.getElementById('error');
  
  // Death screen
  deathScore = document.getElementById('death-score');
  deathKills = document.getElementById('death-kills');
  deathLevel = document.getElementById('death-level');
  deathKillerInfo = document.getElementById('death-killer-info');
  deathKillerName = document.getElementById('death-killer-name');
  playAgainButton = wastedScreen.querySelector('.start.orange');
  menuButton = wastedScreen.querySelector('.menu.yellow');
  spectateDeathButton = wastedScreen.querySelector('.spectate.green');
  
  // Settings
  settingsToggle = document.querySelector('.toggle.yellow');
  settingsClose = document.getElementById('settings-close');
  settingsMenuBtn = document.getElementById('settings-menu-btn');
  
  // Setup canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Setup play button
  playButton.addEventListener('click', startGame);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !playButton.disabled) startGame();
  });
  
  // Death screen buttons
  playAgainButton.addEventListener('click', startGame);
  menuButton.addEventListener('click', showMainMenu);
  
  // Settings
  settingsToggle.addEventListener('click', toggleSettings);
  settingsClose.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });
  settingsMenuBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    showMainMenu();
  });
  
  // How to play expandable
  const howToPlayToggle = document.getElementById('how-to-play-toggle');
  const howToPlayContent = document.getElementById('how-to-play-content');
  if (howToPlayToggle && howToPlayContent) {
    howToPlayToggle.addEventListener('click', () => {
      const isVisible = howToPlayContent.style.display !== 'none';
      howToPlayContent.style.display = isVisible ? 'none' : 'block';
      howToPlayToggle.classList.toggle('expanded', !isVisible);
    });
  }
  
  // Volume sliders
  setupVolumeSliders();
  
  // Enable play button (we're ready to connect)
  enablePlayButton();
  
  // Focus name input
  nameInput.focus();
}

/**
 * Setup volume sliders
 */
function setupVolumeSliders() {
  const sliders = [
    { id: 'vol-master', valId: 'vol-master-val' },
    { id: 'vol-music', valId: 'vol-music-val' },
    { id: 'vol-sfx', valId: 'vol-sfx-val' },
  ];
  
  for (const { id, valId } of sliders) {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(valId);
    if (slider && valSpan) {
      slider.addEventListener('input', () => {
        valSpan.textContent = `${slider.value}%`;
      });
    }
  }
}

/**
 * Enable play button
 */
function enablePlayButton() {
  playButton.disabled = false;
  spectateButton.disabled = false;
  playAgainButton.disabled = false;
  spectateDeathButton.disabled = false;
  errorSpan.textContent = 'Ready to play!';
  errorSpan.style.color = '#4caf50';
}

/**
 * Resize canvas to fill window
 */
function resizeCanvas() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    if (gameClient) {
      gameClient.resize(canvas.width, canvas.height);
    }
  }
}

/**
 * Toggle settings panel
 */
function toggleSettings() {
  const isVisible = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = isVisible ? 'none' : 'block';
}

/**
 * Show main menu
 */
function showMainMenu() {
  if (gameClient) {
    gameClient.disconnect();
    gameClient = null;
  }
  
  wastedScreen.style.display = 'none';
  settingsPanel.style.display = 'none';
  beginScreen.style.display = 'flex';
  nameInput.focus();
  
  // Reset stats
  kills = 0;
  maxLevel = 1;
}

/**
 * Start the game
 */
function startGame() {
  const name = nameInput.value.trim() || 'Player';
  
  // Hide screens
  beginScreen.style.display = 'none';
  wastedScreen.style.display = 'none';
  settingsPanel.style.display = 'none';
  
  // Reset stats
  kills = 0;
  maxLevel = 1;
  
  // Determine WebSocket URL
  let wsUrl;
  if (config.dev) {
    // Local development - use wrangler dev server
    wsUrl = `ws://localhost:8787/room/default`;
  } else {
    // Production - use Cloudflare Workers
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/room/default`;
  }
  
  // Create game client
  gameClient = new GameClient(canvas, {
    wsUrl,
    onDeath: handleDeath,
    onKill: handleKill,
    onLevelUp: handleLevelUp,
  });
  
  // Connect
  gameClient.connect(name);
}

/**
 * Handle player death
 */
function handleDeath(event) {
  console.log('You died!', event);
  
  // Get final stats
  const player = gameClient ? gameClient.getSelfPlayer() : null;
  const finalLevel = player ? player.level : maxLevel;
  
  // Calculate score (placeholder - would need territory percentage)
  const score = '0.00%';
  
  // Update death screen
  deathScore.textContent = score;
  deathKills.textContent = kills.toString();
  deathLevel.textContent = finalLevel.toString();
  
  // Show killer info if available
  if (event.killerNum !== undefined && event.killerNum !== 65535) {
    const killer = gameClient ? gameClient.players.get(event.killerNum) : null;
    if (killer) {
      deathKillerName.textContent = killer.name;
      deathKillerInfo.style.display = 'block';
    } else {
      deathKillerInfo.style.display = 'none';
    }
  } else {
    deathKillerInfo.style.display = 'none';
  }
  
  // Show death screen after a delay
  setTimeout(() => {
    if (gameClient) {
      gameClient.disconnect();
      gameClient = null;
    }
    
    // Enable respawn buttons
    playAgainButton.disabled = false;
    spectateDeathButton.disabled = false;
    
    wastedScreen.style.display = 'flex';
  }, 1500);
}

/**
 * Handle kill
 */
function handleKill(event) {
  console.log('You killed someone!', event);
  kills++;
}

/**
 * Handle level up
 */
function handleLevelUp(event) {
  console.log('Level up!', event);
  if (event.newLevel > maxLevel) {
    maxLevel = event.newLevel;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.getGameClient = () => gameClient;
