/**
 * SwarmBlitz Entry Point
 * 
 * Initializes the game client and handles UI interactions.
 * Works with the existing HTML structure.
 */

import GameClient from './game-client.js';
import { config } from '../config.js';
import * as SoundManager from './sound-manager.js';

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

const AUDIO_STORAGE_KEY = 'swarmblitz.audio.v1';

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveAudioSettings() {
  try {
    const snapshot = SoundManager.getSettingsSnapshot ? SoundManager.getSettingsSnapshot() : null;
    if (!snapshot) return;
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

function applyAudioSettingsToUI() {
  const masterSlider = document.getElementById('vol-master');
  const musicSlider = document.getElementById('vol-music');
  const sfxSlider = document.getElementById('vol-sfx');

  const masterVal = document.getElementById('vol-master-val');
  const musicVal = document.getElementById('vol-music-val');
  const sfxVal = document.getElementById('vol-sfx-val');

  if (masterSlider && masterVal) masterVal.textContent = `${masterSlider.value}%`;
  if (musicSlider && musicVal) musicVal.textContent = `${musicSlider.value}%`;
  if (sfxSlider && sfxVal) sfxVal.textContent = `${sfxSlider.value}%`;
}

function initAudioFromStoredSettings() {
  const stored = loadAudioSettings();
  if (!stored) return;

  if (typeof stored.masterVolume === 'number') SoundManager.setMasterVolume(stored.masterVolume);
  if (typeof stored.musicVolume === 'number') SoundManager.setMusicVolume(stored.musicVolume);
  if (typeof stored.sfxVolume === 'number') SoundManager.setSfxVolume(stored.sfxVolume);
  if (stored.volumes && typeof stored.volumes === 'object') SoundManager.setAllVolumes(stored.volumes);
  if (typeof stored.enabled === 'boolean') SoundManager.setEnabled(stored.enabled);

  // Update slider UI to match stored settings (percent)
  const masterSlider = document.getElementById('vol-master');
  const musicSlider = document.getElementById('vol-music');
  const sfxSlider = document.getElementById('vol-sfx');

  if (masterSlider && typeof stored.masterVolume === 'number') masterSlider.value = String(Math.round(stored.masterVolume * 100));
  if (musicSlider && typeof stored.musicVolume === 'number') musicSlider.value = String(Math.round(stored.musicVolume * 100));
  if (sfxSlider && typeof stored.sfxVolume === 'number') sfxSlider.value = String(Math.round(stored.sfxVolume * 100));

  applyAudioSettingsToUI();
}

function initAudioOnFirstInteraction() {
  SoundManager.init();
  SoundManager.resume();

  // If we're on the main menu, start menu music after audio is unlocked.
  if (beginScreen && beginScreen.style.display !== 'none') {
    SoundManager.startMenuMusic();
  }
}

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
  
  // Spectate buttons
  console.log('[INIT] spectateButton:', spectateButton);
  console.log('[INIT] spectateDeathButton:', spectateDeathButton);
  if (spectateButton) {
    spectateButton.addEventListener('click', () => {
      console.log('[CLICK] Spectate button clicked!');
      startSpectate();
    });
  } else {
    console.error('[INIT] spectateButton not found!');
  }
  if (spectateDeathButton) {
    spectateDeathButton.addEventListener('click', () => {
      console.log('[CLICK] Spectate death button clicked!');
      startSpectate();
    });
  } else {
    console.error('[INIT] spectateDeathButton not found!');
  }
  
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

  // Restore persisted audio settings (before any playback starts)
  initAudioFromStoredSettings();

  // Unlock audio on first interaction (autoplay policy)
  document.addEventListener('pointerdown', initAudioOnFirstInteraction, { once: true });
  document.addEventListener('touchstart', initAudioOnFirstInteraction, { once: true, passive: true });
  document.addEventListener('keydown', initAudioOnFirstInteraction, { once: true });
  
  // Enable play button (we're ready to connect)
  enablePlayButton();
  
  // Focus name input
  nameInput.focus();
}

/**
 * Setup volume sliders
 */
function setupVolumeSliders() {
  const masterSlider = document.getElementById('vol-master');
  const musicSlider = document.getElementById('vol-music');
  const sfxSlider = document.getElementById('vol-sfx');

  const masterVal = document.getElementById('vol-master-val');
  const musicVal = document.getElementById('vol-music-val');
  const sfxVal = document.getElementById('vol-sfx-val');

  if (masterSlider && masterVal) {
    masterSlider.addEventListener('input', () => {
      masterVal.textContent = `${masterSlider.value}%`;
      SoundManager.setMasterVolume(parseInt(masterSlider.value, 10) / 100);
      saveAudioSettings();
    });
  }

  if (musicSlider && musicVal) {
    musicSlider.addEventListener('input', () => {
      musicVal.textContent = `${musicSlider.value}%`;
      SoundManager.setMusicVolume(parseInt(musicSlider.value, 10) / 100);
      saveAudioSettings();
    });
  }

  if (sfxSlider && sfxVal) {
    sfxSlider.addEventListener('input', () => {
      sfxVal.textContent = `${sfxSlider.value}%`;
      SoundManager.setSfxVolume(parseInt(sfxSlider.value, 10) / 100);
      saveAudioSettings();
    });
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

  // Menu music (if audio has been unlocked)
  SoundManager.stopBackgroundMusic();
  SoundManager.startMenuMusic();
}

/**
 * Start the game
 */
function startGame() {
  const name = nameInput.value.trim() || 'Player';

  // Ensure WebAudio is unlocked even if the user starts via keyboard.
  initAudioOnFirstInteraction();
  
  // Hide screens
  beginScreen.style.display = 'none';
  wastedScreen.style.display = 'none';
  settingsPanel.style.display = 'none';
  
  // Reset stats
  kills = 0;
  maxLevel = 1;

  // Switch music contexts
  SoundManager.stopMenuMusic();
  // Background music requires audio unlock; safe to call regardless.
  SoundManager.startBackgroundMusic();
  
  // Determine WebSocket URL
  // Add ?prod to URL to test against production server
  const testProd = window.location.search.includes('prod');
  let wsUrl;
  if (config.dev && !testProd) {
    // Local development - use wrangler dev server
    wsUrl = `ws://localhost:8787/room/default`;
    console.log('%c🔧 CONNECTING TO LOCAL SERVER', 'background: #ff9800; color: black; font-size: 16px; padding: 4px 8px;');
  } else {
    // Production - use Cloudflare Workers
    wsUrl = `wss://swarmblitz.dev-1dd.workers.dev/room/default`;
    console.log('%c☁️ CONNECTING TO PRODUCTION SERVER', 'background: #4caf50; color: white; font-size: 16px; padding: 4px 8px;');
  }
  console.log('WebSocket URL:', wsUrl);
  
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
 * Start spectate mode (zoomed out view of entire map)
 */
function startSpectate() {
  console.log('[SPECTATE] startSpectate() called');
  
  // Ensure WebAudio is unlocked
  initAudioOnFirstInteraction();
  
  // Hide screens
  console.log('[SPECTATE] Hiding screens...');
  beginScreen.style.display = 'none';
  wastedScreen.style.display = 'none';
  settingsPanel.style.display = 'none';
  
  // Switch music contexts
  SoundManager.stopMenuMusic();
  SoundManager.startBackgroundMusic();
  
  // Determine WebSocket URL
  const testProd = window.location.search.includes('prod');
  let wsUrl;
  if (config.dev && !testProd) {
    wsUrl = `ws://localhost:8787/room/default`;
    console.log('%c👁 SPECTATING LOCAL SERVER', 'background: #9c27b0; color: white; font-size: 16px; padding: 4px 8px;');
  } else {
    wsUrl = `wss://swarmblitz.dev-1dd.workers.dev/room/default`;
    console.log('%c👁 SPECTATING PRODUCTION SERVER', 'background: #9c27b0; color: white; font-size: 16px; padding: 4px 8px;');
  }
  console.log('[SPECTATE] wsUrl:', wsUrl);
  
  // Create game client in spectate mode
  console.log('[SPECTATE] Creating GameClient...');
  gameClient = new GameClient(canvas, {
    wsUrl,
    spectateMode: true,
    onDeath: handleDeath,
    onKill: handleKill,
    onLevelUp: handleLevelUp,
  });
  console.log('[SPECTATE] GameClient created:', gameClient);
  
  // Connect as spectator
  console.log('[SPECTATE] Calling connectSpectate()...');
  gameClient.connectSpectate();
  console.log('[SPECTATE] connectSpectate() called');
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
