import jquery from "jquery";
import { Color } from "../core";
import * as client from "../game-client";
import { consts } from "../../config.js";
import * as SoundManager from "../sound-manager.js";

// Drone rendering constants
const DRONE_VISUAL_RADIUS = consts.DRONE_RADIUS || 10;

// Enemy type colors and styles
const ENEMY_STYLES = {
	basic:   { color: "rgba(200, 60, 60, 0.9)",  outline: "rgba(90, 20, 20, 0.9)" },     // Red - basic
	charger: { color: "rgba(255, 140, 0, 0.9)",  outline: "rgba(140, 70, 0, 0.9)" },     // Orange - charges at player
	tank:    { color: "rgba(100, 100, 180, 0.9)", outline: "rgba(40, 40, 100, 0.9)" },   // Blue - slow, high HP
	swarm:   { color: "rgba(150, 220, 80, 0.9)", outline: "rgba(70, 120, 30, 0.9)" },    // Green - small, fast, groups
	sniper:  { color: "rgba(180, 60, 180, 0.9)", outline: "rgba(90, 20, 90, 0.9)" },     // Purple - keeps distance
	// Boss types
	titan:     { color: "rgba(80, 80, 80, 0.95)",   outline: "rgba(40, 40, 40, 0.95)" },   // Dark gray - giant slow boss
	berserker: { color: "rgba(220, 50, 50, 0.95)",  outline: "rgba(120, 20, 20, 0.95)" },  // Deep red - charging boss
	summoner:  { color: "rgba(100, 50, 150, 0.95)", outline: "rgba(50, 20, 80, 0.95)" }    // Dark purple - spawns minions
};

const SHADOW_OFFSET = 5;
const ANIMATE_FRAMES = 24;
const MIN_BAR_WIDTH = 65;
const BAR_HEIGHT = 45;
const BAR_WIDTH = 400;
const PLAYER_RADIUS = consts.CELL_WIDTH / 2;

// Territory outline constants
const TERRITORY_OUTLINE_WIDTH = 2.5;

// Capture feedback constants
const CAPTURE_FLASH_TIME_SEC = 1.0;
const PARTICLE_COUNT = 40;
const PULSE_RADIUS_START = 10;
const PULSE_RADIUS_END = 120;
const PULSE_TIME = 0.8;

// XP meter tweening
const XP_TWEEN_DURATION = 0.4;

let canvas, ctx, offscreenCanvas, offctx, canvasWidth, canvasHeight, gameWidth, gameHeight;
const $ = jquery;

// Death animation system
const deathParticles = [];
let screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
const dyingPlayers = []; // Track players with death animations

// Loot coin animation system
const lootCoins = []; // Animated coins dropping from deaths

// Hitscan laser effects (drone shots)
const hitscanEffects = [];

// Capture feedback effects
const captureEffects = [];

// XP meter tweening state
const xpMeterTween = {
	startValue: 0,
	targetValue: 0,
	currentValue: 0,
	startTime: 0,
	duration: XP_TWEEN_DURATION * 1000
};

// Local player outline thickening state
let localOutlineThicken = {
	active: false,
	startTime: 0,
	duration: 500 // ms
};

// Speed buff tracking for sound and visual effects
let trailStartTime = null; // When player left territory (null if in territory)
let lastSpeedBuff = 1.0;   // Last calculated speed multiplier
let speedRushActive = false; // Whether speed rush sound is playing
let soundInitialized = false; // Whether sound manager has been initialized
const SPEED_TRAIL_THRESHOLD = 1.1; // 10% speed buff to show trail/spikes
let lastPlayerPos = null; // Track player position for speed trail

// Upgrade UI state
let upgradeUIVisible = false;
let upgradeChoices = [];
let upgradeNewLevel = 1;
let hoveredUpgrade = -1; // Index of hovered upgrade card (-1 = none)

// Rarity colors for upgrade cards
const RARITY_COLORS = {
	basic: '#9E9E9E',      // Gray
	rare: '#2196F3',       // Blue  
	legendary: '#FFD700'   // Gold
};

// Speed spike state - must be declared before reset() is called
let speedSpikeState = {
	active: false,
	playerX: 0,
	playerY: 0,
	playerAngle: 0,
	speedRatio: 0,
	baseColor: null,
	pulsePhase: 0
};

$(() => {
	canvas = $("#main-ui")[0];
	ctx = canvas.getContext("2d");
	offscreenCanvas = document.createElement("canvas");
	offctx = offscreenCanvas.getContext("2d");
	updateSize();
	
	// Mouse tracking for free movement
	canvas.addEventListener("mousemove", handleMouseMove);
	canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
	canvas.addEventListener("touchstart", handleTouchMove, { passive: false });
	
	// Keyboard and mouse input handlers
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("keyup", handleKeyUp);
	canvas.addEventListener("click", handleClick);

	// Unlock audio on any first interaction (menu buttons, canvas, etc.)
	const unlockAudio = () => {
		initSoundOnInteraction();
	};
	document.addEventListener("pointerdown", unlockAudio, { once: true });
	document.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
	
	// Send target angle on every frame
	setInterval(() => {
		client.sendTargetAngle();
	}, 1000 / 60);
	
	// Setup settings panel
	setupSettingsPanel();
});

function handleKeyDown(e) {
	// Initialize sound on first key press
	initSoundOnInteraction();
	
	// Handle upgrade selection with number keys
	if (upgradeUIVisible && upgradeChoices && upgradeChoices.length > 0) {
		const key = e.key;
		if (key === '1' && upgradeChoices[0]) {
			client.selectUpgrade(upgradeChoices[0].id);
			return;
		}
		if (key === '2' && upgradeChoices[1]) {
			client.selectUpgrade(upgradeChoices[1].id);
			return;
		}
		if (key === '3' && upgradeChoices[2]) {
			client.selectUpgrade(upgradeChoices[2].id);
			return;
		}
		// Block other input while upgrade UI is open
		return;
	}
	
	// WASD movement controls
	const key = e.key.toLowerCase();
	if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
		client.setKeyState(key, true);
	}
}

function handleKeyUp(e) {
	// Block input while upgrade UI is open
	if (upgradeUIVisible) return;
	
	// WASD movement controls
	const key = e.key.toLowerCase();
	if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
		client.setKeyState(key, false);
	}
}

function handleClick(e) {
	// Initialize sound on first click
	initSoundOnInteraction();
	
	// Handle upgrade selection by clicking cards
	if (upgradeUIVisible && upgradeChoices && upgradeChoices.length > 0) {
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		
		const cardIndex = getHoveredUpgradeCard(mouseX, mouseY);
		if (cardIndex >= 0 && upgradeChoices[cardIndex]) {
			client.selectUpgrade(upgradeChoices[cardIndex].id);
		}
	}
}

// Settings panel setup
let settingsOpen = false;

function setupSettingsPanel() {
	const settingsPanel = document.getElementById('settings');
	const toggleBtn = document.querySelector('.toggle');
	const closeBtn = document.getElementById('settings-close');
	const menuBtn = document.getElementById('settings-menu-btn');
	
	function openSettings() {
		settingsOpen = true;
		settingsPanel.style.display = 'block';
	}
	
	function closeSettings() {
		settingsOpen = false;
		settingsPanel.style.display = 'none';
	}
	
	// Toggle settings panel
	if (toggleBtn) {
		toggleBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (settingsOpen) {
				closeSettings();
			} else {
				openSettings();
			}
		});
	}
	
	// Close button
	if (closeBtn) {
		closeBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			closeSettings();
		});
	}
	
	// Main menu button
	if (menuBtn) {
		menuBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			closeSettings();
			// Trigger main menu (same as other .menu buttons)
			setTimeout(() => {
				$('.menu').first().trigger('click');
			}, 50);
		});
	}
	
	// Volume sliders
	const masterSlider = document.getElementById('vol-master');
	const musicSlider = document.getElementById('vol-music');
	const sfxSlider = document.getElementById('vol-sfx');
	
	const masterVal = document.getElementById('vol-master-val');
	const musicVal = document.getElementById('vol-music-val');
	const sfxVal = document.getElementById('vol-sfx-val');
	
	// Master volume
	if (masterSlider) {
		masterSlider.addEventListener('input', (e) => {
			const val = parseInt(e.target.value);
			masterVal.textContent = val + '%';
			SoundManager.setMasterVolume(val / 100);
		});
	}
	
	// Music volume
	if (musicSlider) {
		musicSlider.addEventListener('input', (e) => {
			const val = parseInt(e.target.value);
			musicVal.textContent = val + '%';
			if (SoundManager.setMusicVolume) {
				SoundManager.setMusicVolume(val / 100);
			}
		});
	}
	
	// SFX volume
	if (sfxSlider) {
		sfxSlider.addEventListener('input', (e) => {
			const val = parseInt(e.target.value);
			sfxVal.textContent = val + '%';
			if (SoundManager.setSfxVolume) {
				SoundManager.setSfxVolume(val / 100);
			}
		});
	}
	
	// Expandable "How to Play" section
	const howToPlayToggle = document.getElementById('how-to-play-toggle');
	const howToPlayContent = document.getElementById('how-to-play-content');
	const expandableSection = howToPlayToggle ? howToPlayToggle.closest('.expandable') : null;
	
	if (howToPlayToggle && howToPlayContent) {
		howToPlayToggle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const isOpen = howToPlayContent.style.display !== 'none';
			howToPlayContent.style.display = isOpen ? 'none' : 'block';
			if (expandableSection) {
				expandableSection.classList.toggle('open', !isOpen);
			}
		});
	}
}

function initSoundOnInteraction() {
	if (!soundInitialized) {
		SoundManager.init();
		SoundManager.resume();
		soundInitialized = true;
		// Start background music
		SoundManager.startBackgroundMusic();
	}
}

function handleMouseMove(e) {
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	
	// Track hovered upgrade card
	if (upgradeUIVisible) {
		hoveredUpgrade = getHoveredUpgradeCard(mouseX, mouseY);
	}
	
	client.updateMousePosition(e.clientX, e.clientY, rect, canvasWidth, canvasHeight, zoom);
}

function handleTouchMove(e) {
	e.preventDefault();
	if (e.touches.length > 0) {
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		client.updateMousePosition(touch.clientX, touch.clientY, rect, canvasWidth, canvasHeight, zoom);
	}
}

let playerPortion, portionsRolling, barProportionRolling, animateTo, offset, user, zoom, showedDead;
let lastKillerName = null; // Track who killed the player

function updateSize() {
	let changed = false;
	if (canvasWidth != window.innerWidth) {
		gameWidth = canvasWidth = offscreenCanvas.width = canvas.width = window.innerWidth;
		changed = true;
	}
	if (canvasHeight != window.innerHeight) {
		canvasHeight = offscreenCanvas.height = canvas.height = window.innerHeight;
		gameHeight = canvasHeight - BAR_HEIGHT;
		changed = true;
	}
	if (changed && user) centerOnPlayer(user, offset);
}

function reset() {
	playerPortion = [];
	portionsRolling = [];
	barProportionRolling = [];
	animateTo = [0, 0];
	offset = [0, 0];
	user = null;
	zoom = 1;
	showedDead = false;
	lastKillerName = null;
	
	// Clear death effects
	deathParticles.length = 0;
	dyingPlayers.length = 0;
	screenShake.intensity = 0;
	screenShake.x = 0;
	screenShake.y = 0;
	
	// Clear loot coin animations
	lootCoins.length = 0;
	
	// Clear hitscan effects
	hitscanEffects.length = 0;
	
	// Clear capture effects
	captureEffects.length = 0;
	
	// Reset XP meter tween
	xpMeterTween.startValue = 0;
	xpMeterTween.targetValue = 0;
	xpMeterTween.currentValue = 0;
	xpMeterTween.startTime = 0;
	
	// Reset outline thickening
	localOutlineThicken.active = false;
	
	// Reset speed buff sound and visual spike state
	trailStartTime = null;
	lastSpeedBuff = 1.0;
	if (speedRushActive) {
		SoundManager.stopSpeedRushSound();
		speedRushActive = false;
	}
	clearSpeedTrailParticles();
	
	// Reset upgrade UI
	upgradeUIVisible = false;
	upgradeChoices = [];
	upgradeNewLevel = 1;
	hoveredUpgrade = -1;
	
	// Restart background music on respawn
	if (soundInitialized && !SoundManager.isBackgroundMusicPlaying()) {
		SoundManager.startBackgroundMusic();
	}
}

reset();

// Paint methods
function paintGridBackground(ctx) {
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// Background
	ctx.fillStyle = "rgb(211, 225, 237)";
	ctx.fillRect(0, 0, mapSize, mapSize);
	
	// Grid lines (subtle)
	ctx.strokeStyle = "rgba(180, 200, 220, 0.5)";
	ctx.lineWidth = 1;
	const gridSpacing = consts.CELL_WIDTH * 2;
	
	for (let x = 0; x <= mapSize; x += gridSpacing) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, mapSize);
		ctx.stroke();
	}
	for (let y = 0; y <= mapSize; y += gridSpacing) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(mapSize, y);
		ctx.stroke();
	}
	
	// Border
	ctx.fillStyle = "lightgray";
	ctx.fillRect(-consts.BORDER_WIDTH, 0, consts.BORDER_WIDTH, mapSize);
	ctx.fillRect(-consts.BORDER_WIDTH, -consts.BORDER_WIDTH, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
	ctx.fillRect(mapSize, 0, consts.BORDER_WIDTH, mapSize);
	ctx.fillRect(-consts.BORDER_WIDTH, mapSize, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
}

function paintUIBar(ctx) {
	// UI Bar background - gray color
	ctx.fillStyle = "#3a3a3a";
	ctx.fillRect(0, 0, canvasWidth, BAR_HEIGHT);
	
	// Reset text alignment
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";

	// Calculate rank first (needed for right side display)
	const sorted = [];
	client.getPlayers().forEach(val => {
		sorted.push({ player: val, portion: playerPortion[val.num] || 0 });
	});
	sorted.sort((a, b) => {
		return (a.portion === b.portion) ? a.player.num - b.player.num : b.portion - a.portion;
	});

	// Get user stats
	const userPortions = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
	const score = (userPortions * 100).toFixed(2) + "%";
	const kills = client.getKills();
	const level = user.level || 1;
	const droneCount = user.droneCount || level;

	// === TOP LEFT: Score, Kills, Drones (horizontal) ===
	let xOffset = 50;
	const centerY = BAR_HEIGHT / 2 + 6;

	// Score
	ctx.fillStyle = "#FFD700";
	ctx.font = "bold 18px Changa";
	ctx.fillText("Score:", xOffset, centerY);
	xOffset += ctx.measureText("Score:").width + 5;
	ctx.fillStyle = "white";
	ctx.fillText(score, xOffset, centerY);
	xOffset += ctx.measureText(score).width + 20;

	// Kills
	ctx.fillStyle = "#FF6B6B";
	ctx.font = "bold 18px Changa";
	ctx.fillText("Kills:", xOffset, centerY);
	xOffset += ctx.measureText("Kills:").width + 5;
	ctx.fillStyle = "white";
	ctx.fillText(kills, xOffset, centerY);
	xOffset += ctx.measureText(String(kills)).width + 20;

	// Drones
	ctx.fillStyle = "#88CCFF";
	ctx.font = "bold 18px Changa";
	ctx.fillText("Drones:", xOffset, centerY);
	xOffset += ctx.measureText("Drones:").width + 5;
	ctx.fillStyle = "white";
	ctx.fillText(droneCount, xOffset, centerY);

	// === TOP CENTER: Run Timer ===
	const stats = client.getEnemyStats();
	const runTime = stats && stats.runTime != null ? stats.runTime : 0;
	const minutes = Math.floor(runTime / 60);
	const seconds = Math.floor(runTime % 60);
	const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
	
	ctx.font = "bold 24px Changa";
	ctx.textAlign = "center";
	ctx.fillStyle = "#FFFFFF";
	ctx.fillText(timerText, canvasWidth / 2, centerY);

	// === TOP RIGHT: Rank ===
	const rank = sorted.findIndex(val => val.player === user);
	const rankNum = (rank === -1 ? "--" : rank + 1);
	
	ctx.font = "bold 18px Changa";
	ctx.textAlign = "right";
	
	// Draw value first (white), then label (green) to the left
	const valueText = rankNum + " of " + sorted.length;
	const labelText = "Rank: ";
	const valueWidth = ctx.measureText(valueText).width;
	const labelWidth = ctx.measureText(labelText).width;
	
	// Position from right edge
	const rightPadding = 15;
	ctx.fillStyle = "white";
	ctx.fillText(valueText, canvasWidth - rightPadding, centerY);
	ctx.fillStyle = "#98FB98";
	ctx.fillText(labelText, canvasWidth - rightPadding - valueWidth, centerY);
	
	ctx.textAlign = "left";

	// Rolling the leaderboard bars
	if (sorted.length > 0) {
		const maxPortion = sorted[0].portion || 1;
		client.getPlayers().forEach(player => {
			const rolling = barProportionRolling[player.num];
			if (rolling) {
				rolling.value = (playerPortion[player.num] || 0) / maxPortion;
				rolling.update();
			}
		});
	}

	// Show leaderboard
	const leaderboardNum = Math.min(consts.LEADERBOARD_NUM, sorted.length);
	ctx.font = "18px Changa";
	for (let i = 0; i < leaderboardNum; i++) {
		const { player } = sorted[i];
		const name = player.name || "Unnamed";
		const portion = barProportionRolling[player.num] ? barProportionRolling[player.num].lag : 0;
		const nameWidth = ctx.measureText(name).width;
		const barSize = Math.ceil((BAR_WIDTH - MIN_BAR_WIDTH) * portion + MIN_BAR_WIDTH);
		const barX = canvasWidth - barSize;
		const barY = BAR_HEIGHT * (i + 1);
		const offsetY = i == 0 ? 10 : 0;
		ctx.fillStyle = "rgba(10, 10, 10, .3)";
		ctx.fillRect(barX - 10, barY + 10 - offsetY, barSize + 10, BAR_HEIGHT + offsetY);
		ctx.fillStyle = player.baseColor.rgbString();
		ctx.fillRect(barX, barY, barSize, BAR_HEIGHT - SHADOW_OFFSET);
		ctx.fillStyle = player.shadowColor.rgbString();
		ctx.fillRect(barX, barY + BAR_HEIGHT - SHADOW_OFFSET, barSize, SHADOW_OFFSET);
		ctx.fillStyle = "black";
		ctx.fillText(name, barX - nameWidth - 15, barY + 27);
		const percentage = (portionsRolling[player.num] ? portionsRolling[player.num].lag * 100 : 0).toFixed(3) + "%";
		ctx.fillStyle = "white";
		ctx.fillText(percentage, barX + 5, barY + BAR_HEIGHT - 15);
	}
}

function paintBottomHPBar(ctx) {
	if (!user) return;
	
	const hp = user.hp ?? (consts.PLAYER_MAX_HP ?? 100);
	const maxHp = user.maxHp ?? (consts.PLAYER_MAX_HP ?? 100);
	
	// Bar dimensions (above the XP bar)
	const barWidth = 250;
	const barHeight = 18;
	const barX = (canvasWidth - barWidth) / 2;
	const barY = canvasHeight - 80; // Above XP bar
	
	const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
	
	// === DARK BACKGROUND ===
	ctx.fillStyle = "rgba(10, 10, 10, 0.5)";
	ctx.fillRect(barX - 35, barY - 2, barWidth + 45, barHeight + 4);
	
	// === HP LABEL (left side) ===
	ctx.font = "bold 14px Changa";
	ctx.fillStyle = "#FF6B6B";
	ctx.textAlign = "left";
	ctx.fillText("HP", barX - 30, barY + barHeight - 4);
	
	// === HP BAR TRACK (gray background) ===
	ctx.fillStyle = "rgba(60, 60, 60, 0.8)";
	ctx.fillRect(barX, barY, barWidth, barHeight - 3);
	ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
	ctx.fillRect(barX, barY + barHeight - 3, barWidth, 3);
	
	// === HP BAR FILL (color changes based on HP) ===
	if (hpRatio > 0) {
		const fillWidth = barWidth * hpRatio;
		let fillColor, shadowColor;
		if (hpRatio > 0.5) {
			fillColor = "#44ff44";
			shadowColor = "#228822";
		} else if (hpRatio > 0.25) {
			fillColor = "#ffcc00";
			shadowColor = "#cc9900";
		} else {
			fillColor = "#ff4444";
			shadowColor = "#aa2222";
		}
		ctx.fillStyle = fillColor;
		ctx.fillRect(barX, barY, fillWidth, barHeight - 3);
		ctx.fillStyle = shadowColor;
		ctx.fillRect(barX, barY + barHeight - 3, fillWidth, 3);
	}
	
	// === HP TEXT (on the bar) ===
	ctx.font = "13px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(Math.floor(hp) + "/" + Math.floor(maxHp), barX + barWidth / 2, barY + barHeight - 4);
}

function paintBottomXPBar(ctx) {
	if (!user) return;
	
	const level = user.level || 1;
	const xp = user.xp || 0;
	const xpPerLevel = user.xpPerLevel || ((consts.XP_BASE_PER_LEVEL || 50) + (level - 1) * (consts.XP_INCREMENT_PER_LEVEL || 25));
	
	// Bar dimensions (matching game style)
	const barWidth = 250;
	const barHeight = 28;
	const barX = (canvasWidth - barWidth) / 2;
	const barY = canvasHeight - 45;
	
	// Tweened XP for smooth animation
	const tweenedXp = updateXpMeterTween(xp);
	const progressRatio = Math.min(1, tweenedXp / xpPerLevel);
	
	// Get player color for the bar
	const baseColor = user.baseColor;
	const shadowColor = user.shadowColor;
	
	// === DARK BACKGROUND (like leaderboard style) ===
	ctx.fillStyle = "rgba(10, 10, 10, 0.5)";
	ctx.fillRect(barX - 60, barY - 2, barWidth + 70, barHeight + 4);
	
	// === LEVEL TEXT (left side) ===
	ctx.font = "bold 18px Changa";
	ctx.fillStyle = "#FFD700";
	ctx.textAlign = "left";
	const levelText = "Lv." + level;
	ctx.fillText(levelText, barX - 55, barY + barHeight - 8);
	
	// === XP BAR TRACK (gray background) ===
	ctx.fillStyle = "rgba(60, 60, 60, 0.8)";
	ctx.fillRect(barX, barY, barWidth, barHeight - SHADOW_OFFSET);
	ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
	ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, barWidth, SHADOW_OFFSET);
	
	// === XP BAR FILL (player color with shadow offset) ===
	if (progressRatio > 0) {
		const fillWidth = barWidth * progressRatio;
		ctx.fillStyle = baseColor.rgbString();
		ctx.fillRect(barX, barY, fillWidth, barHeight - SHADOW_OFFSET);
		ctx.fillStyle = shadowColor.rgbString();
		ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, fillWidth, SHADOW_OFFSET);
	}
	
	// === XP TEXT (on the bar) ===
	ctx.font = "16px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(Math.floor(xp) + "/" + xpPerLevel + " XP", barX + barWidth / 2, barY + barHeight - 9);
}

function paintDebugOverlay(ctx) {
	const stats = client.getEnemyStats();
	if (!stats) return;
	
	const enemyCount = stats.enemies != null ? stats.enemies : 0;
	const killCount = stats.kills != null ? stats.kills : client.getKills();
	const unlockedTypes = stats.unlockedTypes || ['basic'];
	const bossCount = stats.bossCount || 0;
	const nextBossIn = stats.nextBossIn != null ? stats.nextBossIn : 0;
	
	const lines = [
		`Enemies: ${enemyCount} (${bossCount} bosses)`,
		`Kills: ${killCount}`,
		`Types: ${unlockedTypes.join(', ')}`,
		`Next boss: ${nextBossIn.toFixed(1)}s`
	];
	
	ctx.save();
	ctx.font = "12px monospace";
	ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	
	const startX = 10;
	const startY = 8;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i], startX, startY + i * 14);
	}
	
	ctx.restore();
}

// ===== UPGRADE SELECTION UI =====

function paintUpgradeUI(ctx) {
	if (!upgradeChoices || upgradeChoices.length === 0) return;
	
	// Get player color for accent
	const playerColor = user && user.baseColor ? user.baseColor : null;
	const accentColor = playerColor ? playerColor.rgbString() : '#FFD700';
	const shadowAccent = user && user.shadowColor ? user.shadowColor.rgbString() : '#B8860B';
	
	// Dark overlay matching game style
	ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	
	// Card dimensions - more compact
	const cardWidth = 200;
	const cardHeight = 240;
	const cardGap = 25;
	const totalWidth = (cardWidth * 3) + (cardGap * 2);
	const startX = (canvasWidth - totalWidth) / 2;
	const startY = (canvasHeight - cardHeight) / 2 - 30;
	
	// Title banner background (like UI bar style)
	const bannerY = startY - 80;
	const bannerHeight = 50;
	ctx.fillStyle = "rgba(30, 30, 30, 0.9)";
	ctx.fillRect(startX - 20, bannerY, totalWidth + 40, bannerHeight);
	
	// Title accent bar (player color)
	ctx.fillStyle = accentColor;
	ctx.fillRect(startX - 20, bannerY, totalWidth + 40, 4);
	ctx.fillStyle = shadowAccent;
	ctx.fillRect(startX - 20, bannerY + bannerHeight - 4, totalWidth + 40, 4);
	
	// Title text
	ctx.save();
	ctx.font = "bold 28px Changa";
	ctx.fillStyle = accentColor;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(`LEVEL UP!`, canvasWidth / 2 - 50, bannerY + bannerHeight / 2);
	
	ctx.fillStyle = "white";
	ctx.font = "bold 24px Changa";
	ctx.fillText(`Lv.${upgradeNewLevel}`, canvasWidth / 2 + 60, bannerY + bannerHeight / 2);
	ctx.restore();
	
	// Draw each card
	for (let i = 0; i < upgradeChoices.length; i++) {
		const choice = upgradeChoices[i];
		const cardX = startX + i * (cardWidth + cardGap);
		const cardY = startY;
		const isHovered = (hoveredUpgrade === i);
		
		drawUpgradeCard(ctx, choice, cardX, cardY, cardWidth, cardHeight, isHovered, i + 1, playerColor);
	}
	
	// Instructions at bottom (subtle)
	ctx.save();
	ctx.font = "14px Changa";
	ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("Click or press 1, 2, 3", canvasWidth / 2, startY + cardHeight + 35);
	ctx.restore();
}

function drawUpgradeCard(ctx, choice, x, y, width, height, isHovered, keyNum, playerColor) {
	const rarityColor = RARITY_COLORS[choice.rarity] || RARITY_COLORS.basic;
	
	ctx.save();
	
	// Hover offset effect (lift up slightly)
	const yOffset = isHovered ? -8 : 0;
	y += yOffset;
	
	// Shadow (darker when hovered for depth)
	ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)";
	ctx.fillRect(x + 3, y + 5 - yOffset, width, height);
	
	// Main card background - match game's dark UI style
	ctx.fillStyle = isHovered ? "rgba(50, 50, 55, 0.95)" : "rgba(30, 30, 35, 0.95)";
	ctx.fillRect(x, y, width, height);
	
	// Top accent bar (rarity color with shadow offset like XP bar)
	const barHeight = 6;
	ctx.fillStyle = rarityColor;
	ctx.fillRect(x, y, width, barHeight - 2);
	// Darker shadow portion
	ctx.fillStyle = isHovered ? rarityColor : shadeColor(rarityColor, -30);
	ctx.fillRect(x, y + barHeight - 2, width, 2);
	
	// Subtle border
	ctx.strokeStyle = isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, width, height);
	
	// Key number badge (top-left, styled like game UI)
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	ctx.fillRect(x + 8, y + 14, 28, 24);
	ctx.fillStyle = isHovered ? "#FFD700" : "rgba(255, 255, 255, 0.6)";
	ctx.font = "bold 18px Changa";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(keyNum, x + 22, y + 26);
	
	// Rarity label (top-right)
	ctx.font = "bold 11px Changa";
	ctx.textAlign = "right";
	ctx.fillStyle = rarityColor;
	const rarityLabel = choice.rarity.toUpperCase();
	ctx.fillText(rarityLabel, x + width - 10, y + 22);
	
	// Upgrade name
	ctx.font = "bold 20px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(choice.name, x + width / 2, y + 55);
	
	// Horizontal divider line
	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 15, y + 75);
	ctx.lineTo(x + width - 15, y + 75);
	ctx.stroke();
	
	// Stack count (using player color accent if available)
	const currentStacks = choice.currentStacks || 0;
	ctx.font = "15px Changa";
	const stackColor = playerColor ? playerColor.rgbString() : '#88CCFF';
	ctx.fillStyle = stackColor;
	ctx.fillText(`${currentStacks} → ${currentStacks + 1}`, x + width / 2, y + 95);
	
	// Description (multiline) - more compact
	ctx.font = "13px Changa";
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	const descLines = choice.description.split('\n');
	let descY = y + 120;
	for (const line of descLines) {
		// Word wrap long lines
		const words = line.split(' ');
		let currentLine = '';
		for (const word of words) {
			const testLine = currentLine + (currentLine ? ' ' : '') + word;
			if (ctx.measureText(testLine).width > width - 24) {
				ctx.fillText(currentLine, x + width / 2, descY);
				descY += 18;
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) {
			ctx.fillText(currentLine, x + width / 2, descY);
			descY += 18;
		}
	}
	
	// Hover highlight glow (subtle, matching game style)
	if (isHovered) {
		ctx.strokeStyle = rarityColor;
		ctx.lineWidth = 2;
		ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
	}
	
	ctx.restore();
}

// Helper to darken a color
function shadeColor(color, percent) {
	// Handle rgba/rgb strings
	const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (match) {
		let r = parseInt(match[1]);
		let g = parseInt(match[2]);
		let b = parseInt(match[3]);
		r = Math.max(0, Math.min(255, r + percent));
		g = Math.max(0, Math.min(255, g + percent));
		b = Math.max(0, Math.min(255, b + percent));
		return `rgb(${r}, ${g}, ${b})`;
	}
	// Handle hex colors
	if (color.startsWith('#')) {
		let hex = color.slice(1);
		if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
		let r = parseInt(hex.substr(0, 2), 16);
		let g = parseInt(hex.substr(2, 2), 16);
		let b = parseInt(hex.substr(4, 2), 16);
		r = Math.max(0, Math.min(255, r + percent));
		g = Math.max(0, Math.min(255, g + percent));
		b = Math.max(0, Math.min(255, b + percent));
		return `rgb(${r}, ${g}, ${b})`;
	}
	return color;
}

// Check if mouse is over an upgrade card
function getHoveredUpgradeCard(mouseX, mouseY) {
	if (!upgradeUIVisible || !upgradeChoices || upgradeChoices.length === 0) return -1;
	
	// Must match paintUpgradeUI dimensions
	const cardWidth = 200;
	const cardHeight = 240;
	const cardGap = 25;
	const totalWidth = (cardWidth * 3) + (cardGap * 2);
	const startX = (canvasWidth - totalWidth) / 2;
	const startY = (canvasHeight - cardHeight) / 2 - 30;
	
	for (let i = 0; i < upgradeChoices.length; i++) {
		const cardX = startX + i * (cardWidth + cardGap);
		const cardY = startY;
		
		// Include hover lift area
		if (mouseX >= cardX && mouseX <= cardX + cardWidth &&
			mouseY >= cardY - 10 && mouseY <= cardY + cardHeight) {
			return i;
		}
	}
	
	return -1;
}

// Level up effect is now handled by the levelUp renderer callback

function paint(ctx) {
	ctx.fillStyle = "#e2ebf3";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	// Move to viewport, below the stats bar
	ctx.save();
	ctx.translate(0, BAR_HEIGHT);
	ctx.beginPath();
	ctx.rect(0, 0, gameWidth, gameHeight);
	ctx.clip();

	// Apply screen shake
	ctx.translate(screenShake.x, screenShake.y);

	// Zoom based on territory size
	ctx.scale(zoom, zoom);
	ctx.translate(-offset[0] + consts.BORDER_WIDTH, -offset[1] + consts.BORDER_WIDTH);

	// Update view offset for mouse position calculation
	client.setViewOffset(offset[0] - consts.BORDER_WIDTH, offset[1] - consts.BORDER_WIDTH);

	paintGridBackground(ctx);

	// Get all players sorted by num for consistent z-ordering
	// This ensures overlapping territories always show the same owner
	const allPlayers = client.getPlayers().slice().sort((a, b) => a.num - b.num);
	
	// ===== LAYER 1: TERRITORIES (bottom layer) =====
	// Render all territory fills first
	for (const p of allPlayers) {
		const fr = p.waitLag;
		const dissolve = getDyingPlayerEffect(p);
		const fade = fr < ANIMATE_FRAMES ? fr / ANIMATE_FRAMES : 1;
		
		// Skip dead players' territories
		if (dissolve >= 1) continue;
		
		// Snipped visual effect
		let snipAlpha = 1;
		if (p.isSnipped) {
			const time = Date.now() / 100;
			snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
		}
		
		// Render territory fill
		if (p.territory && p.territory.length >= 3) {
			ctx.save();
			if (dissolve > 0) {
				ctx.globalAlpha = Math.max(0, 1 - dissolve);
			}
			
			// Fill territory
			ctx.fillStyle = p.baseColor.deriveAlpha(0.4 * fade * snipAlpha).rgbString();
			ctx.beginPath();
			ctx.moveTo(p.territory[0].x, p.territory[0].y);
			for (let i = 1; i < p.territory.length; i++) {
				ctx.lineTo(p.territory[i].x, p.territory[i].y);
			}
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
	}
	
	// Render all territory outlines (on top of all fills)
	for (const p of allPlayers) {
		const fr = p.waitLag;
		const dissolve = getDyingPlayerEffect(p);
		const fade = fr < ANIMATE_FRAMES ? fr / ANIMATE_FRAMES : 1;
		
		if (dissolve >= 1) continue;
		
		let snipAlpha = 1;
		if (p.isSnipped) {
			const time = Date.now() / 100;
			snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
		}
		
		const outlineThickness = getOutlineThickness(p);
		
		if (p.territory && p.territory.length >= 3) {
			ctx.save();
			if (dissolve > 0) {
				ctx.globalAlpha = Math.max(0, 1 - dissolve);
			}
			
			// Draw outline
			const baseOutlineWidth = TERRITORY_OUTLINE_WIDTH;
			const outlineWidth = baseOutlineWidth * outlineThickness;
			ctx.strokeStyle = p.baseColor.deriveAlpha(0.9 * fade * snipAlpha).rgbString();
			ctx.lineWidth = outlineWidth;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			
			ctx.beginPath();
			ctx.moveTo(p.territory[0].x, p.territory[0].y);
			for (let i = 1; i < p.territory.length; i++) {
				ctx.lineTo(p.territory[i].x, p.territory[i].y);
			}
			ctx.closePath();
			ctx.stroke();
			ctx.restore();
		}
	}

	// ===== LAYER 2: COINS =====
	const coins = client.getCoins();
	ctx.fillStyle = "#FFD700";
	ctx.shadowBlur = 5;
	ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
	for (const coin of coins) {
		ctx.beginPath();
		ctx.arc(coin.x, coin.y, consts.COIN_RADIUS, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.shadowBlur = 0;
	
	// Render animated loot coins
	renderLootCoins(ctx);
	
	// ===== LAYER 3: PLAYER TRAILS =====
	for (const p of allPlayers) {
		const dissolve = getDyingPlayerEffect(p);
		if (dissolve >= 1) continue;
		
		if (dissolve > 0) {
			ctx.globalAlpha = Math.max(0, 1 - dissolve);
		}
		
		// Render just the trail
		p.renderTrail(ctx);
		
		ctx.globalAlpha = 1;
	}
	
	// ===== LAYER 3.5: ENEMIES =====
	renderEnemies(ctx);
	
	// ===== LAYER 4: SPEED SPIKES (above trails, below players) =====
	renderSpeedTrailParticles(ctx);
	
	// ===== LAYER 5: PLAYER BODIES (above spikes, below drones) =====
	for (const p of allPlayers) {
		const fr = p.waitLag;
		const dissolve = getDyingPlayerEffect(p);
		
		if (dissolve > 0) {
			ctx.globalAlpha = Math.max(0, 1 - dissolve);
		}
		
		// Render player body only (skip trail since already rendered)
		if (fr < ANIMATE_FRAMES) {
			p.renderBody(ctx, fr / ANIMATE_FRAMES, true);
		} else {
			p.renderBody(ctx, 1, true);
		}
		
		ctx.globalAlpha = 1;
	}
	
	// ===== LAYER 5.5: DRONE RANGE INDICATOR (only for user) =====
	if (user && !user.dead && user.drones && user.drones.length > 0) {
		renderDroneRangeCircle(ctx, user);
	}
	
	// ===== LAYER 6: DRONES (above players) =====
	renderAllDrones(ctx);
	
	// ===== LAYER 7: HP BARS (above drones so they're visible) =====
	const HP_BAR_VISIBLE_DURATION = 2000; // Show HP bar for 2 seconds after taking damage
	for (const p of allPlayers) {
		const dissolve = getDyingPlayerEffect(p);
		if (dissolve >= 1) continue;
		
		// Always show HP bar for local player, or if damaged/recently hit for others
		const isLocalPlayer = (p === user);
		const recentlyHit = p.lastHitTime && (Date.now() - p.lastHitTime) < HP_BAR_VISIBLE_DURATION;
		if (p.hp !== undefined && (isLocalPlayer || p.hp < p.maxHp || recentlyHit)) {
			renderPlayerHpBar(ctx, p, isLocalPlayer);
		}
	}
	
	// ===== LAYER 8: EFFECTS (top layers) =====
	// Render capture effects (pulse rings, particles, coins text)
	renderCaptureEffects(ctx);
	
	// Render death particles
	renderDeathParticles(ctx);
	
	// Render hitscan laser effects (on top of everything)
	renderHitscanEffects(ctx);

	// Reset transform for fixed UI
	ctx.restore();
	paintUIBar(ctx);
	paintBottomHPBar(ctx);
	paintBottomXPBar(ctx);
	paintDebugOverlay(ctx);
	
	// Render upgrade selection UI if visible
	if (upgradeUIVisible) {
		paintUpgradeUI(ctx);
	}

	if ((!user || user.dead) && !showedDead) {
		showedDead = true;
		console.log("You died!");
		// Stop background music on death
		if (soundInitialized) {
			SoundManager.stopBackgroundMusic();
		}
		
		// Update death screen stats
		updateDeathStats();
	}
}

function updateDeathStats() {
	// Get stats before user is cleared
	const scoreEl = document.getElementById('death-score');
	const killsEl = document.getElementById('death-kills');
	const levelEl = document.getElementById('death-level');
	const killerInfo = document.getElementById('death-killer-info');
	const killerName = document.getElementById('death-killer-name');
	
	if (scoreEl && user) {
		const userPortion = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
		scoreEl.textContent = (userPortion * 100).toFixed(2) + '%';
	}
	
	if (killsEl) {
		killsEl.textContent = client.getKills();
	}
	
	if (levelEl && user) {
		levelEl.textContent = user.level || 1;
	}
	
	// Show killer info if available (will be set by playerKill callback)
	if (killerInfo && lastKillerName) {
		killerInfo.style.display = 'block';
		killerName.textContent = lastKillerName;
	} else if (killerInfo) {
		killerInfo.style.display = 'none';
	}
}

function paintDoubleBuff() {
	paint(offctx);
	ctx.drawImage(offscreenCanvas, 0, 0);
}

function update() {
	updateSize();
	
	// Update death animation effects
	updateDeathEffects();
	
	// Update speed buff and sound effects for local player
	updateSpeedBuffSound();
	
	// Update background music tempo based on game state
	if (user && soundInitialized) {
		const territoryPercent = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
		SoundManager.updateBackgroundMusicTempo(user.isSnipped, territoryPercent);
	}

	// Smooth camera movement
	for (let i = 0; i <= 1; i++) {
		if (animateTo[i] !== offset[i]) {
			if (client.allowAnimation) {
				const delta = animateTo[i] - offset[i];
				const dir = Math.sign(delta);
				const mag = Math.min(consts.SPEED * 2, Math.abs(delta));
				offset[i] += dir * mag;
			} else {
				offset[i] = animateTo[i];
			}
		}
	}

	// Calculate player portions based on territory area
	const mapArea = consts.GRID_COUNT * consts.CELL_WIDTH * consts.GRID_COUNT * consts.CELL_WIDTH;
	client.getPlayers().forEach(player => {
		const area = client.polygonArea(player.territory);
		playerPortion[player.num] = area;
		
		const roll = portionsRolling[player.num];
		if (roll) {
			roll.value = area / mapArea;
			roll.update();
		}
	});

	// Zoom based on player size (zoom out as player grows)
	// When sizeScale increases by X%, zoom out by X%
	if (user) {
		const sizeScale = user.sizeScale || 1.0;
		const maxSizeScale = consts.PLAYER_SIZE_SCALE_MAX || 2.0;
		// Clamp sizeScale to max (stop zooming at max size)
		const clampedScale = Math.min(sizeScale, maxSizeScale);
		// Zoom = 1 / sizeScale (so 4% bigger = 4% more zoomed out)
		const targetZoom = 1 / clampedScale;
		// Smooth interpolation
		zoom = zoom + (targetZoom - zoom) * 0.05;
		zoom = Math.max(0.3, Math.min(1, zoom));
		client.updateZoom(zoom);
	}
	
	if (user) centerOnPlayer(user, animateTo);
}

/**
 * Calculate speed buff based on time outside territory
 * Uses config values: TRAIL_SPEED_BUFF_MAX, TRAIL_SPEED_BUFF_RAMP_TIME, TRAIL_SPEED_BUFF_EASE
 */
function calculateSpeedBuff(timeOutsideSec) {
	const maxBuff = consts.TRAIL_SPEED_BUFF_MAX || 1.2;
	const rampTime = consts.TRAIL_SPEED_BUFF_RAMP_TIME || 4;
	const ease = consts.TRAIL_SPEED_BUFF_EASE || 2;
	
	// Progress from 0 to 1 over ramp time
	const progress = Math.min(1, timeOutsideSec / rampTime);
	
	// Apply easing (higher ease = slower start)
	const easedProgress = Math.pow(progress, ease);
	
	// Calculate buff: 1.0 to maxBuff
	return 1.0 + (maxBuff - 1.0) * easedProgress;
}

/**
 * Check if player is inside their own territory
 */
function isInOwnTerritory(player) {
	if (!player || !player.territory || player.territory.length < 3) return false;
	
	const x = player.x;
	const y = player.y;
	const polygon = player.territory;
	
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x, yi = polygon[i].y;
		const xj = polygon[j].x, yj = polygon[j].y;
		
		if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Update speed buff tracking, speed rush sound, and visual trail
 */
function updateSpeedBuffSound() {
	// Update visual particles regardless of sound state
	updateSpeedTrailParticles();
	
	if (!user || user.dead) {
		// Stop sound and clear trail if player is dead
		if (speedRushActive && soundInitialized) {
			SoundManager.stopSpeedRushSound();
			speedRushActive = false;
		}
		trailStartTime = null;
		lastSpeedBuff = 1.0;
		lastPlayerPos = null;
		return;
	}
	
	const inTerritory = isInOwnTerritory(user);
	const now = Date.now();
	
	// If snipped, lose speed buff and visual effects
	if (user.isSnipped) {
		if (trailStartTime !== null) {
			trailStartTime = null;
			lastSpeedBuff = 1.0;
		}
		if (speedRushActive && soundInitialized) {
			SoundManager.stopSpeedRushSound();
			speedRushActive = false;
		}
		deactivateSpeedSpikes();
		return;
	}
	
	if (inTerritory) {
		// Player is in territory - reset trail time, stop sound and spikes
		if (trailStartTime !== null) {
			trailStartTime = null;
			lastSpeedBuff = 1.0;
		}
		if (speedRushActive && soundInitialized) {
			SoundManager.stopSpeedRushSound();
			speedRushActive = false;
		}
		deactivateSpeedSpikes();
	} else {
		// Player is outside territory - track time and calculate speed buff
		if (trailStartTime === null) {
			trailStartTime = now;
		}
		
		const timeOutsideSec = (now - trailStartTime) / 1000;
		const speedBuff = calculateSpeedBuff(timeOutsideSec);
		lastSpeedBuff = speedBuff;
		
		// Speed effects only activate when speed buff is >= 10% (1.1x)
		if (speedBuff >= SPEED_TRAIL_THRESHOLD) {
			// Sound effects (only if initialized)
			if (soundInitialized) {
				if (!speedRushActive) {
					SoundManager.startSpeedRushSound();
					speedRushActive = true;
				}
				SoundManager.updateSpeedRushSound(speedBuff);
			}
			
			// Visual spike trail effect
			const speedRatio = Math.min(1.0, (speedBuff - 1.1) / 0.1); // 0 at 1.1x, 1 at 1.2x
			
			// Activate spikes using player's actual color
			if (user.baseColor) {
				activateSpeedSpikes(user.x, user.y, user.angle, speedRatio, user.baseColor);
			}
		} else {
			// Speed buff below threshold - stop sound and spikes
			if (speedRushActive && soundInitialized) {
				SoundManager.stopSpeedRushSound();
				speedRushActive = false;
			}
			deactivateSpeedSpikes();
		}
	}
}

// Helper methods
function centerOnPlayer(player, pos) {
	const xOff = Math.floor(player.x - (gameWidth / zoom) / 2);
	const yOff = Math.floor(player.y - (gameHeight / zoom) / 2);
	pos[0] = xOff;
	pos[1] = yOff;
}

function Rolling(value, frames) {
	let lag = 0;
	if (!frames) frames = 24;
	this.value = value;
	Object.defineProperty(this, "lag", {
		get: function() {
			return lag;
		},
		enumerable: true
	});
	this.update = function() {
		const delta = this.value - lag;
		const dir = Math.sign(delta);
		const speed = Math.abs(delta) / frames;
		const mag = Math.min(Math.abs(speed), Math.abs(delta));
		lag += mag * dir;
		return lag;
	}
}

// ===== SPEED TRAIL VISUAL EFFECT (SPIKES FROM BACK OF PLAYER) =====

function updateSpeedTrailParticles() {
	// Update pulse phase based on speed (faster pulse = faster movement)
	if (speedSpikeState.active && user && !user.dead) {
		// Pulse speed: 6-14 radians per second based on speed ratio
		const pulseSpeed = 6 + speedSpikeState.speedRatio * 8;
		speedSpikeState.pulsePhase += pulseSpeed / 60; // Assuming 60fps
		
		// Update position to follow player
		speedSpikeState.playerX = user.x;
		speedSpikeState.playerY = user.y;
		speedSpikeState.playerAngle = user.angle;
	}
}

function renderSpeedTrailParticles(ctx) {
	if (!speedSpikeState.active || !speedSpikeState.baseColor) return;
	
	const { playerX, playerY, playerAngle, speedRatio, baseColor, pulsePhase } = speedSpikeState;
	
	// Number of spikes: 3 at low speed, 5 at max speed
	const spikeCount = 3 + Math.floor(speedRatio * 2);
	
	// Spread angle for spikes (wider at higher speeds)
	const totalSpread = 0.8 + speedRatio * 0.6; // ~45 to ~80 degrees total
	
	// Base spike length and width (scales with speed)
	const baseLength = 18 + speedRatio * 25;
	const baseWidth = 8 + speedRatio * 6;
	
	// Distance from player center where spikes start
	const startOffset = 12;
	
	// Get colors from player's base color
	const brightColor = baseColor.deriveLumination(0.3).rgbString();
	const mainColor = baseColor.rgbString();
	const darkColor = baseColor.deriveLumination(-0.2).rgbString();
	
	ctx.save();
	
	for (let i = 0; i < spikeCount; i++) {
		// Calculate angle for this spike (spread behind player)
		const spreadPos = spikeCount > 1 ? (i / (spikeCount - 1)) - 0.5 : 0; // -0.5 to 0.5
		const spikeAngle = playerAngle + Math.PI + spreadPos * totalSpread;
		
		// Each spike has its own phase offset for wave effect
		const phaseOffset = (i / spikeCount) * Math.PI * 2;
		const pulse = Math.sin(pulsePhase + phaseOffset);
		
		// Pulsing size: oscillates between 40% and 100%
		const sizeMult = 0.4 + (pulse * 0.5 + 0.5) * 0.6;
		
		const length = baseLength * sizeMult;
		const width = baseWidth * sizeMult;
		
		if (length < 3) continue;
		
		// Calculate spike start (behind player) and tip
		const startX = playerX + Math.cos(spikeAngle) * startOffset;
		const startY = playerY + Math.sin(spikeAngle) * startOffset;
		const tipX = startX + Math.cos(spikeAngle) * length;
		const tipY = startY + Math.sin(spikeAngle) * length;
		
		// Perpendicular for width
		const perpAngle = spikeAngle + Math.PI / 2;
		const halfWidth = width / 2;
		
		// Alpha based on speed and pulse
		const alpha = (0.6 + speedRatio * 0.3) * (0.6 + sizeMult * 0.4);
		ctx.globalAlpha = alpha;
		
		// Create gradient along spike
		const gradient = ctx.createLinearGradient(startX, startY, tipX, tipY);
		gradient.addColorStop(0, brightColor);
		gradient.addColorStop(0.4, mainColor);
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
		
		// Draw spike as triangle
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(startX + Math.cos(perpAngle) * halfWidth, startY + Math.sin(perpAngle) * halfWidth);
		ctx.lineTo(startX - Math.cos(perpAngle) * halfWidth, startY - Math.sin(perpAngle) * halfWidth);
		ctx.lineTo(tipX, tipY);
		ctx.closePath();
		ctx.fill();
		
		// Bright core line down the middle
		ctx.globalAlpha = alpha * 0.7;
		ctx.strokeStyle = brightColor;
		ctx.lineWidth = Math.max(1, width * 0.25);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(startX, startY);
		ctx.lineTo(tipX, tipY);
		ctx.stroke();
	}
	
	ctx.restore();
}

function activateSpeedSpikes(playerX, playerY, playerAngle, speedRatio, baseColor) {
	speedSpikeState.active = true;
	speedSpikeState.playerX = playerX;
	speedSpikeState.playerY = playerY;
	speedSpikeState.playerAngle = playerAngle;
	speedSpikeState.speedRatio = speedRatio;
	speedSpikeState.baseColor = baseColor;
}

function deactivateSpeedSpikes() {
	speedSpikeState.active = false;
	speedSpikeState.baseColor = null;
}

function clearSpeedTrailParticles() {
	speedSpikeState.active = false;
	speedSpikeState.pulsePhase = 0;
	speedSpikeState.baseColor = null;
}

// ===== DEATH ANIMATION SYSTEM =====

class DeathParticle {
	constructor(x, y, color, type = 'burst') {
		this.x = x;
		this.y = y;
		this.color = color;
		this.type = type;
		
		if (type === 'burst') {
			const angle = Math.random() * Math.PI * 2;
			const speed = 3 + Math.random() * 8;
			this.vx = Math.cos(angle) * speed;
			this.vy = Math.sin(angle) * speed;
			this.size = 4 + Math.random() * 8;
			this.life = 1;
			this.decay = 0.015 + Math.random() * 0.02;
			this.rotation = Math.random() * Math.PI * 2;
			this.rotationSpeed = (Math.random() - 0.5) * 0.3;
			this.gravity = 0.15;
		} else if (type === 'spark') {
			const angle = Math.random() * Math.PI * 2;
			const speed = 8 + Math.random() * 12;
			this.vx = Math.cos(angle) * speed;
			this.vy = Math.sin(angle) * speed;
			this.size = 2 + Math.random() * 3;
			this.life = 1;
			this.decay = 0.04 + Math.random() * 0.03;
			this.trail = [];
		} else if (type === 'ring') {
			this.radius = 5;
			this.maxRadius = 80 + Math.random() * 40;
			this.expandSpeed = 4 + Math.random() * 2;
			this.life = 1;
			this.decay = 0.025;
			this.lineWidth = 8;
		} else if (type === 'shard') {
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 5;
			this.vx = Math.cos(angle) * speed;
			this.vy = Math.sin(angle) * speed;
			this.points = this.generateShardShape();
			this.life = 1;
			this.decay = 0.012 + Math.random() * 0.01;
			this.rotation = Math.random() * Math.PI * 2;
			this.rotationSpeed = (Math.random() - 0.5) * 0.15;
			this.gravity = 0.08;
		}
	}
	
	generateShardShape() {
		const points = [];
		const numPoints = 3 + Math.floor(Math.random() * 3);
		const baseSize = 10 + Math.random() * 20;
		for (let i = 0; i < numPoints; i++) {
			const angle = (i / numPoints) * Math.PI * 2;
			const dist = baseSize * (0.5 + Math.random() * 0.5);
			points.push({
				x: Math.cos(angle) * dist,
				y: Math.sin(angle) * dist
			});
		}
		return points;
	}
	
	update() {
		if (this.type === 'burst') {
			this.x += this.vx;
			this.y += this.vy;
			this.vy += this.gravity;
			this.vx *= 0.98;
			this.rotation += this.rotationSpeed;
			this.life -= this.decay;
		} else if (this.type === 'spark') {
			this.trail.push({ x: this.x, y: this.y, life: this.life });
			if (this.trail.length > 8) this.trail.shift();
			this.x += this.vx;
			this.y += this.vy;
			this.vx *= 0.92;
			this.vy *= 0.92;
			this.life -= this.decay;
		} else if (this.type === 'ring') {
			this.radius += this.expandSpeed;
			this.lineWidth *= 0.96;
			this.life -= this.decay;
		} else if (this.type === 'shard') {
			this.x += this.vx;
			this.y += this.vy;
			this.vy += this.gravity;
			this.rotation += this.rotationSpeed;
			this.life -= this.decay;
		}
		return this.life > 0;
	}
	
	render(ctx) {
		const alpha = Math.max(0, this.life);
		
		if (this.type === 'burst') {
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rotation);
			ctx.globalAlpha = alpha;
			ctx.fillStyle = this.color;
			ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
			ctx.shadowColor = this.color;
			ctx.shadowBlur = 10 * alpha;
			ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
			ctx.restore();
		} else if (this.type === 'spark') {
			ctx.beginPath();
			ctx.moveTo(this.x, this.y);
			for (let i = this.trail.length - 1; i >= 0; i--) {
				const t = this.trail[i];
				ctx.lineTo(t.x, t.y);
			}
			ctx.strokeStyle = this.color;
			ctx.lineWidth = this.size * alpha;
			ctx.globalAlpha = alpha * 0.6;
			ctx.stroke();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
			ctx.fill();
		} else if (this.type === 'ring') {
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			ctx.strokeStyle = this.color;
			ctx.lineWidth = Math.max(1, this.lineWidth * alpha);
			ctx.globalAlpha = alpha * 0.7;
			ctx.stroke();
		} else if (this.type === 'shard') {
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rotation);
			ctx.globalAlpha = alpha * 0.8;
			ctx.beginPath();
			ctx.moveTo(this.points[0].x, this.points[0].y);
			for (let i = 1; i < this.points.length; i++) {
				ctx.lineTo(this.points[i].x, this.points[i].y);
			}
			ctx.closePath();
			ctx.fillStyle = this.color;
			ctx.fill();
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}
}

// ===== LOOT COIN ANIMATION SYSTEM =====

class LootCoin {
	constructor(originX, originY, targetX, targetY, value) {
		this.originX = originX;
		this.originY = originY;
		this.targetX = targetX;
		this.targetY = targetY;
		this.value = value;
		
		// Current position (starts at origin)
		this.x = originX;
		this.y = originY;
		
		// Animation timing
		this.spawnTime = Date.now();
		this.duration = 600 + Math.random() * 200; // 600-800ms flight time
		this.delay = Math.random() * 150; // Stagger the coins
		
		// Arc parameters for juicy trajectory
		this.arcHeight = 40 + Math.random() * 60; // How high the arc goes
		this.rotation = 0;
		this.rotationSpeed = (Math.random() - 0.5) * 0.4;
		
		// Visual effects
		this.scale = 0;
		this.targetScale = 0.8 + Math.random() * 0.4;
		this.glowIntensity = 1;
		this.sparkles = [];
		
		// Generate initial sparkles
		for (let i = 0; i < 3; i++) {
			this.sparkles.push({
				angle: Math.random() * Math.PI * 2,
				dist: 8 + Math.random() * 8,
				size: 2 + Math.random() * 2,
				speed: 0.05 + Math.random() * 0.05
			});
		}
		
		this.landed = false;
		this.landTime = 0;
		this.bouncePhase = 0;
	}
	
	update() {
		const now = Date.now();
		const elapsed = now - this.spawnTime - this.delay;
		
		if (elapsed < 0) {
			// Still in delay phase
			return true;
		}
		
		const progress = Math.min(1, elapsed / this.duration);
		
		if (!this.landed) {
			// Ease out cubic for smooth deceleration
			const easeProgress = 1 - Math.pow(1 - progress, 3);
			
			// Linear interpolation for x
			this.x = this.originX + (this.targetX - this.originX) * easeProgress;
			
			// Parabolic arc for y (goes up then down)
			const linearY = this.originY + (this.targetY - this.originY) * easeProgress;
			const arcOffset = Math.sin(easeProgress * Math.PI) * this.arcHeight;
			this.y = linearY - arcOffset;
			
			// Scale up as it flies
			this.scale = this.targetScale * Math.min(1, easeProgress * 2);
			
			// Rotation
			this.rotation += this.rotationSpeed;
			
			// Update sparkles
			for (const sparkle of this.sparkles) {
				sparkle.angle += sparkle.speed;
			}
			
			if (progress >= 1) {
				this.landed = true;
				this.landTime = now;
				this.x = this.targetX;
				this.y = this.targetY;
			}
		} else {
			// Bounce and settle animation
			const landElapsed = now - this.landTime;
			const bounceProgress = Math.min(1, landElapsed / 400);
			
			// Damped bounce
			this.bouncePhase = Math.sin(bounceProgress * Math.PI * 3) * (1 - bounceProgress) * 8;
			this.y = this.targetY - Math.abs(this.bouncePhase);
			
			// Settle rotation
			this.rotation *= 0.95;
			
			// Fade glow
			this.glowIntensity = Math.max(0.3, 1 - bounceProgress * 0.7);
			
			// Done after bounce settles
			if (bounceProgress >= 1) {
				return false; // Remove this loot coin animation
			}
		}
		
		return true;
	}
	
	render(ctx) {
		const now = Date.now();
		const elapsed = now - this.spawnTime - this.delay;
		
		if (elapsed < 0 || this.scale <= 0) return;
		
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		ctx.scale(this.scale, this.scale);
		
		const coinRadius = consts.COIN_RADIUS * 1.2;
		
		// Outer glow
		const glowSize = coinRadius * (2 + this.glowIntensity);
		const gradient = ctx.createRadialGradient(0, 0, coinRadius * 0.5, 0, 0, glowSize);
		gradient.addColorStop(0, `rgba(255, 215, 0, ${0.6 * this.glowIntensity})`);
		gradient.addColorStop(0.5, `rgba(255, 180, 0, ${0.3 * this.glowIntensity})`);
		gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
		ctx.fill();
		
		// Main coin body with gradient
		const coinGradient = ctx.createRadialGradient(-coinRadius * 0.3, -coinRadius * 0.3, 0, 0, 0, coinRadius);
		coinGradient.addColorStop(0, '#FFF8DC'); // Light gold highlight
		coinGradient.addColorStop(0.3, '#FFD700'); // Gold
		coinGradient.addColorStop(0.7, '#DAA520'); // Goldenrod
		coinGradient.addColorStop(1, '#B8860B'); // Dark goldenrod edge
		ctx.fillStyle = coinGradient;
		ctx.beginPath();
		ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
		ctx.fill();
		
		// Inner ring detail
		ctx.strokeStyle = 'rgba(139, 90, 43, 0.5)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(0, 0, coinRadius * 0.7, 0, Math.PI * 2);
		ctx.stroke();
		
		// Shine highlight
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.beginPath();
		ctx.ellipse(-coinRadius * 0.25, -coinRadius * 0.25, coinRadius * 0.35, coinRadius * 0.2, -Math.PI / 4, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
		
		// Render sparkles (in world space)
		if (!this.landed) {
			for (const sparkle of this.sparkles) {
				const sx = this.x + Math.cos(sparkle.angle) * sparkle.dist * this.scale;
				const sy = this.y + Math.sin(sparkle.angle) * sparkle.dist * this.scale;
				
				ctx.fillStyle = `rgba(255, 255, 200, ${0.8 * this.glowIntensity})`;
				ctx.beginPath();
				ctx.arc(sx, sy, sparkle.size * this.scale, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

function spawnLootCoins(originX, originY, coinDataArray) {
	for (const coinData of coinDataArray) {
		const lootCoin = new LootCoin(
			originX,
			originY,
			coinData.x,
			coinData.y,
			coinData.value
		);
		lootCoins.push(lootCoin);
	}
}

function updateLootCoins() {
	for (let i = lootCoins.length - 1; i >= 0; i--) {
		if (!lootCoins[i].update()) {
			lootCoins.splice(i, 1);
		}
	}
}

function renderLootCoins(ctx) {
	for (const coin of lootCoins) {
		coin.render(ctx);
	}
}

function renderPlayerHpBar(ctx, player, isLocalPlayer = false) {
	// Scale with player size
	const sizeScale = player.sizeScale || 1.0;
	const scaledRadius = PLAYER_RADIUS * sizeScale;
	
	// Local player has a slightly larger, more prominent HP bar
	const sizeMult = isLocalPlayer ? 1.2 : 1.0;
	const barWidth = scaledRadius * 2.5 * sizeMult;
	const barHeight = 6 * sizeScale * sizeMult;
	const barX = player.x - barWidth / 2;
	const barY = player.y + scaledRadius + 8; // Below player
	
	// Background (dark)
	ctx.fillStyle = isLocalPlayer ? "rgba(10, 10, 10, 0.9)" : "rgba(20, 20, 20, 0.8)";
	ctx.fillRect(barX, barY, barWidth, barHeight);
	
	// HP fill
	const hpRatio = Math.max(0, player.hp / player.maxHp);
	if (hpRatio > 0.5) {
		ctx.fillStyle = "#44ff44";
	} else if (hpRatio > 0.25) {
		ctx.fillStyle = "#ffcc00";
	} else {
		ctx.fillStyle = "#ff4444";
	}
	ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
	
	// Quarter divider lines (25hp chunks like OW2)
	ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
	ctx.lineWidth = Math.max(1, 1.5 * sizeScale);
	for (let i = 1; i <= 3; i++) {
		const divX = barX + (barWidth * i / 4);
		ctx.beginPath();
		ctx.moveTo(divX, barY);
		ctx.lineTo(divX, barY + barHeight);
		ctx.stroke();
	}
	
	// Black outline (slightly thicker for local player)
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = Math.max(1, (isLocalPlayer ? 2.5 : 2) * sizeScale);
	ctx.strokeRect(barX, barY, barWidth, barHeight);
}

// ===== HITSCAN LASER EFFECTS =====

// Cap active laser effects so big drone fights don't tank FPS.
const MAX_HITSCAN_EFFECTS = 120;

class HitscanEffect {
	constructor(fromX, fromY, toX, toY, ownerId, damage, baseColor) {
		this.fromX = fromX;
		this.fromY = fromY;
		this.toX = toX;
		this.toY = toY;
		this.ownerId = ownerId;
		this.damage = damage;
		this.baseColor = baseColor || null;
		this.spawnTime = Date.now();
		this.duration = 300; // ms - visible laser effect
		this.life = 1;
	}
	
	update() {
		const elapsed = Date.now() - this.spawnTime;
		this.life = 1 - (elapsed / this.duration);
		return this.life > 0;
	}
	
	render(ctx) {
		if (this.life <= 0) return;

		const baseColor = this.baseColor;
		
		ctx.save();
		
		// Laser line with glow
		ctx.lineCap = 'round';
		
		// Outer glow (thicker, more transparent)
		ctx.lineWidth = 12 * this.life;
		if (baseColor) {
			ctx.strokeStyle = baseColor.deriveAlpha(0.5 * this.life).rgbString();
		} else {
			ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 * this.life})`;
		}
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(this.toX, this.toY);
		ctx.stroke();
		
		// Core laser line (thinner, brighter)
		ctx.lineWidth = 5 * this.life;
		if (baseColor) {
			ctx.strokeStyle = baseColor.deriveLumination(0.4).deriveAlpha(0.95 * this.life).rgbString();
		} else {
			ctx.strokeStyle = `rgba(255, 150, 150, ${0.95 * this.life})`;
		}
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(this.toX, this.toY);
		ctx.stroke();
		
		// Bright center
		ctx.lineWidth = 2 * this.life;
		ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(this.toX, this.toY);
		ctx.stroke();
		
		// Impact flash at target
		const flashSize = 20 * this.life;
		const gradient = ctx.createRadialGradient(this.toX, this.toY, 0, this.toX, this.toY, flashSize);
		if (baseColor) {
			gradient.addColorStop(0, baseColor.deriveLumination(0.6).deriveAlpha(this.life).rgbString());
			gradient.addColorStop(0.4, baseColor.deriveAlpha(0.6 * this.life).rgbString());
			gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		} else {
			gradient.addColorStop(0, `rgba(255, 255, 200, ${this.life})`);
			gradient.addColorStop(0.4, `rgba(255, 100, 100, ${0.6 * this.life})`);
			gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
		}
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(this.toX, this.toY, flashSize, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
	}
}

function spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage) {
	// Resolve owner color once (avoid O(players) search every render frame).
	let baseColor = null;
	const ownerPlayer = client.getPlayers().find(p => p.num === ownerId);
	if (ownerPlayer && ownerPlayer.baseColor) baseColor = ownerPlayer.baseColor;

	hitscanEffects.push(new HitscanEffect(fromX, fromY, toX, toY, ownerId, damage, baseColor));

	// Hard cap (drop oldest) to prevent unbounded growth during large fights.
	if (hitscanEffects.length > MAX_HITSCAN_EFFECTS) {
		hitscanEffects.splice(0, hitscanEffects.length - MAX_HITSCAN_EFFECTS);
	}
}

function updateHitscanEffects() {
	for (let i = hitscanEffects.length - 1; i >= 0; i--) {
		if (!hitscanEffects[i].update()) {
			hitscanEffects.splice(i, 1);
		}
	}
}

function renderHitscanEffects(ctx) {
	for (const effect of hitscanEffects) {
		effect.render(ctx);
	}
}

// ===== ENEMY RENDERING =====
function renderEnemy(ctx, enemy) {
	ctx.save();
	
	const type = enemy.type || 'basic';
	const style = ENEMY_STYLES[type] || ENEMY_STYLES.basic;
	const isBoss = enemy.isBoss;
	
	// Boss aura effect (pulsing outer glow)
	if (isBoss) {
		const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
		ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + pulse * 0.4})`; // Golden aura
		ctx.lineWidth = 4 + pulse * 3;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + pulse * 4, 0, Math.PI * 2);
		ctx.stroke();
	}
	
	// Charging glow effect
	if (enemy.isCharging) {
		const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
		ctx.shadowBlur = 15 + pulse * 10;
		ctx.shadowColor = style.color;
	}
	
	// Shadow (larger for bosses)
	ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
	ctx.beginPath();
	ctx.arc(enemy.x + (isBoss ? 4 : 2), enemy.y + (isBoss ? 4 : 2), enemy.radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Body
	ctx.fillStyle = style.color;
	ctx.beginPath();
	ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Outline (thicker for bosses)
	ctx.strokeStyle = style.outline;
	ctx.lineWidth = isBoss ? 4 : 2;
	ctx.stroke();
	
	// Boss HP bar (always visible for bosses)
	if (isBoss) {
		const barWidth = enemy.radius * 2.5;
		const barHeight = 8;
		const barX = enemy.x - barWidth / 2;
		const barY = enemy.y - enemy.radius - 20;
		const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
		
		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
		
		// HP fill
		ctx.fillStyle = hpRatio > 0.5 ? "#ffcc00" : (hpRatio > 0.25 ? "#ff8800" : "#ff3300");
		ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
		
		// Border
		ctx.strokeStyle = "#FFD700";
		ctx.lineWidth = 2;
		ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
	}
	
	// Type-specific visuals
	if (type === 'charger') {
		// Arrow indicator showing charge direction
		if (enemy.isCharging && enemy.vx !== undefined && enemy.vy !== undefined) {
			const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
			if (speed > 0) {
				const angle = Math.atan2(enemy.vy, enemy.vx);
				ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(enemy.x, enemy.y);
				ctx.lineTo(
					enemy.x + Math.cos(angle) * enemy.radius * 1.5,
					enemy.y + Math.sin(angle) * enemy.radius * 1.5
				);
				ctx.stroke();
			}
		}
	} else if (type === 'tank') {
		// Inner ring for tanks
		ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.6, 0, Math.PI * 2);
		ctx.stroke();
	} else if (type === 'swarm') {
		// Small dot in center for swarm
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.3, 0, Math.PI * 2);
		ctx.fill();
	} else if (type === 'sniper') {
		// Crosshair/scope indicator for sniper
		ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
		ctx.lineWidth = 2;
		const crossSize = enemy.radius * 0.7;
		// Vertical line
		ctx.beginPath();
		ctx.moveTo(enemy.x, enemy.y - crossSize);
		ctx.lineTo(enemy.x, enemy.y + crossSize);
		ctx.stroke();
		// Horizontal line
		ctx.beginPath();
		ctx.moveTo(enemy.x - crossSize, enemy.y);
		ctx.lineTo(enemy.x + crossSize, enemy.y);
		ctx.stroke();
		// Small center circle
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.25, 0, Math.PI * 2);
		ctx.stroke();
	}
	
	// ===== BOSS-SPECIFIC VISUALS =====
	if (type === 'titan') {
		// Multiple concentric rings for titan
		ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.7, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.4, 0, Math.PI * 2);
		ctx.stroke();
		// X mark in center
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		ctx.lineWidth = 4;
		const xSize = enemy.radius * 0.25;
		ctx.beginPath();
		ctx.moveTo(enemy.x - xSize, enemy.y - xSize);
		ctx.lineTo(enemy.x + xSize, enemy.y + xSize);
		ctx.moveTo(enemy.x + xSize, enemy.y - xSize);
		ctx.lineTo(enemy.x - xSize, enemy.y + xSize);
		ctx.stroke();
	} else if (type === 'berserker') {
		// Aggressive spikes around berserker
		ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
		ctx.lineWidth = 3;
		const spikeCount = 6;
		for (let i = 0; i < spikeCount; i++) {
			const angle = (i / spikeCount) * Math.PI * 2 + Date.now() / 500;
			const innerR = enemy.radius * 0.8;
			const outerR = enemy.radius * 1.2;
			ctx.beginPath();
			ctx.moveTo(
				enemy.x + Math.cos(angle) * innerR,
				enemy.y + Math.sin(angle) * innerR
			);
			ctx.lineTo(
				enemy.x + Math.cos(angle) * outerR,
				enemy.y + Math.sin(angle) * outerR
			);
			ctx.stroke();
		}
		// Charge direction indicator when charging
		if (enemy.isCharging && enemy.vx !== undefined && enemy.vy !== undefined) {
			const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
			if (speed > 0) {
				const angle = Math.atan2(enemy.vy, enemy.vx);
				ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.moveTo(enemy.x, enemy.y);
				ctx.lineTo(
					enemy.x + Math.cos(angle) * enemy.radius * 1.8,
					enemy.y + Math.sin(angle) * enemy.radius * 1.8
				);
				ctx.stroke();
			}
		}
	} else if (type === 'summoner') {
		// Magical runes/circles for summoner
		const time = Date.now() / 1000;
		ctx.strokeStyle = "rgba(200, 100, 255, 0.6)";
		ctx.lineWidth = 2;
		// Rotating outer ring
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.85, time, time + Math.PI * 1.5);
		ctx.stroke();
		// Counter-rotating inner ring
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.5, -time * 1.5, -time * 1.5 + Math.PI);
		ctx.stroke();
		// Pulsing center orb
		const pulse = 0.5 + 0.5 * Math.sin(time * 3);
		ctx.fillStyle = `rgba(200, 100, 255, ${0.4 + pulse * 0.4})`;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius * 0.25 + pulse * 3, 0, Math.PI * 2);
		ctx.fill();
	}
	
	ctx.restore();
}

function renderEnemyHpBar(ctx, enemy) {
	const barWidth = enemy.radius * 2.2;
	const barHeight = 4;
	const x = enemy.x - barWidth / 2;
	const y = enemy.y - enemy.radius - 10;
	const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
	
	ctx.save();
	ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
	ctx.fillRect(x, y, barWidth, barHeight);
	ctx.fillStyle = "rgba(220, 60, 60, 0.9)";
	ctx.fillRect(x, y, barWidth * ratio, barHeight);
	ctx.restore();
}

function renderEnemies(ctx) {
	const enemyList = client.getEnemies();
	for (const enemy of enemyList) {
		renderEnemy(ctx, enemy);
	}
}

// ===== DRONE RENDERING =====

function renderDrone(ctx, drone, ownerPlayer, isUserDrone) {
	const x = drone.x;
	const y = drone.y;
	const radius = DRONE_VISUAL_RADIUS;
	const baseColor = ownerPlayer ? ownerPlayer.baseColor : null;
	const isDisabled = ownerPlayer && ownerPlayer.isSnipped; // Drones disabled when snipped
	
	ctx.save();
	
	// Shadow
	ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
	ctx.beginPath();
	ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Outer glow when targeting (not when disabled)
	if (drone.targetId !== null && !isDisabled) {
		const time = Date.now() / 150;
		const pulse = 0.4 + 0.3 * Math.sin(time * 4);
		ctx.shadowBlur = 12 * pulse;
		ctx.shadowColor = isUserDrone ? '#FFD700' : (baseColor ? baseColor.rgbString() : '#FF6600');
	}
	
	// Main body - filled circle (grayed out when disabled/snipped)
	if (isDisabled) {
		// Grayed out appearance when snipped
		ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
	} else if (baseColor) {
		ctx.fillStyle = baseColor.deriveAlpha(isUserDrone ? 0.95 : 0.8).rgbString();
	} else {
		ctx.fillStyle = isUserDrone ? "rgba(100, 200, 100, 0.95)" : "rgba(200, 100, 100, 0.8)";
	}
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Border (darker when disabled)
	if (isDisabled) {
		ctx.strokeStyle = "rgba(60, 60, 60, 0.6)";
	} else {
		ctx.strokeStyle = baseColor ? baseColor.deriveLumination(-0.2).rgbString() : "#444";
	}
	ctx.lineWidth = 2;
	ctx.stroke();
	
	ctx.shadowBlur = 0;
	
	// Inner core (highlight) - dimmed when disabled
	if (isDisabled) {
		ctx.fillStyle = "rgba(80, 80, 80, 0.4)";
	} else {
		ctx.fillStyle = baseColor ? baseColor.deriveLumination(0.3).deriveAlpha(0.7).rgbString() : "rgba(255, 255, 255, 0.5)";
	}
	ctx.beginPath();
	ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
	ctx.fill();
	
	// Targeting indicator (small dot when active) - not shown when disabled
	if (drone.targetId !== null && !isDisabled) {
		const time = Date.now() / 100;
		const pulse = 0.5 + 0.5 * Math.sin(time * 5);
		ctx.fillStyle = `rgba(255, 100, 100, ${0.6 + 0.4 * pulse})`;
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
	
	// HP bar (only show if damaged and not disabled)
	if (drone.hp < drone.maxHp && !isDisabled) {
		const barWidth = radius * 2.2;
		const barHeight = 3;
		const barX = x - barWidth / 2;
		const barY = y - radius - 6;
		
		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fillRect(barX, barY, barWidth, barHeight);
		
		// HP fill
		const hpRatio = Math.max(0, drone.hp / drone.maxHp);
		if (hpRatio > 0.5) {
			ctx.fillStyle = "#44ff44";
		} else if (hpRatio > 0.25) {
			ctx.fillStyle = "#ffcc00";
		} else {
			ctx.fillStyle = "#ff4444";
		}
		ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
	}
	
	// Disabled indicator (X mark) when snipped
	if (isDisabled) {
		ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
		ctx.lineWidth = 2;
		ctx.lineCap = "round";
		const xSize = radius * 0.5;
		ctx.beginPath();
		ctx.moveTo(x - xSize, y - xSize);
		ctx.lineTo(x + xSize, y + xSize);
		ctx.moveTo(x + xSize, y - xSize);
		ctx.lineTo(x - xSize, y + xSize);
		ctx.stroke();
	}
	
	ctx.restore();
}

function renderAllDrones(ctx) {
	const allPlayers = client.getPlayers();
	
	for (const p of allPlayers) {
		if (!p.drones || p.drones.length === 0) continue;
		
		const isUserDrones = user && p.num === user.num;
		
		for (const drone of p.drones) {
			// Skip rendering drones with 0 HP
			if (drone.hp <= 0) continue;
			renderDrone(ctx, drone, p, isUserDrones);
		}
	}
}

function renderDroneRangeCircle(ctx, player) {
	const range = consts.DRONE_RANGE || 200;
	
	ctx.save();
	
	// Animated dash
	const time = Date.now() / 1000;
	
	// Draw shadow circle only (subtle indicator)
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
	ctx.lineWidth = 3;
	ctx.setLineDash([10, 10]);
	ctx.lineDashOffset = -time * 30;
	ctx.beginPath();
	ctx.arc(player.x, player.y, range, 0, Math.PI * 2);
	ctx.stroke();
	
	ctx.restore();
}

// ===== CAPTURE FEEDBACK EFFECT SYSTEM =====

class CaptureEffect {
	constructor(x, y, xpGained, player, isLocalPlayer) {
		this.x = x;
		this.y = y;
		this.xpGained = xpGained;
		this.player = player;
		this.isLocalPlayer = isLocalPlayer;
		this.spawnTime = Date.now();
		this.color = player ? player.baseColor : null;
		
		// Pulse ring
		this.pulseRadius = PULSE_RADIUS_START;
		this.pulseLife = 1;
		
		// Particles
		this.particles = [];
		const particleCount = isLocalPlayer ? PARTICLE_COUNT : Math.floor(PARTICLE_COUNT * 0.6);
		for (let i = 0; i < particleCount; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 6;
			this.particles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				size: 3 + Math.random() * 5,
				life: 1,
				decay: 0.015 + Math.random() * 0.02
			});
		}
		
		// Coins text
		this.textY = y - 20;
		this.textAlpha = 1;
		
		// Trigger outline thickening for local player
		if (isLocalPlayer) {
			localOutlineThicken.active = true;
			localOutlineThicken.startTime = Date.now();
		}
	}
	
	update() {
		const elapsed = (Date.now() - this.spawnTime) / 1000;
		const flashProgress = Math.min(1, elapsed / CAPTURE_FLASH_TIME_SEC);
		const pulseProgress = Math.min(1, elapsed / PULSE_TIME);
		
		// Update pulse ring
		this.pulseRadius = PULSE_RADIUS_START + (PULSE_RADIUS_END - PULSE_RADIUS_START) * this.easeOutQuad(pulseProgress);
		this.pulseLife = 1 - pulseProgress;
		
		// Update particles
		for (const p of this.particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vx *= 0.96;
			p.vy *= 0.96;
			p.vy += 0.1; // gravity
			p.life -= p.decay;
		}
		
		// Update text (float up and fade)
		this.textY -= 0.8;
		this.textAlpha = Math.max(0, 1 - flashProgress);
		
		// Effect is done when flash time expires
		return flashProgress < 1;
	}
	
	easeOutQuad(t) {
		return t * (2 - t);
	}
	
	render(ctx) {
		const colorStr = this.color ? this.color.rgbString() : '#FFD700';
		const lightColorStr = this.color ? this.color.deriveLumination(0.3).rgbString() : '#FFEC8B';
		
		// Render pulse ring
		if (this.pulseLife > 0) {
			ctx.save();
			ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.8).rgbString() : `rgba(255, 215, 0, ${this.pulseLife * 0.8})`;
			ctx.lineWidth = 4 * this.pulseLife;
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.pulseRadius, 0, Math.PI * 2);
			ctx.stroke();
			
			// Inner glow
			ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.4).rgbString() : `rgba(255, 255, 200, ${this.pulseLife * 0.4})`;
			ctx.lineWidth = 8 * this.pulseLife;
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.pulseRadius * 0.8, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
		
		// Render particles
		for (const p of this.particles) {
			if (p.life <= 0) continue;
			ctx.save();
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = lightColorStr;
			ctx.shadowColor = colorStr;
			ctx.shadowBlur = 8 * p.life;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
		
		// Render XP earned text
		if (this.textAlpha > 0 && this.xpGained > 0) {
			ctx.save();
			ctx.globalAlpha = this.textAlpha;
			ctx.fillStyle = '#9370DB';  // Purple for XP
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.lineWidth = 3;
			ctx.font = 'bold 18px Changa';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			
			const text = `+${this.xpGained} XP`;
			ctx.strokeText(text, this.x, this.textY);
			ctx.fillText(text, this.x, this.textY);
			ctx.restore();
		}
		
		ctx.globalAlpha = 1;
	}
}

function spawnCaptureEffect(x, y, xpGained, player, isLocalPlayer) {
	captureEffects.push(new CaptureEffect(x, y, xpGained, player, isLocalPlayer));
}

function updateCaptureEffects() {
	for (let i = captureEffects.length - 1; i >= 0; i--) {
		if (!captureEffects[i].update()) {
			captureEffects.splice(i, 1);
		}
	}
	
	// Update local outline thickening
	if (localOutlineThicken.active) {
		const elapsed = Date.now() - localOutlineThicken.startTime;
		if (elapsed >= localOutlineThicken.duration) {
			localOutlineThicken.active = false;
		}
	}
}

function renderCaptureEffects(ctx) {
	for (const effect of captureEffects) {
		effect.render(ctx);
	}
}

// Get outline thickness multiplier for a player
function getOutlineThickness(player) {
	if (user && player.num === user.num && localOutlineThicken.active) {
		const elapsed = Date.now() - localOutlineThicken.startTime;
		const progress = Math.min(1, elapsed / localOutlineThicken.duration);
		// Ease out: starts thick, returns to normal
		const thickenFactor = 1 + 2 * (1 - progress);
		return thickenFactor;
	}
	return 1;
}

// Update XP meter tween
function updateXpMeterTween(currentXp) {
	if (xpMeterTween.targetValue !== currentXp) {
		// New target value - start a new tween
		xpMeterTween.startValue = xpMeterTween.currentValue;
		xpMeterTween.targetValue = currentXp;
		xpMeterTween.startTime = Date.now();
	}
	
	const elapsed = Date.now() - xpMeterTween.startTime;
	const progress = Math.min(1, elapsed / xpMeterTween.duration);
	
	// Ease out quad
	const eased = progress * (2 - progress);
	xpMeterTween.currentValue = xpMeterTween.startValue + (xpMeterTween.targetValue - xpMeterTween.startValue) * eased;
	
	return xpMeterTween.currentValue;
}

function spawnDeathEffect(player, isUser = false) {
	const x = player.x;
	const y = player.y;
	const color = player.baseColor.rgbString();
	const lightColor = player.lightBaseColor.rgbString();
	
	const burstCount = isUser ? 40 : 25;
	for (let i = 0; i < burstCount; i++) {
		deathParticles.push(new DeathParticle(x, y, color, 'burst'));
	}
	
	const sparkCount = isUser ? 20 : 12;
	for (let i = 0; i < sparkCount; i++) {
		deathParticles.push(new DeathParticle(x, y, lightColor, 'spark'));
	}
	
	deathParticles.push(new DeathParticle(x, y, color, 'ring'));
	if (isUser) {
		setTimeout(() => {
			deathParticles.push(new DeathParticle(x, y, lightColor, 'ring'));
		}, 100);
	}
	
	if (player.territory && player.territory.length > 3) {
		const shardCount = isUser ? 15 : 8;
		for (let i = 0; i < shardCount; i++) {
			const idx = Math.floor(Math.random() * player.territory.length);
			const pt = player.territory[idx];
			deathParticles.push(new DeathParticle(pt.x, pt.y, color, 'shard'));
		}
	}
	
	if (isUser) {
		screenShake.intensity = 25;
	}
	
	dyingPlayers.push({
		player: player,
		deathTime: Date.now(),
		dissolveProgress: 0
	});
}

function updateDeathEffects() {
	for (let i = deathParticles.length - 1; i >= 0; i--) {
		if (!deathParticles[i].update()) {
			deathParticles.splice(i, 1);
		}
	}
	
	// Update loot coin animations
	updateLootCoins();
	
	// Update hitscan effects
	updateHitscanEffects();
	
	// Update capture effects
	updateCaptureEffects();
	
	if (screenShake.intensity > 0.5) {
		screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
		screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
		screenShake.intensity *= screenShake.decay;
	} else {
		screenShake.x = 0;
		screenShake.y = 0;
		screenShake.intensity = 0;
	}
	
	for (let i = dyingPlayers.length - 1; i >= 0; i--) {
		const dp = dyingPlayers[i];
		dp.dissolveProgress = Math.min(1, (Date.now() - dp.deathTime) / 1500);
		if (dp.dissolveProgress >= 1) {
			dyingPlayers.splice(i, 1);
		}
	}
}

function renderDeathParticles(ctx) {
	for (const particle of deathParticles) {
		particle.render(ctx);
	}
}

function getDyingPlayerEffect(player) {
	const dp = dyingPlayers.find(d => d.player === player);
	return dp ? dp.dissolveProgress : 0;
}

export function addPlayer(player) {
	playerPortion[player.num] = 0;
	portionsRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
	barProportionRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
};

export function disconnect() {
	$("#wasted").fadeIn(1000);
};

export function removePlayer(player) {
	const isUser = user && player.num === user.num;
	spawnDeathEffect(player, isUser);
	
	// Play death sound
	if (soundInitialized && user) {
		if (isUser) {
			// Local player died
			SoundManager.playDeathSound(true);
		} else {
			// Other player died - calculate distance
			const dx = player.x - user.x;
			const dy = player.y - user.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			SoundManager.playDeathSound(false, distance);
		}
	}
	
	delete playerPortion[player.num];
	delete portionsRolling[player.num];
	delete barProportionRolling[player.num];
};

// Silent removal for players leaving AOI (not dead, just out of view)
export function removePlayerSilent(player) {
	delete playerPortion[player.num];
	delete portionsRolling[player.num];
	delete barProportionRolling[player.num];
};

export function setUser(player) {
	user = player;
	centerOnPlayer(user, offset);
};

export { reset };

export { paintDoubleBuff as paint };

export { update };

export { spawnLootCoins };

// Coin pickup handler (called from game-client)
export function coinPickup(coin) {
	// Play coin pickup sound
	if (soundInitialized) {
		SoundManager.playCoinPickup();
	}
}

// Player kill handler (called from game-client when local player gets a kill)
export function playerKill(killerNum, victimNum, victimName, killType) {
	// Play kill sound
	if (soundInitialized) {
		SoundManager.playKillSound();
	}
}

// Player was killed handler (called from game-client when local player is killed)
export function playerWasKilled(killerName, killType) {
	lastKillerName = killerName;
}

// Hitscan visual effect handler (called from game-client)
export function hitscan(fromX, fromY, toX, toY, ownerId, damage) {
	spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage);
	
	// Play laser sound
	if (soundInitialized && user) {
		const isOwnShot = ownerId === user.num;
		if (isOwnShot) {
			SoundManager.playPlayerLaser();
		} else {
			// Calculate distance from local player to shot
			const dx = fromX - user.x;
			const dy = fromY - user.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			SoundManager.playEnemyLaser(distance);
		}
	}
}

// Capture success visual effect handler (called from game-client)
export function captureSuccess(x, y, xpGained, player, isLocalPlayer) {
	spawnCaptureEffect(x, y, xpGained, player, isLocalPlayer);
	
	// Play capture sound
	if (soundInitialized && isLocalPlayer) {
		SoundManager.playCaptureSound(true);
	}
}


// Level up visual effect handler (called from game-client)
export function levelUp(x, y, newLevel, player) {
	// Create a special level-up effect at the player's position
	const isLocalPlayer = user && player && player.num === user.num;
	
	// Create a burst effect with golden particles
	const color = player && player.baseColor ? player.baseColor.rgbString() : '#FFD700';
	
	// Add burst particles (keep it lighter for non-local players to avoid periodic stutter)
	const burstCount = isLocalPlayer ? 30 : 8;
	for (let i = 0; i < burstCount; i++) {
		deathParticles.push(new DeathParticle(x, y, '#FFD700', 'burst'));
	}
	
	// Add a ring effect (always)
	deathParticles.push(new DeathParticle(x, y, '#FFD700', 'ring'));
	
	// Screen shake for local player
	if (isLocalPlayer) {
		screenShake.intensity = 10;
	}
	
	// Add the "LEVEL UP!" text only for the local player (bots leveling can be frequent)
	if (isLocalPlayer) {
		captureEffects.push(new LevelUpTextEffect(x, y, newLevel, player, isLocalPlayer));
	}
	
	// Play level up sound
	if (soundInitialized && isLocalPlayer) {
		SoundManager.playLevelUpSound();
	}
}

// Special level-up text effect
class LevelUpTextEffect {
	constructor(x, y, newLevel, player, isLocalPlayer) {
		this.x = x;
		this.y = y;
		this.newLevel = newLevel;
		this.player = player;
		this.isLocalPlayer = isLocalPlayer;
		this.spawnTime = Date.now();
		this.color = player && player.baseColor ? player.baseColor : null;
		
		// Text animation
		this.textY = y - 40;
		this.textAlpha = 1;
		this.scale = 0.5;
	}
	
	update() {
		const elapsed = (Date.now() - this.spawnTime) / 1000;
		const duration = 1.5;
		const progress = Math.min(1, elapsed / duration);
		
		// Float up and fade
		this.textY = this.y - 40 - progress * 60;
		this.textAlpha = Math.max(0, 1 - progress);
		
		// Scale up then back down
		if (progress < 0.3) {
			this.scale = 0.5 + (progress / 0.3) * 1.0;
		} else {
			this.scale = 1.5 - (progress - 0.3) * 0.5;
		}
		
		return progress < 1;
	}
	
	render(ctx) {
		if (this.textAlpha <= 0) return;
		
		ctx.save();
		ctx.globalAlpha = this.textAlpha;
		ctx.translate(this.x, this.textY);
		ctx.scale(this.scale, this.scale);
		
		// Glow effect
		ctx.shadowColor = '#FFD700';
		ctx.shadowBlur = 20 * this.textAlpha;
		
		// Text
		ctx.fillStyle = '#FFD700';
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
		ctx.lineWidth = 4;
		ctx.font = 'bold 24px Changa';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		
		const text = `⬆️ LEVEL ${this.newLevel}! ⬆️`;
		ctx.strokeText(text, 0, 0);
		ctx.fillText(text, 0, 0);
		
		// Bonus info text below
		ctx.font = 'bold 14px Changa';
		ctx.fillStyle = '#88CCFF';
		ctx.strokeText('+1 Drone, +5% Size', 0, 28);
		ctx.fillText('+1 Drone, +5% Size', 0, 28);
		
		ctx.restore();
	}
}

// ===== UPGRADE UI EXPORTS =====

export function showUpgradeUI(choices, newLevel) {
	upgradeChoices = choices || [];
	upgradeNewLevel = newLevel || 1;
	upgradeUIVisible = true;
	hoveredUpgrade = -1;
}

export function hideUpgradeUI() {
	upgradeUIVisible = false;
	upgradeChoices = [];
	hoveredUpgrade = -1;
}
