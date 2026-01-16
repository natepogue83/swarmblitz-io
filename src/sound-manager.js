/**
 * Sound Manager - Synthesized game audio using Web Audio API
 * Ported from `deprecated/sound-manager.js`
 *
 * Notes:
 * - Must call init() after a user interaction to satisfy browser autoplay policy.
 * - Uses HTMLAudioElement for music playback (playlist + menu music).
 * - SFX are synthesized with WebAudio.
 */

let audioContext = null;
let masterGain = null;
let initialized = false;

// Sound settings - individual volume knobs for each sound type
const settings = {
  masterVolume: 0.6,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  enabled: true,
  volumes: {
    playerLaser: 0.3,
    enemyLaser: 0.2,
    playerFuse: 1.0,
    enemyFuse: 0.7,
    capture: 1.0,
    levelUp: 0.8,
    death: 2.0,
    kill: 2.0,
    coinPickup: 1.0,
    hit: 1.5,
    trailing: 0.4,
    speedRush: 0.5,
  },
};

// Fuse sound state (looping sound) - player's own fuse
let fuseSound = null;
let fuseGainNode = null;
let fuseFilterNode = null;

// Enemy fuse sound state (looping sound) - when you snip others
let enemyFuseSound = null;
let enemyFuseGainNode = null;
let enemyFuseFilterNode = null;

// Speed rush sound state (looping sound)
let speedRushSound = null;
let speedRushGainNode = null;
let speedRushNoiseSource = null;

// Laser sound limiter - prevents harsh stacking when many drones fire at once
const laserLimiter = {
  playerLasers: [],    // Timestamps of recent player laser sounds
  enemyLasers: [],     // Timestamps of recent enemy laser sounds
  maxConcurrent: 4,    // Max simultaneous laser sounds before attenuation kicks in
  windowMs: 100,       // Time window to count concurrent sounds
  minCooldownMs: 20,   // Minimum time between laser sounds of same type
  attenuationFactor: 0.6, // Volume multiplier per extra concurrent sound
  maxDelayMs: 35,      // Maximum random delay offset in milliseconds
};
let speedRushOscillator = null;

// Background music state (playlist)
let bgMusicAudio = null;
let bgMusicPlaying = false;
let bgMusicPlaylist = [];
let bgMusicShuffled = [];
let bgMusicCurrentIndex = 0;

// Menu music state
let menuMusicAudio = null;
let menuMusicPlaying = false;
const MENU_MUSIC_PATH = '/music/playlist/menu/SwarmBlitz - Main Menu Theme.mp3';

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Initialize the audio context (must be called after user interaction)
 */
export function init() {
  if (initialized) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = settings.masterVolume;
    masterGain.connect(audioContext.destination);
    initialized = true;
    // eslint-disable-next-line no-console
    console.log('[SoundManager] Initialized');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[SoundManager] Web Audio API not supported:', e);
    settings.enabled = false;
  }
}

/**
 * Resume audio context if suspended (needed for Chrome autoplay policy)
 */
export function resume() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

export function setEnabled(enabled) {
  settings.enabled = !!enabled;
}

export function setMasterVolume(vol) {
  settings.masterVolume = Math.max(0, Math.min(1, vol));
  if (masterGain) masterGain.gain.value = settings.masterVolume;
  updateMusicVolume();
}

export function setMusicVolume(vol) {
  settings.musicVolume = Math.max(0, Math.min(1, vol));
  updateMusicVolume();
}

export function setSfxVolume(vol) {
  settings.sfxVolume = Math.max(0, Math.min(1, vol));
}

export function setVolume(soundType, volume) {
  if (Object.prototype.hasOwnProperty.call(settings.volumes, soundType)) {
    settings.volumes[soundType] = Math.max(0, Math.min(1, volume));
  }
}

export function getVolume(soundType) {
  return settings.volumes[soundType] ?? 1.0;
}

export function setAllVolumes(volumes) {
  for (const [key, value] of Object.entries(volumes)) {
    if (Object.prototype.hasOwnProperty.call(settings.volumes, key)) {
      settings.volumes[key] = Math.max(0, Math.min(1, value));
    }
  }
}

export function getAllVolumes() {
  return { ...settings.volumes };
}

export function getSettingsSnapshot() {
  return {
    enabled: settings.enabled,
    masterVolume: settings.masterVolume,
    sfxVolume: settings.sfxVolume,
    musicVolume: settings.musicVolume,
    volumes: { ...settings.volumes },
  };
}

// ===== SFX =====

export function playPlayerLaser() {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.playerLaser <= 0) return;
  resume();

  const nowMs = performance.now();
  
  // Cooldown check - skip if too soon after last player laser
  if (laserLimiter.playerLasers.length > 0) {
    const lastLaser = laserLimiter.playerLasers[laserLimiter.playerLasers.length - 1];
    if (nowMs - lastLaser < laserLimiter.minCooldownMs) {
      return; // Skip this sound, too soon
    }
  }
  
  // Clean up old timestamps and count concurrent sounds
  laserLimiter.playerLasers = laserLimiter.playerLasers.filter(t => nowMs - t < laserLimiter.windowMs);
  const concurrentCount = laserLimiter.playerLasers.length;
  
  // Record this sound
  laserLimiter.playerLasers.push(nowMs);
  
  // Calculate volume attenuation based on concurrent sounds
  let volumeMultiplier = 1.0;
  if (concurrentCount >= laserLimiter.maxConcurrent) {
    // Attenuate heavily when over the limit
    const excess = concurrentCount - laserLimiter.maxConcurrent + 1;
    volumeMultiplier = Math.pow(laserLimiter.attenuationFactor, excess);
  } else if (concurrentCount > 1) {
    // Slight attenuation for multiple concurrent sounds
    volumeMultiplier = 1.0 - (concurrentCount - 1) * 0.15;
  }

  const vol = settings.volumes.playerLaser;
  
  // Add slight random delay to spread out simultaneous sounds (0-35ms)
  const randomDelay = (Math.random() * laserLimiter.maxDelayMs) / 1000;
  const now = audioContext.currentTime + randomDelay;
  const duration = 0.15;

  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc1.type = 'sawtooth';
  osc2.type = 'square';

  // Slight random pitch variation (+/- 5%) for more organic feel
  const pitchVariation = 0.95 + Math.random() * 0.1;
  osc1.frequency.setValueAtTime(1800 * pitchVariation, now);
  osc1.frequency.exponentialRampToValueAtTime(400 * pitchVariation, now + duration * 0.7);

  osc2.frequency.setValueAtTime(1400 * pitchVariation, now);
  osc2.frequency.exponentialRampToValueAtTime(300 * pitchVariation, now + duration * 0.7);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4000, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + duration);
  filter.Q.value = 2;

  const baseVolume = 0.35 * settings.sfxVolume * vol * volumeMultiplier;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(baseVolume, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

export function playEnemyLaser(distance, maxDistance = 800) {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.enemyLaser <= 0) return;
  resume();

  const vol = settings.volumes.enemyLaser;
  const distanceMultiplier = Math.max(0, 1 - (distance / maxDistance));
  if (distanceMultiplier < 0.05) return;

  const nowMs = performance.now();
  
  // Cooldown check - skip if too soon after last enemy laser
  if (laserLimiter.enemyLasers.length > 0) {
    const lastLaser = laserLimiter.enemyLasers[laserLimiter.enemyLasers.length - 1];
    if (nowMs - lastLaser < laserLimiter.minCooldownMs) {
      return; // Skip this sound, too soon
    }
  }
  
  // Clean up old timestamps and count concurrent sounds
  laserLimiter.enemyLasers = laserLimiter.enemyLasers.filter(t => nowMs - t < laserLimiter.windowMs);
  const concurrentCount = laserLimiter.enemyLasers.length;
  
  // Record this sound
  laserLimiter.enemyLasers.push(nowMs);
  
  // Calculate volume attenuation based on concurrent sounds
  let concurrentMultiplier = 1.0;
  if (concurrentCount >= laserLimiter.maxConcurrent) {
    // Attenuate heavily when over the limit
    const excess = concurrentCount - laserLimiter.maxConcurrent + 1;
    concurrentMultiplier = Math.pow(laserLimiter.attenuationFactor, excess);
  } else if (concurrentCount > 1) {
    // Slight attenuation for multiple concurrent sounds
    concurrentMultiplier = 1.0 - (concurrentCount - 1) * 0.15;
  }

  // Add slight random delay to spread out simultaneous sounds (0-35ms)
  const randomDelay = (Math.random() * laserLimiter.maxDelayMs) / 1000;
  const now = audioContext.currentTime + randomDelay;
  const duration = 0.12;

  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';

  // Slight random pitch variation (+/- 5%) for more organic feel
  const pitchVariation = 0.95 + Math.random() * 0.1;
  osc1.frequency.setValueAtTime(900 * pitchVariation, now);
  osc1.frequency.exponentialRampToValueAtTime(250 * pitchVariation, now + duration * 0.8);

  osc2.frequency.setValueAtTime(700 * pitchVariation, now);
  osc2.frequency.exponentialRampToValueAtTime(180 * pitchVariation, now + duration * 0.8);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + duration);
  filter.Q.value = 3;

  const baseVolume = 0.25 * settings.sfxVolume * vol * distanceMultiplier * concurrentMultiplier;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(baseVolume, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

export function playCaptureSound(isLocalPlayer = true) {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.capture <= 0) return;
  resume();

  const vol = settings.volumes.capture;
  const now = audioContext.currentTime;
  const volume = (isLocalPlayer ? 1.0 : 0.3) * vol;

  // Whoosh noise
  const bufferSize = audioContext.sampleRate * 0.4;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = audioContext.createGain();
  const noiseFilter = audioContext.createBiquadFilter();

  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(300, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
  noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.4);
  noiseFilter.Q.value = 1;

  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.15 * settings.sfxVolume * volume, now + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  noise.start(now);
  noise.stop(now + 0.4);

  // Chime for local
  if (isLocalPlayer) {
    const frequencies = [523.25, 659.25, 783.99];
    const duration = 0.35;
    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const oscGain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.03;
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * volume, startTime + 0.02);
      oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}

export function playLevelUpSound() {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.levelUp <= 0) return;
  resume();

  const vol = settings.volumes.levelUp;
  const now = audioContext.currentTime;

  const notes = [
    { freq: 523.25, time: 0 },
    { freq: 659.25, time: 0.08 },
    { freq: 783.99, time: 0.16 },
    { freq: 1046.5, time: 0.24 },
  ];

  notes.forEach(note => {
    const osc = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.value = note.freq;
    osc2.frequency.value = note.freq * 2;

    const startTime = now + note.time;
    const duration = 0.5 - note.time * 0.5;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * vol, startTime + 0.02);
    gainNode.gain.setValueAtTime(0.18 * settings.sfxVolume * vol, startTime + duration * 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(startTime + duration);
    osc2.stop(startTime + duration);
  });

  for (let i = 0; i < 8; i++) {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2000 + Math.random() * 2000;
    const startTime = now + 0.1 + Math.random() * 0.4;
    const duration = 0.1 + Math.random() * 0.15;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.06 * settings.sfxVolume * vol, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  const boom = audioContext.createOscillator();
  const boomGain = audioContext.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(150, now);
  boom.frequency.exponentialRampToValueAtTime(50, now + 0.5);
  boomGain.gain.setValueAtTime(0, now);
  boomGain.gain.linearRampToValueAtTime(0.25 * settings.sfxVolume * vol, now + 0.02);
  boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  boom.connect(boomGain);
  boomGain.connect(masterGain);
  boom.start(now);
  boom.stop(now + 0.5);
}

export function playDeathSound(isLocalPlayer = false, distance = 0, maxDistance = 400) {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.death <= 0) return;
  resume();

  const vol = settings.volumes.death;
  const now = audioContext.currentTime;

  let volume;
  if (isLocalPlayer) {
    volume = 1.0 * vol;
  } else {
    const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
    if (distanceRatio < 0.1) return;
    volume = 0.5 * vol * distanceRatio;
  }

  const descend1 = audioContext.createOscillator();
  const descend2 = audioContext.createOscillator();
  const descendGain = audioContext.createGain();
  const descendFilter = audioContext.createBiquadFilter();

  descend1.type = 'sine';
  descend2.type = 'triangle';

  descend1.frequency.setValueAtTime(600, now);
  descend1.frequency.exponentialRampToValueAtTime(80, now + 0.8);
  descend2.frequency.setValueAtTime(603, now);
  descend2.frequency.exponentialRampToValueAtTime(82, now + 0.8);

  descendFilter.type = 'lowpass';
  descendFilter.frequency.setValueAtTime(2000, now);
  descendFilter.frequency.exponentialRampToValueAtTime(200, now + 0.7);

  descendGain.gain.setValueAtTime(0.25 * settings.sfxVolume * volume, now);
  descendGain.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * volume, now + 0.1);
  descendGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

  descend1.connect(descendFilter);
  descend2.connect(descendFilter);
  descendFilter.connect(descendGain);
  descendGain.connect(masterGain);

  descend1.start(now);
  descend2.start(now);
  descend1.stop(now + 0.9);
  descend2.stop(now + 0.9);

  const shatterDuration = 0.15;
  const shatterSize = audioContext.sampleRate * shatterDuration;
  const shatterBuffer = audioContext.createBuffer(1, shatterSize, audioContext.sampleRate);
  const shatterData = shatterBuffer.getChannelData(0);
  for (let i = 0; i < shatterSize; i++) {
    const t = i / audioContext.sampleRate;
    const crackle = Math.random() > 0.7 ? (Math.random() * 2 - 1) : 0;
    const decay = Math.exp(-t * 15);
    shatterData[i] = crackle * decay;
  }

  const shatter = audioContext.createBufferSource();
  shatter.buffer = shatterBuffer;
  const shatterGain = audioContext.createGain();
  const shatterFilter = audioContext.createBiquadFilter();
  shatterFilter.type = 'highpass';
  shatterFilter.frequency.value = 2000;
  shatterFilter.Q.value = 1;
  shatterGain.gain.setValueAtTime(0.18 * settings.sfxVolume * volume, now);
  shatterGain.gain.exponentialRampToValueAtTime(0.01, now + shatterDuration);
  shatter.connect(shatterFilter);
  shatterFilter.connect(shatterGain);
  shatterGain.connect(masterGain);
  shatter.start(now);
  shatter.stop(now + shatterDuration);

  const thump = audioContext.createOscillator();
  const thumpGain = audioContext.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(60, now);
  thump.frequency.exponentialRampToValueAtTime(25, now + 0.3);
  thumpGain.gain.setValueAtTime(0, now);
  thumpGain.gain.linearRampToValueAtTime(0.3 * settings.sfxVolume * volume, now + 0.015);
  thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
  thump.connect(thumpGain);
  thumpGain.connect(masterGain);
  thump.start(now);
  thump.stop(now + 0.35);

  if (isLocalPlayer) {
    const deathChordFreqs = [180, 190, 270];
    deathChordFreqs.forEach((freq) => {
      const osc = audioContext.createOscillator();
      const oscGain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.6);
      oscGain.gain.setValueAtTime(0, now + 0.02);
      oscGain.gain.linearRampToValueAtTime(0.08 * settings.sfxVolume * vol, now + 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.7);
    });
  }
}

export function playCoinPickup() {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.coinPickup <= 0) return;
  resume();

  const vol = settings.volumes.coinPickup;
  const now = audioContext.currentTime;

  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  osc1.type = 'sine';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(800, now);
  osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
  osc2.frequency.setValueAtTime(1200, now);
  osc2.frequency.exponentialRampToValueAtTime(2100, now + 0.08);

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * vol, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(masterGain);
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.2);
  osc2.stop(now + 0.2);

  const sparkle = audioContext.createOscillator();
  const sparkleGain = audioContext.createGain();
  sparkle.type = 'sine';
  sparkle.frequency.setValueAtTime(2400, now + 0.02);
  sparkle.frequency.exponentialRampToValueAtTime(3200, now + 0.1);
  sparkleGain.gain.setValueAtTime(0, now + 0.02);
  sparkleGain.gain.linearRampToValueAtTime(0.08 * settings.sfxVolume * vol, now + 0.04);
  sparkleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(masterGain);
  sparkle.start(now + 0.02);
  sparkle.stop(now + 0.15);
}

export function playKillSound() {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.kill <= 0) return;
  resume();

  const vol = settings.volumes.kill;
  const now = audioContext.currentTime;

  const bass = audioContext.createOscillator();
  const bassGain = audioContext.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(120, now);
  bass.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  bassGain.gain.setValueAtTime(0.4 * settings.sfxVolume * vol, now);
  bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
  bass.connect(bassGain);
  bassGain.connect(masterGain);
  bass.start(now);
  bass.stop(now + 0.25);

  const punch = audioContext.createOscillator();
  const punchGain = audioContext.createGain();
  const punchFilter = audioContext.createBiquadFilter();
  punch.type = 'square';
  punch.frequency.setValueAtTime(200, now);
  punch.frequency.exponentialRampToValueAtTime(80, now + 0.1);
  punchFilter.type = 'lowpass';
  punchFilter.frequency.value = 400;
  punchGain.gain.setValueAtTime(0.25 * settings.sfxVolume * vol, now);
  punchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
  punch.connect(punchFilter);
  punchFilter.connect(punchGain);
  punchGain.connect(masterGain);
  punch.start(now);
  punch.stop(now + 0.12);

  const bellFreqs = [1318.5, 1568, 2093];
  bellFreqs.forEach((freq, i) => {
    const bell = audioContext.createOscillator();
    const bellGain = audioContext.createGain();
    bell.type = 'sine';
    bell.frequency.value = freq;
    const startTime = now + 0.03 + i * 0.015;
    bellGain.gain.setValueAtTime(0, startTime);
    bellGain.gain.linearRampToValueAtTime(0.18 * settings.sfxVolume * vol, startTime + 0.01);
    bellGain.gain.setValueAtTime(0.15 * settings.sfxVolume * vol, startTime + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
    bell.connect(bellGain);
    bellGain.connect(masterGain);
    bell.start(startTime);
    bell.stop(startTime + 0.4);
  });
}

export function playHitSound() {
  if (!initialized || !settings.enabled) return;
  if (settings.volumes.hit <= 0) return;
  resume();

  const vol = settings.volumes.hit;
  const now = audioContext.currentTime;

  const bufferSize = audioContext.sampleRate * 0.1;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 2;
  noiseGain.gain.setValueAtTime(0.25 * settings.sfxVolume * vol, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.1);
}

// ===== Fuse (looping) =====

export function startFuseSound() {
  if (!initialized || !settings.enabled) return;
  if (fuseSound) return;
  resume();

  const noiseDuration = 1.5;
  const noiseBufferSize = audioContext.sampleRate * noiseDuration;
  const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    const t = i / audioContext.sampleRate;
    const hiss = (Math.random() * 2 - 1) * 0.5;
    const smallCrackle = Math.random() > 0.7 ? (Math.random() * 2 - 1) * 0.6 : 0;
    const pop = Math.random() > 0.97 ? (Math.random() * 2 - 1) * 1.0 : 0;
    const sputter = Math.sin(t * 150 + Math.random() * 2) * 0.2 * (Math.random() > 0.5 ? 1 : 0);
    noiseData[i] = hiss + smallCrackle + pop + sputter;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 1500;
  highpass.Q.value = 0.7;

  const presence = audioContext.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 5000;
  presence.Q.value = 1;
  presence.gain.value = 6;

  const burnOsc = audioContext.createOscillator();
  burnOsc.type = 'sawtooth';
  burnOsc.frequency.value = 80;

  const burnGain = audioContext.createGain();
  burnGain.gain.value = 0.08;

  const burnFilter = audioContext.createBiquadFilter();
  burnFilter.type = 'bandpass';
  burnFilter.frequency.value = 200;
  burnFilter.Q.value = 3;

  fuseGainNode = audioContext.createGain();
  // Give a non-zero baseline so the LFO doesn't create an audible "chop"
  // before the first updateFuseVolume() call lands.
  const baseVol = settings.volumes.playerFuse ?? 1.0;
  fuseGainNode.gain.value = 0.15 * settings.sfxVolume * baseVol;

  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 12;
  const lfoGain = audioContext.createGain();
  // Subtle variation; high depth reads as "tststst" instead of "tssss"
  lfoGain.gain.value = 0.02;

  noise.connect(highpass);
  highpass.connect(presence);
  presence.connect(fuseGainNode);

  burnOsc.connect(burnFilter);
  burnFilter.connect(burnGain);
  burnGain.connect(fuseGainNode);

  lfo.connect(lfoGain);
  lfoGain.connect(fuseGainNode.gain);

  fuseGainNode.connect(masterGain);

  noise.start();
  burnOsc.start();
  lfo.start();

  fuseSound = { noise, burnOsc, lfo };
  fuseFilterNode = presence;
}

export function stopFuseSound() {
  if (!fuseSound) return;
  try {
    if (fuseGainNode) {
      const now = audioContext.currentTime;
      fuseGainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    }
    setTimeout(() => {
      try {
        if (fuseSound) {
          fuseSound.noise.stop();
          fuseSound.burnOsc.stop();
          fuseSound.lfo.stop();
        }
      } catch {
        // ignore
      }
      fuseSound = null;
      fuseGainNode = null;
      fuseFilterNode = null;
    }, 150);
  } catch {
    fuseSound = null;
    fuseGainNode = null;
    fuseFilterNode = null;
  }
}

export function updateFuseVolume(distanceRatio) {
  if (!fuseGainNode || !initialized || !settings.enabled) return;
  if (settings.volumes.playerFuse <= 0) return;

  const vol = settings.volumes.playerFuse;
  const minVolume = 0.15;
  const maxVolume = 0.45;
  const volume = (minVolume + (maxVolume - minVolume) * distanceRatio) * settings.sfxVolume * vol;

  const now = audioContext.currentTime;
  fuseGainNode.gain.linearRampToValueAtTime(volume, now + 0.05);

  if (fuseFilterNode) {
    const minGain = 4;
    const maxGain = 10;
    const gain = minGain + (maxGain - minGain) * distanceRatio;
    fuseFilterNode.gain.linearRampToValueAtTime(gain, now + 0.05);
  }
}

export function isFuseSoundPlaying() {
  return fuseSound !== null;
}

export function startEnemyFuseSound() {
  if (!initialized || !settings.enabled) return;
  if (enemyFuseSound) return;
  resume();

  const noiseDuration = 1.5;
  const noiseBufferSize = audioContext.sampleRate * noiseDuration;
  const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    const t = i / audioContext.sampleRate;
    const hiss = (Math.random() * 2 - 1) * 0.4;
    const crackle = Math.random() > 0.75 ? (Math.random() * 2 - 1) * 0.5 : 0;
    const pop = Math.random() > 0.96 ? (Math.random() * 2 - 1) * 0.8 : 0;
    const sputter = Math.sin(t * 100 + Math.random() * 2) * 0.15 * (Math.random() > 0.6 ? 1 : 0);
    noiseData[i] = hiss + crackle + pop + sputter;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 800;
  highpass.Q.value = 0.5;

  const presence = audioContext.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2500;
  presence.Q.value = 1.5;
  presence.gain.value = 5;

  const burnOsc = audioContext.createOscillator();
  burnOsc.type = 'sawtooth';
  burnOsc.frequency.value = 50;

  const burnGain = audioContext.createGain();
  burnGain.gain.value = 0.1;

  const burnFilter = audioContext.createBiquadFilter();
  burnFilter.type = 'bandpass';
  burnFilter.frequency.value = 150;
  burnFilter.Q.value = 2;

  enemyFuseGainNode = audioContext.createGain();
  const baseVol = settings.volumes.enemyFuse ?? 0.7;
  enemyFuseGainNode.gain.value = 0.06 * settings.sfxVolume * baseVol;

  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 8;
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 0.015;

  noise.connect(highpass);
  highpass.connect(presence);
  presence.connect(enemyFuseGainNode);

  burnOsc.connect(burnFilter);
  burnFilter.connect(burnGain);
  burnGain.connect(enemyFuseGainNode);

  lfo.connect(lfoGain);
  lfoGain.connect(enemyFuseGainNode.gain);

  enemyFuseGainNode.connect(masterGain);

  noise.start();
  burnOsc.start();
  lfo.start();

  enemyFuseSound = { noise, burnOsc, lfo };
  enemyFuseFilterNode = presence;
}

export function stopEnemyFuseSound() {
  if (!enemyFuseSound) return;
  try {
    if (enemyFuseGainNode) {
      const now = audioContext.currentTime;
      enemyFuseGainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    }
    setTimeout(() => {
      try {
        if (enemyFuseSound) {
          enemyFuseSound.noise.stop();
          enemyFuseSound.burnOsc.stop();
          enemyFuseSound.lfo.stop();
        }
      } catch {
        // ignore
      }
      enemyFuseSound = null;
      enemyFuseGainNode = null;
      enemyFuseFilterNode = null;
    }, 150);
  } catch {
    enemyFuseSound = null;
    enemyFuseGainNode = null;
    enemyFuseFilterNode = null;
  }
}

export function updateEnemyFuseVolume(distance, maxDistance = 300) {
  if (!enemyFuseGainNode || !initialized || !settings.enabled) return;
  if (settings.volumes.enemyFuse <= 0) return;

  const vol = settings.volumes.enemyFuse;
  const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
  const now = audioContext.currentTime;

  if (distanceRatio < 0.1) {
    enemyFuseGainNode.gain.linearRampToValueAtTime(0, now + 0.05);
    return;
  }

  const minVolume = 0.08;
  const maxVolume = 0.30;
  const volume = (minVolume + (maxVolume - minVolume) * distanceRatio) * settings.sfxVolume * vol;
  enemyFuseGainNode.gain.linearRampToValueAtTime(volume, now + 0.05);

  if (enemyFuseFilterNode) {
    const minGain = 3;
    const maxGain = 7;
    const gain = minGain + (maxGain - minGain) * distanceRatio;
    enemyFuseFilterNode.gain.linearRampToValueAtTime(gain, now + 0.05);
  }
}

export function isEnemyFuseSoundPlaying() {
  return enemyFuseSound !== null;
}

// ===== Speed rush (looping) =====

export function startSpeedRushSound() {
  if (!initialized || !settings.enabled) return;
  if (speedRushSound) return;
  resume();

  const noiseDuration = 2.0;
  const noiseBufferSize = audioContext.sampleRate * noiseDuration;
  const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    const t = i / audioContext.sampleRate;
    const rush = (Math.random() * 2 - 1) * 0.5;
    const whoosh = Math.sin(t * 12) * 0.2 * (Math.random() * 2 - 1);
    const pulse = Math.sin(t * 6) * 0.08;
    noiseData[i] = rush + whoosh + pulse;
  }

  speedRushNoiseSource = audioContext.createBufferSource();
  speedRushNoiseSource.buffer = noiseBuffer;
  speedRushNoiseSource.loop = true;
  speedRushNoiseSource.playbackRate.value = 1.0;

  const bandpass = audioContext.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 600;
  bandpass.Q.value = 1.2;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 300;
  highpass.Q.value = 0.7;

  speedRushOscillator = audioContext.createOscillator();
  speedRushOscillator.type = 'sawtooth';
  speedRushOscillator.frequency.value = 100;

  const oscGain = audioContext.createGain();
  oscGain.gain.value = 0.02;

  const oscFilter = audioContext.createBiquadFilter();
  oscFilter.type = 'lowpass';
  oscFilter.frequency.value = 200;

  speedRushGainNode = audioContext.createGain();
  speedRushGainNode.gain.value = 0;

  speedRushNoiseSource.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(speedRushGainNode);

  speedRushOscillator.connect(oscFilter);
  oscFilter.connect(oscGain);
  oscGain.connect(speedRushGainNode);

  speedRushGainNode.connect(masterGain);

  speedRushNoiseSource.start();
  speedRushOscillator.start();

  speedRushSound = { noiseSource: speedRushNoiseSource, oscillator: speedRushOscillator, bandpass };

  const now = audioContext.currentTime;
  const vol = settings.volumes.speedRush ?? 0.5;
  speedRushGainNode.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * vol, now + 0.3);
}

export function stopSpeedRushSound() {
  if (!speedRushSound) return;
  try {
    if (speedRushGainNode) {
      const now = audioContext.currentTime;
      speedRushGainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    }
    setTimeout(() => {
      try {
        if (speedRushSound) {
          speedRushSound.noiseSource.stop();
          speedRushSound.oscillator.stop();
        }
      } catch {
        // ignore
      }
      speedRushSound = null;
      speedRushGainNode = null;
      speedRushNoiseSource = null;
      speedRushOscillator = null;
    }, 250);
  } catch {
    speedRushSound = null;
    speedRushGainNode = null;
    speedRushNoiseSource = null;
    speedRushOscillator = null;
  }
}

export function updateSpeedRushSound(speedMultiplier) {
  if (!speedRushSound || !speedRushGainNode || !initialized || !settings.enabled) return;
  if (settings.volumes.speedRush <= 0) return;

  const vol = settings.volumes.speedRush ?? 0.5;
  const now = audioContext.currentTime;
  const speedRatio = Math.min(1.0, Math.max(0, (speedMultiplier - 1.1) / 0.1));

  const playbackRate = 1.0 + (1.5 - 1.0) * speedRatio;
  if (speedRushNoiseSource) {
    speedRushNoiseSource.playbackRate.linearRampToValueAtTime(playbackRate, now + 0.1);
  }

  const volume = (0.1 + (0.25 - 0.1) * speedRatio) * settings.sfxVolume * vol;
  speedRushGainNode.gain.linearRampToValueAtTime(volume, now + 0.1);

  if (speedRushOscillator) {
    const freq = 100 + (180 - 100) * speedRatio;
    speedRushOscillator.frequency.linearRampToValueAtTime(freq, now + 0.1);
  }

  if (speedRushSound.bandpass) {
    const bandFreq = 500 + (1200 - 500) * speedRatio;
    speedRushSound.bandpass.frequency.linearRampToValueAtTime(bandFreq, now + 0.1);
  }
}

export function isSpeedRushSoundPlaying() {
  return speedRushSound !== null;
}

// Legacy aliases (wind sound removed)
export function startTrailSound() {}
export function stopTrailSound() {}
export function updateTrailSound() {}
export function isTrailSoundPlaying() { return false; }

// ===== Music =====

async function fetchPlaylist() {
  try {
    const response = await fetch('/api/playlist');
    const data = await response.json();
    bgMusicPlaylist = data.tracks || [];
    // eslint-disable-next-line no-console
    console.log('[SoundManager] Playlist loaded:', bgMusicPlaylist.length, 'tracks');
    return bgMusicPlaylist.length > 0;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[SoundManager] Could not fetch playlist:', e);
    return false;
  }
}

function onTrackEnded() {
  advanceToNextTrack();
}

function playNextTrack() {
  if (!bgMusicPlaying || bgMusicShuffled.length === 0) return;
  const track = bgMusicShuffled[bgMusicCurrentIndex];
  const trackUrl = `/music/playlist/${encodeURIComponent(track)}`;

  // eslint-disable-next-line no-console
  console.log('[SoundManager] Playing track:', track, `(${bgMusicCurrentIndex + 1}/${bgMusicShuffled.length})`);

  if (bgMusicAudio) {
    bgMusicAudio.pause();
    bgMusicAudio.removeEventListener('ended', onTrackEnded);
  }

  bgMusicAudio = new Audio(trackUrl);
  bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
  bgMusicAudio.addEventListener('ended', onTrackEnded);
  bgMusicAudio.play().catch(e => {
    // eslint-disable-next-line no-console
    console.warn('[SoundManager] Could not play track:', e);
    advanceToNextTrack();
  });
}

function advanceToNextTrack() {
  if (!bgMusicPlaying) return;
  bgMusicCurrentIndex++;
  if (bgMusicCurrentIndex >= bgMusicShuffled.length) {
    // eslint-disable-next-line no-console
    console.log('[SoundManager] All tracks played, reshuffling playlist');
    bgMusicShuffled = shuffleArray(bgMusicPlaylist);
    bgMusicCurrentIndex = 0;
  }
  playNextTrack();
}

export async function startBackgroundMusic() {
  if (!settings.enabled || bgMusicPlaying) return;
  bgMusicPlaying = true;

  if (bgMusicPlaylist.length === 0) {
    const hasPlaylist = await fetchPlaylist();
    if (!hasPlaylist) {
      // eslint-disable-next-line no-console
      console.warn('[SoundManager] No tracks in playlist');
      bgMusicPlaying = false;
      return;
    }
  }

  bgMusicShuffled = shuffleArray(bgMusicPlaylist);
  bgMusicCurrentIndex = 0;
  playNextTrack();
  // eslint-disable-next-line no-console
  console.log('[SoundManager] Background music started with', bgMusicPlaylist.length, 'tracks');
}

export function stopBackgroundMusic() {
  if (!bgMusicPlaying) return;
  bgMusicPlaying = false;
  if (bgMusicAudio) {
    bgMusicAudio.removeEventListener('ended', onTrackEnded);
    const audio = bgMusicAudio;
    const fadeOut = setInterval(() => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.05);
      } else {
        clearInterval(fadeOut);
        audio.pause();
      }
    }, 30);
  }
  // eslint-disable-next-line no-console
  console.log('[SoundManager] Background music stopped');
}

export function updateBackgroundMusicTempo() {
  // Disabled - music plays at constant speed
}

export function isBackgroundMusicPlaying() {
  return bgMusicPlaying;
}

export function startMenuMusic() {
  if (!settings.enabled || menuMusicPlaying) return;

  if (bgMusicPlaying) stopBackgroundMusic();
  menuMusicPlaying = true;

  if (menuMusicAudio) menuMusicAudio.pause();
  menuMusicAudio = new Audio(MENU_MUSIC_PATH);
  menuMusicAudio.volume = settings.musicVolume * settings.masterVolume;
  menuMusicAudio.loop = true;
  menuMusicAudio.play().catch(e => {
    // eslint-disable-next-line no-console
    console.warn('[SoundManager] Could not play menu music:', e);
    menuMusicPlaying = false;
  });
  // eslint-disable-next-line no-console
  console.log('[SoundManager] Menu music started');
}

export function stopMenuMusic() {
  if (!menuMusicPlaying) return;
  menuMusicPlaying = false;
  if (menuMusicAudio) {
    const audio = menuMusicAudio;
    const fadeOut = setInterval(() => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.05);
      } else {
        clearInterval(fadeOut);
        audio.pause();
      }
    }, 30);
  }
  // eslint-disable-next-line no-console
  console.log('[SoundManager] Menu music stopped');
}

export function isMenuMusicPlaying() {
  return menuMusicPlaying;
}

export function updateMusicVolume() {
  const vol = settings.musicVolume * settings.masterVolume;
  if (bgMusicAudio) bgMusicAudio.volume = vol;
  if (menuMusicAudio) menuMusicAudio.volume = vol;
}

export default {
  init,
  resume,
  setEnabled,
  setMasterVolume,
  setMusicVolume,
  setSfxVolume,
  setVolume,
  getVolume,
  setAllVolumes,
  getAllVolumes,
  getSettingsSnapshot,
  playPlayerLaser,
  playEnemyLaser,
  playCaptureSound,
  playLevelUpSound,
  playDeathSound,
  playCoinPickup,
  playKillSound,
  playHitSound,
  startFuseSound,
  stopFuseSound,
  updateFuseVolume,
  isFuseSoundPlaying,
  startEnemyFuseSound,
  stopEnemyFuseSound,
  updateEnemyFuseVolume,
  isEnemyFuseSoundPlaying,
  startTrailSound,
  stopTrailSound,
  updateTrailSound,
  isTrailSoundPlaying,
  startSpeedRushSound,
  stopSpeedRushSound,
  updateSpeedRushSound,
  isSpeedRushSoundPlaying,
  startBackgroundMusic,
  stopBackgroundMusic,
  updateBackgroundMusicTempo,
  isBackgroundMusicPlaying,
  startMenuMusic,
  stopMenuMusic,
  isMenuMusicPlaying,
  updateMusicVolume,
};


