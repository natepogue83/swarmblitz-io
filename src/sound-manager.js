/**
 * Sound Manager - Synthesized game audio using Web Audio API
 * No external sound files needed - all sounds are procedurally generated
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
    
    // Individual sound volumes (0.0 - 1.0)
    // Adjust these to balance sound levels
    volumes: {
        playerLaser: 0.3,    // Your drone laser shots
        enemyLaser: 0.2,     // Enemy drone laser shots
        playerFuse: 1.0,     // Your fuse when snipped
        enemyFuse: 0.7,      // Enemy fuse when you snip them
        capture: 1.0,        // Territory capture sound
        levelUp: 0.8,        // Level up fanfare
        death: 2.0,          // Death explosion
        kill: 2.0,           // Kill sound (when you kill someone)
        coinPickup: 1.0,     // XP orb pickup
        hit: 1.5,            // Taking damage
        trailing: 0.4,       // Legacy (unused)
        speedRush: 0.5       // Speed rush sound (plays at 10%+ speed buff)
    }
};

// Track playing sounds for cleanup
const activeSounds = new Set();

// Fuse sound state (looping sound) - player's own fuse
let fuseSound = null;
let fuseGainNode = null;
let fuseFilterNode = null;

// Enemy fuse sound state (looping sound) - when you snip others
let enemyFuseSound = null;
let enemyFuseGainNode = null;
let enemyFuseFilterNode = null;

// Speed rush sound state (looping sound) - when speed buff >= 10%
let speedRushSound = null;
let speedRushGainNode = null;
let speedRushNoiseSource = null;
let speedRushOscillator = null;

// Background music state (playlist)
let bgMusicAudio = null;
let bgMusicPlaying = false;
let bgMusicPlaylist = [];      // All available tracks
let bgMusicShuffled = [];      // Shuffled order to play
let bgMusicCurrentIndex = 0;   // Current position in shuffled list

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
        console.log("[SoundManager] Initialized");
    } catch (e) {
        console.warn("[SoundManager] Web Audio API not supported:", e);
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

/**
 * Set master volume (0.0 - 1.0)
 */
export function setMasterVolume(vol) {
    settings.masterVolume = Math.max(0, Math.min(1, vol));
    if (masterGain) {
        masterGain.gain.value = settings.masterVolume;
    }
    // Update music volume too
    if (bgMusicAudio) {
        bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
    }
}

/**
 * Set music volume (0.0 - 1.0)
 */
export function setMusicVolume(vol) {
    settings.musicVolume = Math.max(0, Math.min(1, vol));
    if (bgMusicAudio) {
        bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
    }
}

/**
 * Set SFX volume (0.0 - 1.0)
 */
export function setSfxVolume(vol) {
    settings.sfxVolume = Math.max(0, Math.min(1, vol));
}

/**
 * Enable/disable all sounds
 */
export function setEnabled(enabled) {
    settings.enabled = enabled;
}

/**
 * Set volume for a specific sound type
 * @param {string} soundType - One of: playerLaser, enemyLaser, playerFuse, enemyFuse, capture, levelUp, death, kill, coinPickup, hit
 * @param {number} volume - Volume level (0.0 - 1.0)
 */
export function setVolume(soundType, volume) {
    if (settings.volumes.hasOwnProperty(soundType)) {
        settings.volumes[soundType] = Math.max(0, Math.min(1, volume));
    }
}

/**
 * Get volume for a specific sound type
 * @param {string} soundType - Sound type name
 * @returns {number} Volume level (0.0 - 1.0)
 */
export function getVolume(soundType) {
    return settings.volumes[soundType] ?? 1.0;
}

/**
 * Set all volumes at once
 * @param {Object} volumes - Object with sound type keys and volume values
 */
export function setAllVolumes(volumes) {
    for (const [key, value] of Object.entries(volumes)) {
        if (settings.volumes.hasOwnProperty(key)) {
            settings.volumes[key] = Math.max(0, Math.min(1, value));
        }
    }
}

/**
 * Get all current volume settings
 * @returns {Object} Copy of current volume settings
 */
export function getAllVolumes() {
    return { ...settings.volumes };
}

// ===== UTILITY FUNCTIONS =====

function createOscillator(type, frequency, duration, gain = 0.5) {
    if (!initialized || !settings.enabled) return null;
    
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    osc.type = type;
    osc.frequency.value = frequency;
    gainNode.gain.value = gain * settings.sfxVolume;
    
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    
    return { osc, gainNode, duration };
}

function createNoise(duration, gain = 0.3) {
    if (!initialized || !settings.enabled) return null;
    
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gain * settings.sfxVolume;
    
    noise.connect(gainNode);
    gainNode.connect(masterGain);
    
    return { noise, gainNode, duration };
}

// ===== PLAYER LASER SOUND =====
// A satisfying "pew" sound - higher pitched, quick attack

export function playPlayerLaser() {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.playerLaser <= 0) return;
    resume();
    
    const vol = settings.volumes.playerLaser;
    const now = audioContext.currentTime;
    const duration = 0.15;
    
    // Main tone - bright synth "pew"
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    // Frequency sweep down for "pew" effect
    osc1.frequency.setValueAtTime(1800, now);
    osc1.frequency.exponentialRampToValueAtTime(400, now + duration * 0.7);
    
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + duration * 0.7);
    
    // Filter sweep
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration);
    filter.Q.value = 2;
    
    // Envelope - quick attack, fast decay
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35 * settings.sfxVolume * vol, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    // Connect
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
}

// ===== ENEMY LASER SOUND =====
// Lower pitched, slightly different timbre, with positional volume

export function playEnemyLaser(distance, maxDistance = 800) {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.enemyLaser <= 0) return;
    resume();
    
    const vol = settings.volumes.enemyLaser;
    
    // Calculate volume based on distance (linear falloff)
    // At distance 0 = full volume, at maxDistance or beyond = silent
    const volumeMultiplier = Math.max(0, 1 - (distance / maxDistance));
    
    // If too far away, don't even play the sound
    if (volumeMultiplier < 0.05) return;
    
    const now = audioContext.currentTime;
    const duration = 0.12;
    
    // Main tone - deeper, more menacing
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    
    // Lower frequency sweep for enemy lasers
    osc1.frequency.setValueAtTime(900, now);
    osc1.frequency.exponentialRampToValueAtTime(250, now + duration * 0.8);
    
    osc2.frequency.setValueAtTime(700, now);
    osc2.frequency.exponentialRampToValueAtTime(180, now + duration * 0.8);
    
    // Filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + duration);
    filter.Q.value = 3;
    
    // Envelope with distance-based volume
    const baseVolume = 0.25 * settings.sfxVolume * vol * volumeMultiplier;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(baseVolume, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    // Connect
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
}

// ===== TERRITORY CAPTURE SOUND =====
// Satisfying "whoosh" + chime for capturing land

export function playCaptureSound(isLocalPlayer = true) {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.capture <= 0) return;
    resume();
    
    const vol = settings.volumes.capture;
    const now = audioContext.currentTime;
    const volume = (isLocalPlayer ? 1.0 : 0.3) * vol;
    
    // Whoosh sound (filtered noise sweep)
    const bufferSize = audioContext.sampleRate * 0.4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
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
    
    // Chime/success tone (only for local player)
    if (isLocalPlayer) {
        // Pleasant chord: C5, E5, G5
        const frequencies = [523.25, 659.25, 783.99];
        const duration = 0.35;
        
        frequencies.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const oscGain = audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.03; // Slight stagger for arpeggio effect
            
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

// ===== LEVEL UP SOUND =====
// Epic fanfare - ascending notes with sparkle

export function playLevelUpSound() {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.levelUp <= 0) return;
    resume();
    
    const vol = settings.volumes.levelUp;
    const now = audioContext.currentTime;
    
    // Ascending fanfare notes
    const notes = [
        { freq: 523.25, time: 0 },      // C5
        { freq: 659.25, time: 0.08 },   // E5
        { freq: 783.99, time: 0.16 },   // G5
        { freq: 1046.5, time: 0.24 },   // C6 (octave up)
    ];
    
    // Main fanfare
    notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc.type = 'sine';
        osc2.type = 'triangle';
        osc.frequency.value = note.freq;
        osc2.frequency.value = note.freq * 2; // Octave above for brightness
        
        const startTime = now + note.time;
        const duration = 0.5 - note.time * 0.5; // Later notes sustain less
        
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
    
    // Sparkle/shimmer effect
    const sparkleCount = 8;
    for (let i = 0; i < sparkleCount; i++) {
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc.type = 'sine';
        const baseFreq = 2000 + Math.random() * 2000;
        osc.frequency.value = baseFreq;
        
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
    
    // Low "boom" for impact
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

// ===== DEATH SOUND =====
// Dramatic "shatter and fade" death sound

export function playDeathSound(isLocalPlayer = false, distance = 0, maxDistance = 400) {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.death <= 0) return;
    resume();
    
    const vol = settings.volumes.death;
    const now = audioContext.currentTime;
    
    let volume;
    if (isLocalPlayer) {
        // Local player death - full volume
        volume = 1.0 * vol;
    } else {
        // Other player death - distance-based volume
        const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
        
        // If too far, don't play at all
        if (distanceRatio < 0.1) return;
        
        volume = 0.5 * vol * distanceRatio;
    }
    
    // === Layer 1: Dramatic descending tone (the "soul leaving" sound) ===
    const descend1 = audioContext.createOscillator();
    const descend2 = audioContext.createOscillator();
    const descendGain = audioContext.createGain();
    const descendFilter = audioContext.createBiquadFilter();
    
    descend1.type = 'sine';
    descend2.type = 'triangle';
    
    // Mournful descending pitch
    descend1.frequency.setValueAtTime(600, now);
    descend1.frequency.exponentialRampToValueAtTime(80, now + 0.8);
    descend2.frequency.setValueAtTime(603, now); // Slight detune for thickness
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
    
    // === Layer 2: Soft "glass shatter" texture (filtered noise, short) ===
    const shatterDuration = 0.15;
    const shatterSize = audioContext.sampleRate * shatterDuration;
    const shatterBuffer = audioContext.createBuffer(1, shatterSize, audioContext.sampleRate);
    const shatterData = shatterBuffer.getChannelData(0);
    
    // Create crackly texture instead of pure noise
    for (let i = 0; i < shatterSize; i++) {
        const t = i / audioContext.sampleRate;
        // Crackling with decay
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
    
    // === Layer 3: Sub bass thump (impact feel) ===
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
    
    // === Layer 4: Dissonant "death chord" (only for local player) ===
    if (isLocalPlayer) {
        // Minor second interval - unsettling
        const deathChordFreqs = [180, 190, 270]; // Dissonant cluster
        
        deathChordFreqs.forEach((freq, i) => {
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

// ===== COIN/XP PICKUP SOUND =====
// Satisfying "bling" for picking up XP orbs

export function playCoinPickup() {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.coinPickup <= 0) return;
    resume();
    
    const vol = settings.volumes.coinPickup;
    const now = audioContext.currentTime;
    
    // Main chime tone
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    // Rising pitch for satisfying feel
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
    
    // Add sparkle overtone
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

// ===== KILL SOUND =====
// Triumphant sound when you eliminate another player

export function playKillSound() {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.kill <= 0) return;
    resume();
    
    const vol = settings.volumes.kill;
    const now = audioContext.currentTime;
    
    // === LAYER 1: Meaty bass thump ===
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
    
    // === LAYER 2: Punchy mid hit ===
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
    
    // === LAYER 3: "Cha-ching!" coin/bell sound ===
    const bellFreqs = [1318.5, 1568, 2093]; // E6, G6, C7 - bright major chord
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
    
    // === LAYER 4: Triumphant rising sweep ===
    const sweep = audioContext.createOscillator();
    const sweepGain = audioContext.createGain();
    const sweepFilter = audioContext.createBiquadFilter();
    
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(400, now + 0.02);
    sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    
    sweepFilter.type = 'bandpass';
    sweepFilter.frequency.setValueAtTime(600, now + 0.02);
    sweepFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
    sweepFilter.Q.value = 2;
    
    sweepGain.gain.setValueAtTime(0, now + 0.02);
    sweepGain.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * vol, now + 0.06);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(masterGain);
    
    sweep.start(now + 0.02);
    sweep.stop(now + 0.2);
    
    // === LAYER 5: Sparkle/shimmer ===
    for (let i = 0; i < 6; i++) {
        const sparkle = audioContext.createOscillator();
        const sparkleGain = audioContext.createGain();
        
        sparkle.type = 'sine';
        const baseFreq = 2500 + Math.random() * 2000;
        sparkle.frequency.value = baseFreq;
        
        const startTime = now + 0.05 + Math.random() * 0.15;
        const duration = 0.08 + Math.random() * 0.1;
        
        sparkleGain.gain.setValueAtTime(0, startTime);
        sparkleGain.gain.linearRampToValueAtTime(0.06 * settings.sfxVolume * vol, startTime + 0.01);
        sparkleGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        sparkle.connect(sparkleGain);
        sparkleGain.connect(masterGain);
        
        sparkle.start(startTime);
        sparkle.stop(startTime + duration);
    }
    
    // === LAYER 6: Final victory chord ===
    const chordFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 - full major chord
    chordFreqs.forEach((freq, i) => {
        const chime = audioContext.createOscillator();
        const chimeGain = audioContext.createGain();
        
        chime.type = 'sine';
        chime.frequency.value = freq;
        
        const startTime = now + 0.08 + i * 0.02;
        
        chimeGain.gain.setValueAtTime(0, startTime);
        chimeGain.gain.linearRampToValueAtTime(0.1 * settings.sfxVolume * vol, startTime + 0.015);
        chimeGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
        
        chime.connect(chimeGain);
        chimeGain.connect(masterGain);
        
        chime.start(startTime);
        chime.stop(startTime + 0.5);
    });
}

// ===== HIT SOUND =====
// When player takes damage

export function playHitSound() {
    if (!initialized || !settings.enabled) return;
    if (settings.volumes.hit <= 0) return;
    resume();
    
    const vol = settings.volumes.hit;
    const now = audioContext.currentTime;
    
    // Quick impact noise
    const bufferSize = audioContext.sampleRate * 0.1;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
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

// ===== FUSE SOUND (LOOPING) =====
// Burning fuse sound - like a firework fuse sizzling

export function startFuseSound() {
    if (!initialized || !settings.enabled) return;
    if (fuseSound) return; // Already playing
    resume();
    
    // Create a realistic burning fuse sound
    const noiseDuration = 1.5;
    const noiseBufferSize = audioContext.sampleRate * noiseDuration;
    const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    
    // Generate burning fuse texture - lots of sizzle and pops
    for (let i = 0; i < noiseBufferSize; i++) {
        const t = i / audioContext.sampleRate;
        
        // Constant sizzle/hiss (the main fuse burn)
        const hiss = (Math.random() * 2 - 1) * 0.5;
        
        // Frequent small crackles
        const smallCrackle = Math.random() > 0.7 ? (Math.random() * 2 - 1) * 0.6 : 0;
        
        // Occasional loud pops
        const pop = Math.random() > 0.97 ? (Math.random() * 2 - 1) * 1.0 : 0;
        
        // Sputtering variation
        const sputter = Math.sin(t * 150 + Math.random() * 2) * 0.2 * (Math.random() > 0.5 ? 1 : 0);
        
        noiseData[i] = hiss + smallCrackle + pop + sputter;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    
    // Highpass to remove mud
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1500;
    highpass.Q.value = 0.7;
    
    // Presence boost for that sizzle
    const presence = audioContext.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 5000;
    presence.Q.value = 1;
    presence.gain.value = 6;
    
    // Second layer - more constant burn tone
    const burnOsc = audioContext.createOscillator();
    burnOsc.type = 'sawtooth';
    burnOsc.frequency.value = 80;
    
    const burnGain = audioContext.createGain();
    burnGain.gain.value = 0.08;
    
    const burnFilter = audioContext.createBiquadFilter();
    burnFilter.type = 'bandpass';
    burnFilter.frequency.value = 200;
    burnFilter.Q.value = 3;
    
    // Main gain node
    fuseGainNode = audioContext.createGain();
    fuseGainNode.gain.value = 0;
    
    // Intensity variation LFO
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 12;
    
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 0.08;
    
    // Connect sizzle path
    noise.connect(highpass);
    highpass.connect(presence);
    presence.connect(fuseGainNode);
    
    // Connect burn path
    burnOsc.connect(burnFilter);
    burnFilter.connect(burnGain);
    burnGain.connect(fuseGainNode);
    
    // Connect LFO
    lfo.connect(lfoGain);
    lfoGain.connect(fuseGainNode.gain);
    
    fuseGainNode.connect(masterGain);
    
    noise.start();
    burnOsc.start();
    lfo.start();
    
    fuseSound = { noise, burnOsc, lfo, lfoGain, burnGain };
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
            } catch (e) {
                // Already stopped
            }
            fuseSound = null;
            fuseGainNode = null;
            fuseFilterNode = null;
        }, 150);
    } catch (e) {
        fuseSound = null;
        fuseGainNode = null;
        fuseFilterNode = null;
    }
}

export function updateFuseVolume(distanceRatio) {
    // distanceRatio: 0 = fuse is far (start of trail), 1 = fuse is at player (about to die)
    if (!fuseGainNode || !initialized || !settings.enabled) return;
    if (settings.volumes.playerFuse <= 0) return;
    
    const vol = settings.volumes.playerFuse;
    // Volume increases as fuse gets closer - MORE PROMINENT now
    // Range from 0.15 (audible) to 0.45 (loud and urgent)
    const minVolume = 0.15;
    const maxVolume = 0.45;
    const volume = (minVolume + (maxVolume - minVolume) * distanceRatio) * settings.sfxVolume * vol;
    
    const now = audioContext.currentTime;
    fuseGainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
    
    // Boost high frequencies as it gets closer (more urgent)
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

// ===== ENEMY FUSE SOUND (LOOPING) =====
// Different fuse sound for enemies - lower pitched, more ominous

export function startEnemyFuseSound() {
    if (!initialized || !settings.enabled) return;
    if (enemyFuseSound) return; // Already playing
    resume();
    
    // Enemy fuse - similar sizzle but lower/darker tone
    const noiseDuration = 1.5;
    const noiseBufferSize = audioContext.sampleRate * noiseDuration;
    const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    
    // Generate burning fuse - lower frequency emphasis
    for (let i = 0; i < noiseBufferSize; i++) {
        const t = i / audioContext.sampleRate;
        
        // Hiss
        const hiss = (Math.random() * 2 - 1) * 0.4;
        
        // Crackles
        const crackle = Math.random() > 0.75 ? (Math.random() * 2 - 1) * 0.5 : 0;
        
        // Pops
        const pop = Math.random() > 0.96 ? (Math.random() * 2 - 1) * 0.8 : 0;
        
        // Sputter
        const sputter = Math.sin(t * 100 + Math.random() * 2) * 0.15 * (Math.random() > 0.6 ? 1 : 0);
        
        noiseData[i] = hiss + crackle + pop + sputter;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    
    // Lower frequency filter for darker tone
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 800;
    highpass.Q.value = 0.5;
    
    const presence = audioContext.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2500; // Lower than player fuse
    presence.Q.value = 1.5;
    presence.gain.value = 5;
    
    // Deeper burn tone
    const burnOsc = audioContext.createOscillator();
    burnOsc.type = 'sawtooth';
    burnOsc.frequency.value = 50; // Lower than player's
    
    const burnGain = audioContext.createGain();
    burnGain.gain.value = 0.1;
    
    const burnFilter = audioContext.createBiquadFilter();
    burnFilter.type = 'bandpass';
    burnFilter.frequency.value = 150;
    burnFilter.Q.value = 2;
    
    // Main gain node
    enemyFuseGainNode = audioContext.createGain();
    enemyFuseGainNode.gain.value = 0;
    
    // LFO
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 0.06;
    
    // Connect paths
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
    
    enemyFuseSound = { noise, burnOsc, lfo, lfoGain, burnGain };
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
            } catch (e) {
                // Already stopped
            }
            enemyFuseSound = null;
            enemyFuseGainNode = null;
            enemyFuseFilterNode = null;
        }, 150);
    } catch (e) {
        enemyFuseSound = null;
        enemyFuseGainNode = null;
        enemyFuseFilterNode = null;
    }
}

export function updateEnemyFuseVolume(distance, maxDistance = 300) {
    // maxDistance reduced to 300 - only audible when fairly close
    if (!enemyFuseGainNode || !initialized || !settings.enabled) return;
    if (settings.volumes.enemyFuse <= 0) return;
    
    const vol = settings.volumes.enemyFuse;
    const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
    
    // If too far, silent
    if (distanceRatio < 0.1) {
        const now = audioContext.currentTime;
        enemyFuseGainNode.gain.linearRampToValueAtTime(0, now + 0.05);
        return;
    }
    
    // More prominent volume: 0.08 (edge of range) to 0.3 (close)
    const minVolume = 0.08;
    const maxVolume = 0.30;
    const volume = (minVolume + (maxVolume - minVolume) * distanceRatio) * settings.sfxVolume * vol;
    
    const now = audioContext.currentTime;
    enemyFuseGainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
    
    // Adjust brightness based on distance
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

// ===== SPEED RUSH SOUND (LOOPING) =====
// Whooshing rush sound when player has 10%+ speed buff - intensifies with speed

export function startSpeedRushSound() {
    if (!initialized || !settings.enabled) return;
    if (speedRushSound) return; // Already playing
    resume();
    
    // Create an energetic rushing/whoosh sound
    const noiseDuration = 2.0;
    const noiseBufferSize = audioContext.sampleRate * noiseDuration;
    const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    
    // Generate rushing wind texture with more energy
    for (let i = 0; i < noiseBufferSize; i++) {
        const t = i / audioContext.sampleRate;
        
        // Base rushing noise
        const rush = (Math.random() * 2 - 1) * 0.5;
        
        // Rhythmic whooshing for movement feel
        const whoosh = Math.sin(t * 12) * 0.2 * (Math.random() * 2 - 1);
        
        // Subtle pulsing undertone
        const pulse = Math.sin(t * 6) * 0.08;
        
        noiseData[i] = rush + whoosh + pulse;
    }
    
    speedRushNoiseSource = audioContext.createBufferSource();
    speedRushNoiseSource.buffer = noiseBuffer;
    speedRushNoiseSource.loop = true;
    speedRushNoiseSource.playbackRate.value = 1.0;
    
    // Bandpass filter for whoosh character
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 600;
    bandpass.Q.value = 1.2;
    
    // Highpass to keep it clean
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 300;
    highpass.Q.value = 0.7;
    
    // Tonal component - energetic hum
    speedRushOscillator = audioContext.createOscillator();
    speedRushOscillator.type = 'sawtooth';
    speedRushOscillator.frequency.value = 100;
    
    const oscGain = audioContext.createGain();
    oscGain.gain.value = 0.02;
    
    const oscFilter = audioContext.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 200;
    
    // Main gain node
    speedRushGainNode = audioContext.createGain();
    speedRushGainNode.gain.value = 0; // Start silent, will fade in
    
    // Connect noise path
    speedRushNoiseSource.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(speedRushGainNode);
    
    // Connect oscillator path
    speedRushOscillator.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(speedRushGainNode);
    
    speedRushGainNode.connect(masterGain);
    
    speedRushNoiseSource.start();
    speedRushOscillator.start();
    
    speedRushSound = { noiseSource: speedRushNoiseSource, oscillator: speedRushOscillator, oscGain, oscFilter, bandpass };
    
    // Fade in
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
            } catch (e) {
                // Already stopped
            }
            speedRushSound = null;
            speedRushGainNode = null;
            speedRushNoiseSource = null;
            speedRushOscillator = null;
        }, 250);
    } catch (e) {
        speedRushSound = null;
        speedRushGainNode = null;
        speedRushNoiseSource = null;
        speedRushOscillator = null;
    }
}

export function updateSpeedRushSound(speedMultiplier) {
    // speedMultiplier: 1.1+ triggers the sound, up to ~1.2 at max buff
    // This sound ONLY plays when speed buff is 10% or more
    if (!speedRushSound || !speedRushGainNode || !initialized || !settings.enabled) return;
    if (settings.volumes.speedRush <= 0) return;
    
    const vol = settings.volumes.speedRush ?? 0.5;
    const now = audioContext.currentTime;
    
    // Calculate intensity based on speed (0 at 1.1x, 1 at 1.2x)
    // Sound intensity scales from 10% buff to 20% buff
    const speedRatio = Math.min(1.0, Math.max(0, (speedMultiplier - 1.1) / 0.1));
    
    // Playback rate increases with speed (1.0 to 1.5)
    const minRate = 1.0;
    const maxRate = 1.5;
    const playbackRate = minRate + (maxRate - minRate) * speedRatio;
    
    if (speedRushNoiseSource) {
        speedRushNoiseSource.playbackRate.linearRampToValueAtTime(playbackRate, now + 0.1);
    }
    
    // Volume increases with speed intensity
    const minVolume = 0.1;
    const maxVolume = 0.25;
    const volume = (minVolume + (maxVolume - minVolume) * speedRatio) * settings.sfxVolume * vol;
    speedRushGainNode.gain.linearRampToValueAtTime(volume, now + 0.1);
    
    // Oscillator pitch increases
    if (speedRushOscillator) {
        const minFreq = 100;
        const maxFreq = 180;
        const freq = minFreq + (maxFreq - minFreq) * speedRatio;
        speedRushOscillator.frequency.linearRampToValueAtTime(freq, now + 0.1);
    }
    
    // Bandpass center frequency shifts up with speed
    if (speedRushSound.bandpass) {
        const minBandFreq = 500;
        const maxBandFreq = 1200;
        const bandFreq = minBandFreq + (maxBandFreq - minBandFreq) * speedRatio;
        speedRushSound.bandpass.frequency.linearRampToValueAtTime(bandFreq, now + 0.1);
    }
}

export function isSpeedRushSoundPlaying() {
    return speedRushSound !== null;
}

// Legacy aliases for backward compatibility (these do nothing now - wind sound removed)
export function startTrailSound() {
    // Wind sound removed - no longer plays when claiming territory
}

export function stopTrailSound() {
    // Wind sound removed
}

export function updateTrailSound(speedMultiplier) {
    // Wind sound removed
}

export function isTrailSoundPlaying() {
    return false;
}

// ============================================
// BACKGROUND MUSIC - Playlist with Shuffle
// ============================================

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Fetch playlist from server and start playing
 */
async function fetchPlaylist() {
    try {
        const response = await fetch('/api/playlist');
        const data = await response.json();
        bgMusicPlaylist = data.tracks || [];
        console.log("[SoundManager] Playlist loaded:", bgMusicPlaylist.length, "tracks");
        return bgMusicPlaylist.length > 0;
    } catch (e) {
        console.warn("[SoundManager] Could not fetch playlist:", e);
        return false;
    }
}

/**
 * Play the next track in the shuffled playlist
 */
function playNextTrack() {
    if (!bgMusicPlaying || bgMusicShuffled.length === 0) return;
    
    // Get current track
    const track = bgMusicShuffled[bgMusicCurrentIndex];
    const trackUrl = `/music/playlist/${encodeURIComponent(track)}`;
    
    console.log("[SoundManager] Playing track:", track, `(${bgMusicCurrentIndex + 1}/${bgMusicShuffled.length})`);
    
    // Create new audio element for this track
    if (bgMusicAudio) {
        bgMusicAudio.pause();
        bgMusicAudio.removeEventListener('ended', onTrackEnded);
    }
    
    bgMusicAudio = new Audio(trackUrl);
    bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
    bgMusicAudio.addEventListener('ended', onTrackEnded);
    
    bgMusicAudio.play().catch(e => {
        console.warn("[SoundManager] Could not play track:", e);
        // Try next track on error
        advanceToNextTrack();
    });
}

/**
 * Called when a track finishes playing
 */
function onTrackEnded() {
    advanceToNextTrack();
}

/**
 * Advance to the next track, reshuffling if we've played all tracks
 */
function advanceToNextTrack() {
    if (!bgMusicPlaying) return;
    
    bgMusicCurrentIndex++;
    
    // If we've played all tracks, reshuffle
    if (bgMusicCurrentIndex >= bgMusicShuffled.length) {
        console.log("[SoundManager] All tracks played, reshuffling playlist");
        bgMusicShuffled = shuffleArray(bgMusicPlaylist);
        bgMusicCurrentIndex = 0;
    }
    
    playNextTrack();
}

/**
 * Start background music (loads playlist and plays shuffled)
 */
export async function startBackgroundMusic() {
    if (!settings.enabled || bgMusicPlaying) return;
    
    bgMusicPlaying = true;
    
    // Fetch playlist if not loaded
    if (bgMusicPlaylist.length === 0) {
        const hasPlaylist = await fetchPlaylist();
        if (!hasPlaylist) {
            console.warn("[SoundManager] No tracks in playlist");
            bgMusicPlaying = false;
            return;
        }
    }
    
    // Shuffle the playlist
    bgMusicShuffled = shuffleArray(bgMusicPlaylist);
    bgMusicCurrentIndex = 0;
    
    // Start playing first track
    playNextTrack();
    
    console.log("[SoundManager] Background music started with", bgMusicPlaylist.length, "tracks");
}

/**
 * Stop background music
 */
export function stopBackgroundMusic() {
    if (!bgMusicPlaying) return;
    
    bgMusicPlaying = false;
    
    if (bgMusicAudio) {
        bgMusicAudio.removeEventListener('ended', onTrackEnded);
        
        // Fade out
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
    
    console.log("[SoundManager] Background music stopped");
}

/**
 * Update background music tempo based on game state
 * (Currently disabled - music plays at constant speed)
 */
export function updateBackgroundMusicTempo(isSnipped, territoryPercent) {
    // Music plays at constant normal speed
}

/**
 * Check if background music is playing
 */
export function isBackgroundMusicPlaying() {
    return bgMusicPlaying;
}

/**
 * Update music volume (call when settings change)
 */
export function updateMusicVolume() {
    if (bgMusicAudio) {
        bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
    }
}

export default {
    init,
    resume,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    setEnabled,
    setVolume,
    getVolume,
    setAllVolumes,
    getAllVolumes,
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
    updateMusicVolume
};
