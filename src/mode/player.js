import jquery from "jquery";
import { Color } from "../core";
import * as client from "../game-client";
import { consts } from "../../config.js";
import { ENEMY_TYPES, BOSS_TYPES } from "../core/enemy-knobs.js";
import { UPGRADE_ICONS, UPGRADES_BY_ID, UPGRADES_BY_RARITY } from "../core/upgrades.js";
import * as UPGRADE_KNOBS from "../core/upgrade-knobs.js";
import * as SoundManager from "../sound-manager.js";

// Drone rendering constants
const DRONE_VISUAL_RADIUS = consts.DRONE_RADIUS || 10;

// Enemy type colors and styles (shared with server data)
const ENEMY_STYLES = {};
for (const [id, data] of Object.entries(ENEMY_TYPES)) {
	if (data.color) {
		ENEMY_STYLES[id] = {
			color: data.color,
			outline: data.outline || data.color
		};
	}
}
for (const [id, data] of Object.entries(BOSS_TYPES)) {
	if (data.color) {
		ENEMY_STYLES[id] = {
			color: data.color,
			outline: data.outline || data.color
		};
	}
}

const SHADOW_OFFSET = 5;
const ANIMATE_FRAMES = 24;
const MIN_BAR_WIDTH = 65;
const BAR_HEIGHT = 45;
const BAR_WIDTH = 400;
const PLAYER_RADIUS = consts.CELL_WIDTH / 2;
const DAMAGE_FLASH_DURATION = 220;
const DAMAGE_NUMBER_MAX_PER_SEC = 4;
const DAMAGE_NUMBER_MERGE_WINDOW = 250;

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

// Impact effects (projectile hit explosions)
const impactEffects = [];

// Damage number effects (floating combat text)
const damageNumbers = [];
let showDamageNumbers = true; // Setting toggle
let showEnemyHealthBars = true; // Setting toggle for enemy HP bars

// Track per-player HP to detect damage/heal changes locally
const playerHpTracker = new Map();
const damageNumberBuckets = new Map();
const healNumberBuckets = new Map();

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

// Drone choice UI state
let droneUIVisible = false;
let droneChoices = [];
let droneSlotIndex = 0; // Which drone slot is being chosen
let newDroneCount = 1;
let hoveredDrone = -1; // Index of hovered drone card (-1 = none)

// Dev console state
let devConsoleVisible = false;
let devConsoleElement = null;

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
	
	// Backtick (`) toggles dev console
	if (e.key === '`' || e.key === '~') {
		e.preventDefault();
		toggleDevConsole();
		return;
	}
	
	// ESC key toggles settings menu (or closes dev console if open)
	if (e.key === 'Escape') {
		e.preventDefault();
		if (devConsoleVisible) {
			toggleDevConsole();
		} else {
			toggleSettingsMenu();
		}
		return;
	}
	
	// Block other input while dev console is open
	if (devConsoleVisible) return;
	
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
	
	// Handle drone selection with number keys
	if (droneUIVisible && droneChoices && droneChoices.length > 0) {
		const key = e.key;
		if (key === '1' && droneChoices[0]) {
			client.selectDrone(droneChoices[0].id);
			return;
		}
		if (key === '2' && droneChoices[1]) {
			client.selectDrone(droneChoices[1].id);
			return;
		}
		if (key === '3' && droneChoices[2]) {
			client.selectDrone(droneChoices[2].id);
			return;
		}
		// Block other input while drone UI is open
		return;
	}
	
	// WASD movement controls
	const key = e.key.toLowerCase();
	if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
		client.setKeyState(key, true);
	}
}

function handleKeyUp(e) {
	// Block input while upgrade or drone UI is open
	if (upgradeUIVisible || droneUIVisible) return;
	
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
		return;
	}
	
	// Handle drone selection by clicking cards
	if (droneUIVisible && droneChoices && droneChoices.length > 0) {
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		
		const cardIndex = getHoveredDroneCard(mouseX, mouseY);
		if (cardIndex >= 0 && droneChoices[cardIndex]) {
			client.selectDrone(droneChoices[cardIndex].id);
		}
	}
}

// Settings panel setup
let settingsOpen = false;
let settingsPanel = null;
let settingsUpgradesPanel = null;
let settingsUpgradesList = null;
let lastUpgradesSignature = "";

function openSettingsMenu() {
	if (!settingsPanel) settingsPanel = document.getElementById('settings');
	if (settingsPanel) {
		settingsOpen = true;
		settingsPanel.style.display = 'block';
		if (!settingsUpgradesPanel) settingsUpgradesPanel = document.getElementById('settings-upgrades-panel');
		if (settingsUpgradesPanel) settingsUpgradesPanel.style.display = 'block';
		updateSettingsUpgradesList();
		// Pause the game while settings are open
		client.setGamePaused(true);
	}
}

function closeSettingsMenu() {
	if (!settingsPanel) settingsPanel = document.getElementById('settings');
	if (settingsPanel) {
		settingsOpen = false;
		settingsPanel.style.display = 'none';
		if (!settingsUpgradesPanel) settingsUpgradesPanel = document.getElementById('settings-upgrades-panel');
		if (settingsUpgradesPanel) settingsUpgradesPanel.style.display = 'none';
		// Resume the game when settings close (only if no other UI is pausing)
		client.setGamePaused(false);
	}
}

function toggleSettingsMenu() {
	if (settingsOpen) {
		closeSettingsMenu();
	} else {
		openSettingsMenu();
	}
}

function setupSettingsPanel() {
	settingsPanel = document.getElementById('settings');
	settingsUpgradesPanel = document.getElementById('settings-upgrades-panel');
	settingsUpgradesList = document.getElementById('settings-upgrades-list');
	const toggleBtn = document.querySelector('.toggle');
	const closeBtn = document.getElementById('settings-close');
	const menuBtn = document.getElementById('settings-menu-btn');
	
	// Toggle settings panel - use click event with proper handling
	if (toggleBtn) {
		toggleBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleSettingsMenu();
		});
	}
	
	// Close button
	if (closeBtn) {
		closeBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			closeSettingsMenu();
		});
	}
	
	// Main menu button - reload page to go back to main menu
	if (menuBtn) {
		menuBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			closeSettingsMenu();
			// Reload the page to return to main menu
			window.location.reload();
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
	
	// Damage numbers toggle
	const damageNumbersCheckbox = document.getElementById('opt-damage-numbers');
	if (damageNumbersCheckbox) {
		damageNumbersCheckbox.addEventListener('change', (e) => {
			showDamageNumbers = e.target.checked;
		});
	}
	
	// Enemy health bars toggle
	const enemyHealthBarsCheckbox = document.getElementById('opt-enemy-healthbars');
	if (enemyHealthBarsCheckbox) {
		enemyHealthBarsCheckbox.addEventListener('change', (e) => {
			showEnemyHealthBars = e.target.checked;
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

function getUpgradesSignature(upgrades) {
	if (!upgrades) return "";
	return Object.keys(upgrades)
		.sort()
		.map(id => `${id}:${upgrades[id]}`)
		.join("|");
}

function updateSettingsUpgradesList() {
	if (!settingsUpgradesList) return;
	const user = client.getUser();
	const upgrades = (user && user.upgrades) ? user.upgrades : {};
	const signature = getUpgradesSignature(upgrades);
	if (signature === lastUpgradesSignature) return;
	lastUpgradesSignature = signature;
	
	settingsUpgradesList.innerHTML = "";
	const entries = Object.entries(upgrades).filter(([, stacks]) => stacks > 0);
	
	if (entries.length === 0) {
		const empty = document.createElement("div");
		empty.className = "settings-upgrades-empty";
		empty.textContent = "No upgrades yet";
		settingsUpgradesList.appendChild(empty);
		return;
	}
	
	// Sort by rarity (legendary -> rare -> basic) then name
	const rarityOrder = { legendary: 0, rare: 1, basic: 2 };
	entries.sort((a, b) => {
		const aUp = UPGRADES_BY_ID[a[0]];
		const bUp = UPGRADES_BY_ID[b[0]];
		const aR = rarityOrder[aUp?.rarity] ?? 3;
		const bR = rarityOrder[bUp?.rarity] ?? 3;
		if (aR !== bR) return aR - bR;
		return (aUp?.name || "").localeCompare(bUp?.name || "");
	});
	
	for (const [upgradeId, stacks] of entries) {
		const upgrade = UPGRADES_BY_ID[upgradeId];
		if (!upgrade) continue;
		
		const item = document.createElement("div");
		item.className = "upgrade-item";
		item.style.borderColor = (RARITY_COLORS[upgrade.rarity] || "#777");
		
		const iconCanvas = document.createElement("canvas");
		iconCanvas.className = "upgrade-icon";
		iconCanvas.width = 24;
		iconCanvas.height = 24;
		renderUpgradeIconCanvas(iconCanvas, UPGRADE_ICONS[upgradeId] || "generic", RARITY_COLORS[upgrade.rarity]);
		
		const name = document.createElement("div");
		name.className = "upgrade-name";
		name.textContent = upgrade.name;
		
		const stacksEl = document.createElement("div");
		stacksEl.className = "upgrade-stacks";
		stacksEl.textContent = stacks > 1 ? `x${stacks}` : "";
		
		const tooltip = upgrade.description ? upgrade.description(stacks) : upgrade.name;
		item.title = tooltip;
		
		item.appendChild(iconCanvas);
		item.appendChild(name);
		item.appendChild(stacksEl);
		settingsUpgradesList.appendChild(item);
	}
}

// ===== DEV CONSOLE =====
function toggleDevConsole() {
	if (devConsoleVisible) {
		closeDevConsole();
	} else {
		openDevConsole();
	}
}

function openDevConsole() {
	if (!devConsoleElement) {
		createDevConsole();
	}
	devConsoleElement.style.display = 'block';
	devConsoleVisible = true;
}

function closeDevConsole() {
	if (devConsoleElement) {
		devConsoleElement.style.display = 'none';
	}
	devConsoleVisible = false;
}

function createDevConsole() {
	// Create the dev console element
	devConsoleElement = document.createElement('div');
	devConsoleElement.id = 'dev-console';
	devConsoleElement.innerHTML = `
		<div class="dev-console-header">
			<h2>🛠️ Dev Console</h2>
			<button class="dev-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
		</div>
		<div class="dev-console-content">
			<div class="dev-section">
				<h3>XP & Leveling</h3>
				<div class="dev-row">
					<button id="dev-xp-100">+100 XP</button>
					<button id="dev-xp-500">+500 XP</button>
					<button id="dev-xp-1000">+1000 XP</button>
				</div>
				<div class="dev-row">
					<input type="number" id="dev-level-input" value="5" min="1" max="50">
					<button id="dev-set-level">Set Level</button>
				</div>
			</div>
			<div class="dev-section">
				<h3>Health & Stamina</h3>
				<div class="dev-row">
					<button id="dev-heal">Full Heal</button>
					<button id="dev-god-mode">Toggle God Mode</button>
				</div>
			</div>
			<div class="dev-section">
				<h3>Upgrades</h3>
				<div class="dev-row">
					<select id="dev-upgrade-select"></select>
					<button id="dev-give-upgrade">Give Upgrade</button>
				</div>
			</div>
			<div class="dev-section">
				<h3>Drones</h3>
				<div class="dev-row">
					<select id="dev-drone-select">
						<option value="assault" style="color:#FF6B6B">Assault - Balanced bullets</option>
						<option value="rapid" style="color:#4ECDC4">Rapid - Fast hitscan laser</option>
						<option value="sniper" style="color:#9B59B6">Sniper - Slow piercing railgun</option>
						<option value="guardian" style="color:#3B2A5A">Black Hole - Singularity orb</option>
						<option value="skirmisher" style="color:#F39C12">Skirmisher - Fast bullets</option>
						<option value="support" style="color:#FF7A1A">Flame - Burning stream</option>
						<option value="swarm" style="color:#E74C3C">Swarm - Tiny rapid lasers</option>
					</select>
					<button id="dev-add-drone">Add Drone</button>
				</div>
				<div class="dev-row">
					<button id="dev-clear-drones">Clear All Drones</button>
				</div>
			</div>
			<div class="dev-section">
				<h3>Enemy Spawn</h3>
				<div class="dev-row">
					<select id="dev-enemy-select"></select>
					<input type="number" id="dev-enemy-count" value="5" min="1" max="50">
					<button id="dev-spawn-enemy">Spawn</button>
				</div>
			</div>
			<div class="dev-section">
				<h3>Time Speed (Scaling Test)</h3>
				<div class="dev-row">
					<button id="dev-time-1x" class="dev-time-btn active">1x</button>
					<button id="dev-time-2x" class="dev-time-btn">2x</button>
					<button id="dev-time-4x" class="dev-time-btn">4x</button>
					<button id="dev-time-8x" class="dev-time-btn">8x</button>
				</div>
				<div class="dev-row">
					<span style="color:#888;font-size:0.75rem;">Speeds up game timer (enemy scaling/spawning) without affecting framerate</span>
				</div>
			</div>
		</div>
		<div class="dev-console-footer">
			Press \` or ESC to close
		</div>
	`;
	
	// Apply styles
	devConsoleElement.style.cssText = `
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(20, 20, 25, 0.95);
		border: 2px solid #FFD700;
		border-radius: 10px;
		padding: 0;
		z-index: 10000;
		min-width: 400px;
		max-width: 500px;
		max-height: 80vh;
		overflow: hidden;
		font-family: 'Changa', sans-serif;
		color: white;
		box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
	`;
	
	document.body.appendChild(devConsoleElement);
	
	// Add inline styles for child elements
	const style = document.createElement('style');
	style.textContent = `
		#dev-console .dev-console-header {
			background: linear-gradient(to right, #2a2a30, #3a3a40);
			padding: 12px 15px;
			display: flex;
			justify-content: space-between;
			align-items: center;
			border-bottom: 2px solid #FFD700;
			border-radius: 8px 8px 0 0;
		}
		#dev-console .dev-console-header h2 {
			margin: 0;
			font-size: 1.2rem;
			color: #FFD700;
		}
		#dev-console .dev-close {
			background: none;
			border: none;
			color: #888;
			font-size: 24px;
			cursor: pointer;
			padding: 0 5px;
		}
		#dev-console .dev-close:hover {
			color: #FF6B6B;
		}
		#dev-console .dev-console-content {
			padding: 15px;
			max-height: calc(80vh - 100px);
			overflow-y: auto;
		}
		#dev-console .dev-section {
			margin-bottom: 15px;
			padding-bottom: 15px;
			border-bottom: 1px solid #444;
		}
		#dev-console .dev-section:last-child {
			border-bottom: none;
			margin-bottom: 0;
			padding-bottom: 0;
		}
		#dev-console .dev-section h3 {
			margin: 0 0 10px 0;
			font-size: 0.9rem;
			color: #98FB98;
			text-transform: uppercase;
			letter-spacing: 1px;
		}
		#dev-console .dev-row {
			display: flex;
			gap: 8px;
			margin-bottom: 8px;
		}
		#dev-console .dev-row:last-child {
			margin-bottom: 0;
		}
		#dev-console button {
			background: linear-gradient(to bottom, #4a4a55, #3a3a45);
			border: 2px solid #555;
			border-bottom: 3px solid #333;
			color: white;
			padding: 8px 15px;
			border-radius: 5px;
			cursor: pointer;
			font-family: 'Changa', sans-serif;
			font-size: 0.85rem;
			transition: all 0.15s;
		}
		#dev-console button:hover {
			background: linear-gradient(to bottom, #5a5a65, #4a4a55);
			border-color: #FFD700;
		}
		#dev-console button:active {
			transform: translateY(2px);
			border-bottom-width: 1px;
		}
		#dev-console .dev-time-btn.active {
			background: linear-gradient(to bottom, #5a8a55, #4a7a45);
			border-color: #98FB98;
			color: #98FB98;
		}
		#dev-console input, #dev-console select {
			background: #2a2a30;
			border: 2px solid #444;
			color: white;
			padding: 8px 12px;
			border-radius: 5px;
			font-family: 'Changa', sans-serif;
			font-size: 0.85rem;
		}
		#dev-console input {
			width: 70px;
		}
		#dev-console select {
			flex: 1;
		}
		#dev-console .dev-console-footer {
			background: #1a1a20;
			padding: 10px 15px;
			text-align: center;
			font-size: 0.75rem;
			color: #666;
			border-radius: 0 0 8px 8px;
		}
	`;
	document.head.appendChild(style);
	
	populateDevUpgradeSelect();
	populateDevEnemySelect();
	
	// Wire up event handlers
	document.getElementById('dev-xp-100').onclick = () => client.devGiveXP(100);
	document.getElementById('dev-xp-500').onclick = () => client.devGiveXP(500);
	document.getElementById('dev-xp-1000').onclick = () => client.devGiveXP(1000);
	document.getElementById('dev-set-level').onclick = () => {
		const level = parseInt(document.getElementById('dev-level-input').value) || 1;
		client.devSetLevel(level);
	};
	document.getElementById('dev-heal').onclick = () => client.devHeal();
	document.getElementById('dev-god-mode').onclick = () => client.devGodMode();
	document.getElementById('dev-give-upgrade').onclick = () => {
		const upgradeId = document.getElementById('dev-upgrade-select').value;
		client.devGiveUpgrade(upgradeId);
	};
	document.getElementById('dev-add-drone').onclick = () => {
		const droneTypeId = document.getElementById('dev-drone-select').value;
		client.devAddDrone(droneTypeId);
	};
	document.getElementById('dev-clear-drones').onclick = () => client.devClearDrones();
	document.getElementById('dev-spawn-enemy').onclick = () => {
		const type = document.getElementById('dev-enemy-select').value;
		const count = parseInt(document.getElementById('dev-enemy-count').value, 10) || 1;
		client.devSpawnEnemy(type, count);
	};
	
	// Time speed buttons
	const timeSpeedBtns = [
		{ id: 'dev-time-1x', multiplier: 1 },
		{ id: 'dev-time-2x', multiplier: 2 },
		{ id: 'dev-time-4x', multiplier: 4 },
		{ id: 'dev-time-8x', multiplier: 8 }
	];
	timeSpeedBtns.forEach(({ id, multiplier }) => {
		document.getElementById(id).onclick = () => {
			client.devSetTimeSpeed(multiplier);
			// Update active state
			timeSpeedBtns.forEach(btn => {
				document.getElementById(btn.id).classList.remove('active');
			});
			document.getElementById(id).classList.add('active');
		};
	});
	
	// Close button handler
	devConsoleElement.querySelector('.dev-close').onclick = () => closeDevConsole();
}

function populateDevEnemySelect() {
	const select = document.getElementById('dev-enemy-select');
	if (!select) return;
	
	select.innerHTML = "";
	
	for (const [id, data] of Object.entries(ENEMY_TYPES)) {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = id.charAt(0).toUpperCase() + id.slice(1);
		if (data.color) {
			option.style.color = data.color;
		}
		select.appendChild(option);
	}
	for (const [id, data] of Object.entries(BOSS_TYPES)) {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = `Boss: ${id.charAt(0).toUpperCase() + id.slice(1)}`;
		if (data.color) {
			option.style.color = data.color;
		}
		select.appendChild(option);
	}
}

function populateDevUpgradeSelect() {
	const select = document.getElementById('dev-upgrade-select');
	if (!select) return;
	
	select.innerHTML = "";
	
	const rarityGroups = [
		{ label: "Basic", rarity: "basic" },
		{ label: "Rare", rarity: "rare" },
		{ label: "Legendary", rarity: "legendary" }
	];
	
	for (const group of rarityGroups) {
		const upgrades = UPGRADES_BY_RARITY[group.rarity] || [];
		if (upgrades.length === 0) continue;
		
		const optGroup = document.createElement('optgroup');
		optGroup.label = group.label;
		
		for (const upgrade of upgrades) {
			const option = document.createElement('option');
			option.value = upgrade.id;
			option.textContent = upgrade.name || upgrade.id;
			optGroup.appendChild(option);
		}
		
		select.appendChild(optGroup);
	}
	
	if (select.options.length === 0) {
		const option = document.createElement('option');
		option.value = "";
		option.textContent = "No upgrades found";
		select.appendChild(option);
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
	
	// Track hovered drone card
	if (droneUIVisible) {
		hoveredDrone = getHoveredDroneCard(mouseX, mouseY);
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

let playerPortion, portionsRolling, animateTo, offset, user, zoom, showedDead;
let lastKillerName = null; // Track who killed the player
let gameMessageText = null;
let gameMessageUntil = 0;
let gameMessageStart = 0;

// FPS tracking
let fpsHistory = [];
let lastFrameTime = performance.now();
let currentFPS = 60;
const MAX_FPS_HISTORY = 120; // Store 120 frames of history (~2 seconds at 60fps)

// DPS tracking
let damageHistory = []; // Array of { time, damage } entries
let totalDamage = 0;
let currentDPS = 0;
const DPS_WINDOW_SECONDS = 1.0; // Calculate DPS over last 1 second

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
	animateTo = [0, 0];
	offset = [0, 0];
	user = null;
	zoom = 1;
	showedDead = false;
	lastKillerName = null;
	gameMessageText = null;
	gameMessageUntil = 0;
	gameMessageStart = 0;
	
	// Reset DPS tracking
	damageHistory = [];
	totalDamage = 0;
	currentDPS = 0;
	
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
	
	// Clear impact effects
	impactEffects.length = 0;
	
	// Clear damage numbers
	damageNumbers.length = 0;
	playerHpTracker.clear();
	damageNumberBuckets.clear();
	healNumberBuckets.clear();
	
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
	
	// Reset drone UI
	droneUIVisible = false;
	droneChoices = [];
	droneSlotIndex = 0;
	newDroneCount = 1;
	hoveredDrone = -1;
	
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

	// Get user stats
	const userPortions = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
	const score = (userPortions * 100).toFixed(2) + "%";
	const kills = client.getKills();
	const level = user.level || 1;
	const actualDroneCount = user.droneCount ?? level;
	const displayDroneCount = Math.max(0, actualDroneCount - 1);

	// === TOP LEFT: Score, Kills, Drones (fixed-width columns) ===
	const centerY = BAR_HEIGHT / 2 + 6;
	
	// Fixed column positions to prevent layout shift
	const scoreX = 20;
	const killsX = 160;
	const dronesX = 280;
	
	ctx.font = "bold 18px Changa";

	// Score (fixed position)
	ctx.fillStyle = "#FFD700";
	ctx.fillText("Score:", scoreX, centerY);
	ctx.fillStyle = "white";
	ctx.fillText(score, scoreX + 60, centerY);

	// Kills (fixed position)
	ctx.fillStyle = "#FF6B6B";
	ctx.fillText("Kills:", killsX, centerY);
	ctx.fillStyle = "white";
	ctx.fillText(kills, killsX + 50, centerY);

	// Drones (fixed position)
	ctx.fillStyle = "#88CCFF";
	ctx.fillText("Drones:", dronesX, centerY);
	ctx.fillStyle = "white";
	const droneInterval = consts.DRONE_LEVEL_INTERVAL || 5;
	const maxDrones = consts.MAX_DRONES || 50;
	const nextDroneLevel = 1 + (Math.max(1, actualDroneCount) * droneInterval);
	const droneSuffix = (actualDroneCount >= maxDrones)
		? " (Max)"
		: ` (Unlocked Lv.${nextDroneLevel})`;
	ctx.fillText(`${displayDroneCount}${droneSuffix}`, dronesX + 70, centerY);

	// === TOP RIGHT: Run Timer ===
	const stats = client.getEnemyStats();
	const runTime = stats && stats.runTime != null ? stats.runTime : 0;
	const minutes = Math.floor(runTime / 60);
	const seconds = Math.floor(runTime % 60);
	const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
	
	ctx.font = "bold 24px Changa";
	ctx.textAlign = "right";
	ctx.fillStyle = "#FFFFFF";
	ctx.fillText(timerText, canvasWidth - 20, centerY);
}

function paintBottomHPBar(ctx) {
	if (!user) return;
	
	const hp = user.hp ?? (consts.PLAYER_MAX_HP ?? 100);
	const maxHp = user.maxHp ?? (consts.PLAYER_MAX_HP ?? 100);
	
	// Bar dimensions (big bottom bar)
	const barWidth = 250;
	const barHeight = 28;
	const barX = (canvasWidth - barWidth) / 2;
	const barY = canvasHeight - 45; // Bottom bar
	
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
	ctx.fillRect(barX, barY, barWidth, barHeight - SHADOW_OFFSET);
	ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
	ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, barWidth, SHADOW_OFFSET);
	
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
		ctx.fillRect(barX, barY, fillWidth, barHeight - SHADOW_OFFSET);
		ctx.fillStyle = shadowColor;
		ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, fillWidth, SHADOW_OFFSET);
	}
	
	// === HP TEXT (on the bar) ===
	ctx.font = "16px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(Math.floor(hp) + "/" + Math.floor(maxHp), barX + barWidth / 2, barY + barHeight - 9);
}

function paintPlayerStats(ctx) {
	if (!user) return;
	
	const startX = 15;
	const rowHeight = 18;
	const labelWidth = 60;
	const valueWidth = 50;
	const panelWidth = labelWidth + valueWidth + 16;
	
	// Get derived stats from upgrades
	const derivedStats = user.derivedStats || {};
	const maxHp = user.maxHp ?? (consts.PLAYER_MAX_HP ?? 100);
	const maxStamina = user.maxStamina ?? (consts.PLAYER_MAX_STAMINA ?? 100);
	let damageMult = derivedStats.damageMult ?? 1.0;
	let attackSpeedMult = derivedStats.attackSpeedMult ?? 1.0;
	const critChance = derivedStats.critChance ?? 0;
	const critMult = derivedStats.critMult ?? 2.0;
	const moveSpeedMult = derivedStats.moveSpeedMult ?? 1.0;
	const lifeStealPercent = derivedStats.lifeStealPercent ?? 0;
	const extraProjectiles = derivedStats.extraProjectiles ?? 0;
	const rangeMult = derivedStats.rangeMult ?? 1.0;
	
	// Apply Berserker display bonus when active (client-side view)
	if (derivedStats.hasBerserker) {
		const berserkerThreshold = UPGRADE_KNOBS.BERSERKER.hpThreshold;
		if (user.hp <= maxHp * berserkerThreshold) {
			attackSpeedMult *= (1 + UPGRADE_KNOBS.BERSERKER.attackSpeedBonus);
			damageMult += UPGRADE_KNOBS.BERSERKER.damageBonus;
		}
	}

	// Apply Territorial display bonus when active (client-side view)
	if (derivedStats.hasTerritorial && isInOwnTerritory(user)) {
		damageMult += UPGRADE_KNOBS.TERRITORIAL.damageBonus;
	}
	
	// Apply Get Away display bonus when active (client-side view)
	if (derivedStats.hasGetAway && user.getAwayEnemyCount > 0) {
		damageMult += user.getAwayEnemyCount * UPGRADE_KNOBS.GET_AWAY.damagePerEnemy;
	}
	
	// Stats to display with labels and formatted values
	const stats = [
		{ label: "HP", value: Math.floor(maxHp), suffix: "", color: "#FF6B6B" },
		{ label: "Stamina", value: Math.floor(maxStamina), suffix: "", color: "#FFD700" },
		{ label: "Damage", value: Math.round(damageMult * 100), suffix: "%", color: "#E74C3C" },
		{ label: "Atk Spd", value: Math.round(attackSpeedMult * 100), suffix: "%", color: "#F39C12" },
		{ label: "Speed", value: Math.round(moveSpeedMult * 100), suffix: "%", color: "#88DDFF" },
		{ label: "Crit", value: Math.round(critChance * 100), suffix: "%", color: "#9B59B6" },
		{ label: "Crit Dmg", value: Math.round(critMult * 100), suffix: "%", color: "#E056FD" },
		{ label: "Lifesteal", value: (lifeStealPercent * 100).toFixed(1), suffix: "%", color: "#2ECC71" }
	];
	
	// Add multishot if player has any extra projectiles
	if (extraProjectiles > 0) {
		stats.push({ label: "Multishot", value: "+" + extraProjectiles, suffix: "", color: "#00CED1" });
	}
	
	// Add range if player has any range upgrades
	if (rangeMult > 1.0) {
		stats.push({ label: "Range", value: Math.round(rangeMult * 100), suffix: "%", color: "#7FDBFF" });
	}
	
	const startY = canvasHeight - (stats.length * rowHeight + 20);
	const panelHeight = stats.length * rowHeight + 12;
	
	// Background panel
	ctx.fillStyle = "rgba(10, 10, 10, 0.8)";
	roundRect(ctx, startX - 8, startY - 8, panelWidth, panelHeight, 8);
	ctx.fill();
	
	// Subtle border
	ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
	ctx.lineWidth = 1;
	roundRect(ctx, startX - 8, startY - 8, panelWidth, panelHeight, 8);
	ctx.stroke();
	
	// Draw each stat
	stats.forEach((stat, index) => {
		const y = startY + index * rowHeight;
		
		// Label
		ctx.font = "11px Changa";
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.textAlign = "left";
		ctx.fillText(stat.label, startX, y + 12);
		
		// Value
		ctx.font = "bold 12px Changa";
		ctx.fillStyle = stat.color;
		ctx.textAlign = "right";
		ctx.fillText(stat.value.toString() + stat.suffix, startX + panelWidth - 16, y + 12);
	});
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.arcTo(x + width, y, x + width, y + radius, radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
	ctx.lineTo(x + radius, y + height);
	ctx.arcTo(x, y + height, x, y + height - radius, radius);
	ctx.lineTo(x, y + radius);
	ctx.arcTo(x, y, x + radius, y, radius);
	ctx.closePath();
}

function paintBottomXPBar(ctx) {
	if (!user) return;
	
	const level = user.level || 1;
	const xp = user.xp || 0;
	const xpPerLevel = user.xpPerLevel || ((consts.XP_BASE_PER_LEVEL || 50) + (level - 1) * (consts.XP_INCREMENT_PER_LEVEL || 25));
	
	// Bar dimensions (smaller bar above HP)
	const barWidth = 220;
	const barHeight = 18;
	const barX = (canvasWidth - barWidth) / 2;
	const barY = canvasHeight - 80; // Above HP bar
	
	// Tweened XP for smooth animation
	const tweenedXp = updateXpMeterTween(xp);
	const progressRatio = Math.min(1, tweenedXp / xpPerLevel);
	
	// Get player color for the bar
	const baseColor = user.baseColor;
	const shadowColor = user.shadowColor;
	
	// === DARK BACKGROUND (like leaderboard style) ===
	ctx.fillStyle = "rgba(10, 10, 10, 0.5)";
	ctx.fillRect(barX - 45, barY - 2, barWidth + 55, barHeight + 4);
	
	// === LEVEL TEXT (left side) ===
	ctx.font = "bold 14px Changa";
	ctx.fillStyle = "#FFD700";
	ctx.textAlign = "left";
	const levelText = "Lv." + level;
	ctx.fillText(levelText, barX - 40, barY + barHeight - 4);
	
	// === XP BAR TRACK (gray background) ===
	ctx.fillStyle = "rgba(60, 60, 60, 0.8)";
	ctx.fillRect(barX, barY, barWidth, barHeight - 3);
	ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
	ctx.fillRect(barX, barY + barHeight - 3, barWidth, 3);
	
	// === XP BAR FILL (player color with shadow offset) ===
	if (progressRatio > 0) {
		const fillWidth = barWidth * progressRatio;
		ctx.fillStyle = baseColor.rgbString();
		ctx.fillRect(barX, barY, fillWidth, barHeight - 3);
		ctx.fillStyle = shadowColor.rgbString();
		ctx.fillRect(barX, barY + barHeight - 3, fillWidth, 3);
	}
	
	// === XP TEXT (on the bar) ===
	ctx.font = "12px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText(Math.floor(xp) + "/" + xpPerLevel + " XP", barX + barWidth / 2, barY + barHeight - 4);
}

function paintDebugOverlay(ctx) {
	const stats = client.getEnemyStats();
	if (!stats) return;
	
	const enemyCount = stats.enemies != null ? stats.enemies : 0;
	const killCount = stats.kills != null ? stats.kills : client.getKills();
	const unlockedTypes = stats.unlockedTypes || ['basic'];
	const bossCount = stats.bossCount || 0;
	const nextBossIn = stats.nextBossIn != null ? stats.nextBossIn : 0;
	
	// Scaling debug info
	const hpMult = stats.hpMult != null ? stats.hpMult : 1;
	const dmgMult = stats.dmgMult != null ? stats.dmgMult : 1;
	const territoryXpMult = stats.territoryXpMult != null ? stats.territoryXpMult : 1;
	const timeSpeed = stats.timeSpeed != null ? stats.timeSpeed : 1;
	const sampleSpawnHp = stats.sampleSpawnHp != null ? stats.sampleSpawnHp : 30;
	
	const lines = [
		`Enemies: ${enemyCount} (${bossCount} bosses)`,
		`Kills: ${killCount}`,
		`Types: ${unlockedTypes.join(', ')}`,
		`Next boss: ${nextBossIn.toFixed(1)}s`,
		``,
		`── Scaling ──`,
		`HP Mult: ${hpMult.toFixed(2)}x`,
		`DMG Mult: ${dmgMult.toFixed(2)}x`,
		`Territory XP: ${territoryXpMult.toFixed(2)}x`,
		`Basic spawn HP: ${sampleSpawnHp}`,
		timeSpeed !== 1 ? `⏩ Time Speed: ${timeSpeed}x` : null
	].filter(line => line !== null);
	
	ctx.save();
	ctx.font = "12px monospace";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	
	const startX = 10;
	const startY = 8;
	const lineHeight = 14;
	
	// Draw background for better readability
	const maxWidth = 180;
	const bgHeight = lines.length * lineHeight + 8;
	ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
	ctx.fillRect(startX - 4, startY - 4, maxWidth, bgHeight);
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Color-code scaling lines
		if (line.startsWith('HP Mult:') || line.startsWith('DMG Mult:')) {
			const mult = parseFloat(line.split(':')[1]);
			if (mult >= 3) {
				ctx.fillStyle = "#FF6B6B"; // Red for high scaling
			} else if (mult >= 2) {
				ctx.fillStyle = "#FFD700"; // Yellow for medium
			} else {
				ctx.fillStyle = "#98FB98"; // Green for low
			}
		} else if (line.startsWith('Territory XP:')) {
			const mult = parseFloat(line.split(':')[1]);
			if (mult >= 2) {
				ctx.fillStyle = "#98FB98"; // Green for good scaling
			} else if (mult >= 1) {
				ctx.fillStyle = "#FFD700"; // Yellow for baseline
			} else {
				ctx.fillStyle = "#FF6B6B"; // Red for low (diminished)
			}
		} else if (line.startsWith('⏩')) {
			ctx.fillStyle = "#4ECDC4"; // Cyan for time speed
		} else if (line.startsWith('──')) {
			ctx.fillStyle = "#888888"; // Gray for separator
		} else {
			ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		}
		ctx.fillText(line, startX, startY + i * lineHeight);
	}
	
	ctx.restore();
}

function paintFPSDisplay(ctx) {
	const GRAPH_WIDTH = 200;
	const GRAPH_HEIGHT = 80;
	const GRAPH_X = canvasWidth - GRAPH_WIDTH - 10;
	const GRAPH_Y = canvasHeight - GRAPH_HEIGHT - 10;
	const PADDING = 8;
	
	// Update DPS calculation periodically (clean up old entries)
	const now = performance.now();
	const cutoffTime = now - DPS_WINDOW_SECONDS * 1000;
	while (damageHistory.length > 0 && damageHistory[0].time < cutoffTime) {
		totalDamage -= damageHistory[0].damage;
		damageHistory.shift();
	}
	if (damageHistory.length > 0) {
		const timeSpan = (now - damageHistory[0].time) / 1000;
		currentDPS = timeSpan > 0 ? Math.round(totalDamage / timeSpan) : 0;
	} else {
		currentDPS = 0;
	}
	
	ctx.save();
	
	// Background
	ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	ctx.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
	
	// Border
	ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
	ctx.lineWidth = 1;
	ctx.strokeRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
	
	// FPS Counter text
	ctx.font = "bold 18px monospace";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	
	// Color based on FPS
	let fpsColor = "#00FF00"; // Green
	if (currentFPS < 30) {
		fpsColor = "#FF0000"; // Red
	} else if (currentFPS < 50) {
		fpsColor = "#FFAA00"; // Orange
	} else if (currentFPS < 60) {
		fpsColor = "#FFFF00"; // Yellow
	}
	
	ctx.fillStyle = fpsColor;
	ctx.fillText(`${currentFPS} FPS`, GRAPH_X + PADDING, GRAPH_Y + PADDING);
	
	// Graph area
	const graphX = GRAPH_X + PADDING;
	const graphY = GRAPH_Y + PADDING + 22;
	const graphWidth = GRAPH_WIDTH - PADDING * 2;
	const graphHeight = GRAPH_HEIGHT - PADDING * 2 - 20;
	
	// Draw grid lines
	ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 1;
	
	// Horizontal lines (30, 60 FPS markers)
	const fps30Y = graphY + graphHeight * (1 - 30 / 120);
	const fps60Y = graphY + graphHeight * (1 - 60 / 120);
	
	ctx.beginPath();
	ctx.moveTo(graphX, fps30Y);
	ctx.lineTo(graphX + graphWidth, fps30Y);
	ctx.stroke();
	
	ctx.beginPath();
	ctx.moveTo(graphX, fps60Y);
	ctx.lineTo(graphX + graphWidth, fps60Y);
	ctx.stroke();
	
	// Draw FPS graph
	if (fpsHistory.length > 1) {
		ctx.strokeStyle = fpsColor;
		ctx.lineWidth = 2;
		ctx.beginPath();
		
		const maxFPS = 120;
		const stepX = graphWidth / Math.max(1, fpsHistory.length - 1);
		
		for (let i = 0; i < fpsHistory.length; i++) {
			const x = graphX + i * stepX;
			const fps = fpsHistory[i];
			const y = graphY + graphHeight * (1 - fps / maxFPS);
			
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		
		ctx.stroke();
		
		// Fill area under graph
		ctx.lineTo(graphX + (fpsHistory.length - 1) * stepX, graphY + graphHeight);
		ctx.lineTo(graphX, graphY + graphHeight);
		ctx.closePath();
		ctx.fillStyle = fpsColor + "33"; // Add transparency
		ctx.fill();
	}
	
	// Min/Max/Avg FPS text
	if (fpsHistory.length > 0) {
		const minFPS = Math.min(...fpsHistory);
		const maxFPS = Math.max(...fpsHistory);
		const avgFPS = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
		
		ctx.font = "10px monospace";
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.textAlign = "left";
		ctx.fillText(`Min: ${minFPS} | Max: ${maxFPS} | Avg: ${avgFPS}`, 
			graphX, graphY + graphHeight + 12);
	}
	
	ctx.restore();
	
	// DPS Display (below FPS graph)
	const DPS_WIDTH = GRAPH_WIDTH;
	const DPS_HEIGHT = 50;
	const DPS_X = GRAPH_X;
	const DPS_Y = GRAPH_Y - DPS_HEIGHT - 5;
	
	ctx.save();
	
	// Background
	ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	ctx.fillRect(DPS_X, DPS_Y, DPS_WIDTH, DPS_HEIGHT);
	
	// Border
	ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
	ctx.lineWidth = 1;
	ctx.strokeRect(DPS_X, DPS_Y, DPS_WIDTH, DPS_HEIGHT);
	
	// DPS Counter text
	ctx.font = "bold 18px monospace";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	
	// Color based on DPS (green for high, yellow/orange/red for lower)
	let dpsColor = "#00FF00"; // Green
	if (currentDPS < 50) {
		dpsColor = "#FF0000"; // Red
	} else if (currentDPS < 100) {
		dpsColor = "#FFAA00"; // Orange
	} else if (currentDPS < 200) {
		dpsColor = "#FFFF00"; // Yellow
	}
	
	ctx.fillStyle = dpsColor;
	ctx.fillText(`${currentDPS} DPS`, DPS_X + PADDING, DPS_Y + PADDING);
	
	// Total damage text
	ctx.font = "12px monospace";
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	ctx.fillText(`Total: ${Math.round(totalDamage)}`, DPS_X + PADDING, DPS_Y + PADDING + 20);
	
	ctx.restore();
}

// ===== UPGRADE SELECTION UI =====

function renderUpgradeIconCanvas(canvas, iconId, color) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawUpgradeIcon(ctx, iconId, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.9, color);
}

function drawUpgradeIcon(ctx, iconId, x, y, size, color) {
	const s = size;
	ctx.save();
	ctx.strokeStyle = color || "#FFD700";
	ctx.fillStyle = color || "#FFD700";
	ctx.lineWidth = Math.max(2, s * 0.08);
	
	switch (iconId) {
		case "heart": {
			const r = s * 0.25;
			ctx.beginPath();
			ctx.moveTo(x, y + r);
			ctx.bezierCurveTo(x + r * 2, y - r, x + r * 2.5, y + r * 1.5, x, y + r * 2.5);
			ctx.bezierCurveTo(x - r * 2.5, y + r * 1.5, x - r * 2, y - r, x, y + r);
			ctx.fill();
			break;
		}
		case "boot": {
			ctx.fillRect(x - s * 0.25, y - s * 0.1, s * 0.45, s * 0.35);
			ctx.fillRect(x - s * 0.45, y + s * 0.15, s * 0.7, s * 0.15);
			break;
		}
		case "bolt": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.1, y - s * 0.4);
			ctx.lineTo(x + s * 0.05, y - s * 0.1);
			ctx.lineTo(x - s * 0.05, y - s * 0.1);
			ctx.lineTo(x + s * 0.1, y + s * 0.4);
			ctx.lineTo(x - s * 0.05, y + s * 0.05);
			ctx.lineTo(x + s * 0.05, y + s * 0.05);
			ctx.closePath();
			ctx.fill();
			break;
		}
		case "regen": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.35, Math.PI * 0.2, Math.PI * 1.6);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x + s * 0.3, y - s * 0.2);
			ctx.lineTo(x + s * 0.5, y - s * 0.1);
			ctx.lineTo(x + s * 0.35, y + s * 0.05);
			ctx.fill();
			break;
		}
		case "multi": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y - s * 0.2);
			ctx.lineTo(x + s * 0.25, y - s * 0.2);
			ctx.lineTo(x, y - s * 0.45);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y);
			ctx.lineTo(x + s * 0.25, y);
			ctx.lineTo(x, y - s * 0.25);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y + s * 0.2);
			ctx.lineTo(x + s * 0.25, y + s * 0.2);
			ctx.lineTo(x, y - s * 0.05);
			ctx.closePath();
			ctx.fill();
			break;
		}
		case "crosshair": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.4, y);
			ctx.lineTo(x + s * 0.4, y);
			ctx.moveTo(x, y - s * 0.4);
			ctx.lineTo(x, y + s * 0.4);
			ctx.stroke();
			break;
		}
		case "droplet": {
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.4);
			ctx.bezierCurveTo(x + s * 0.3, y - s * 0.1, x + s * 0.25, y + s * 0.3, x, y + s * 0.4);
			ctx.bezierCurveTo(x - s * 0.25, y + s * 0.3, x - s * 0.3, y - s * 0.1, x, y - s * 0.4);
			ctx.fill();
			break;
		}
		case "magnet": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.25, Math.PI, 0);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y);
			ctx.lineTo(x - s * 0.25, y + s * 0.25);
			ctx.moveTo(x + s * 0.25, y);
			ctx.lineTo(x + s * 0.25, y + s * 0.25);
			ctx.stroke();
			break;
		}
		case "wind": {
			ctx.beginPath();
			ctx.arc(x - s * 0.1, y, s * 0.25, Math.PI * 1.2, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + s * 0.1, y + s * 0.1, s * 0.2, Math.PI * 1.2, Math.PI * 2);
			ctx.stroke();
			break;
		}
		case "headband": {
			ctx.beginPath();
			ctx.arc(x, y + s * 0.05, s * 0.35, Math.PI * 1.1, Math.PI * 1.9);
			ctx.stroke();
			break;
		}
		case "skull": {
			ctx.beginPath();
			ctx.arc(x, y - s * 0.05, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.2, y + s * 0.25);
			ctx.lineTo(x + s * 0.2, y + s * 0.25);
			ctx.stroke();
			break;
		}
		case "rage": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.3, y + s * 0.2);
			ctx.lineTo(x, y - s * 0.35);
			ctx.lineTo(x + s * 0.3, y + s * 0.2);
			ctx.closePath();
			ctx.stroke();
			break;
		}
		case "eye": {
			ctx.beginPath();
			ctx.ellipse(x, y, s * 0.35, s * 0.2, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case "flag": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y - s * 0.35);
			ctx.lineTo(x - s * 0.25, y + s * 0.35);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y - s * 0.35);
			ctx.lineTo(x + s * 0.25, y - s * 0.2);
			ctx.lineTo(x - s * 0.25, y - s * 0.05);
			ctx.fill();
			break;
		}
		case "spikes": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.35, y + s * 0.2);
			ctx.lineTo(x - s * 0.15, y - s * 0.3);
			ctx.lineTo(x, y + s * 0.15);
			ctx.lineTo(x + s * 0.15, y - s * 0.3);
			ctx.lineTo(x + s * 0.35, y + s * 0.2);
			ctx.stroke();
			break;
		}
		case "shield": {
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.35);
			ctx.lineTo(x + s * 0.25, y - s * 0.15);
			ctx.lineTo(x + s * 0.2, y + s * 0.3);
			ctx.lineTo(x - s * 0.2, y + s * 0.3);
			ctx.lineTo(x - s * 0.25, y - s * 0.15);
			ctx.closePath();
			ctx.stroke();
			break;
		}
		case "spark": {
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.35);
			ctx.lineTo(x + s * 0.1, y - s * 0.05);
			ctx.lineTo(x + s * 0.35, y);
			ctx.lineTo(x + s * 0.1, y + s * 0.05);
			ctx.lineTo(x, y + s * 0.35);
			ctx.lineTo(x - s * 0.1, y + s * 0.05);
			ctx.lineTo(x - s * 0.35, y);
			ctx.lineTo(x - s * 0.1, y - s * 0.05);
			ctx.closePath();
			ctx.stroke();
			break;
		}
		case "trail": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.3, y + s * 0.2);
			ctx.lineTo(x + s * 0.3, y - s * 0.2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.2, y + s * 0.3);
			ctx.lineTo(x + s * 0.2, y - s * 0.3);
			ctx.stroke();
			break;
		}
		case "glass": {
			ctx.strokeRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6);
			ctx.beginPath();
			ctx.moveTo(x - s * 0.2, y - s * 0.1);
			ctx.lineTo(x + s * 0.2, y + s * 0.2);
			ctx.stroke();
			break;
		}
		case "helm": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, Math.PI, 0);
			ctx.lineTo(x + s * 0.3, y + s * 0.2);
			ctx.lineTo(x - s * 0.3, y + s * 0.2);
			ctx.closePath();
			ctx.stroke();
			break;
		}
		case "skull_x": {
			ctx.beginPath();
			ctx.arc(x, y - s * 0.05, s * 0.25, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.15, y + s * 0.25);
			ctx.lineTo(x + s * 0.15, y + s * 0.35);
			ctx.stroke();
			break;
		}
		case "explosion": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.4);
			ctx.lineTo(x + s * 0.08, y - s * 0.15);
			ctx.lineTo(x + s * 0.4, y);
			ctx.lineTo(x + s * 0.08, y + s * 0.15);
			ctx.lineTo(x, y + s * 0.4);
			ctx.lineTo(x - s * 0.08, y + s * 0.15);
			ctx.lineTo(x - s * 0.4, y);
			ctx.lineTo(x - s * 0.08, y - s * 0.15);
			ctx.closePath();
			ctx.stroke();
			break;
		}
		case "phase": {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
			ctx.stroke();
			break;
		}
		case "fangs": {
			ctx.beginPath();
			ctx.moveTo(x - s * 0.2, y);
			ctx.lineTo(x - s * 0.1, y + s * 0.25);
			ctx.lineTo(x, y);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(x + s * 0.2, y);
			ctx.lineTo(x + s * 0.1, y + s * 0.25);
			ctx.lineTo(x, y);
			ctx.closePath();
			ctx.fill();
			break;
		}
		case "chain": {
			ctx.beginPath();
			ctx.arc(x - s * 0.12, y, s * 0.18, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + s * 0.12, y, s * 0.18, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.02, y - s * 0.08);
			ctx.lineTo(x + s * 0.02, y + s * 0.08);
			ctx.stroke();
			break;
		}
		// New upgrade icons
		case "sword": {
			// Sword pointing up
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.4);
			ctx.lineTo(x + s * 0.08, y + s * 0.1);
			ctx.lineTo(x - s * 0.08, y + s * 0.1);
			ctx.closePath();
			ctx.fill();
			// Handle
			ctx.fillRect(x - s * 0.05, y + s * 0.1, s * 0.1, s * 0.2);
			// Cross guard
			ctx.fillRect(x - s * 0.15, y + s * 0.08, s * 0.3, s * 0.05);
			break;
		}
		case "rapid": {
			// Three horizontal lines (speed lines)
			ctx.lineWidth = s * 0.06;
			ctx.beginPath();
			ctx.moveTo(x - s * 0.3, y - s * 0.15);
			ctx.lineTo(x + s * 0.3, y - s * 0.15);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.25, y);
			ctx.lineTo(x + s * 0.35, y);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.3, y + s * 0.15);
			ctx.lineTo(x + s * 0.3, y + s * 0.15);
			ctx.stroke();
			break;
		}
		case "crit_x": {
			// X mark with circle
			ctx.beginPath();
			ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.15, y - s * 0.15);
			ctx.lineTo(x + s * 0.15, y + s * 0.15);
			ctx.moveTo(x + s * 0.15, y - s * 0.15);
			ctx.lineTo(x - s * 0.15, y + s * 0.15);
			ctx.stroke();
			break;
		}
		case "target": {
			// Target reticle
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, y, s * 0.05, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case "scope": {
			// Sniper scope
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x - s * 0.4, y);
			ctx.lineTo(x - s * 0.15, y);
			ctx.moveTo(x + s * 0.15, y);
			ctx.lineTo(x + s * 0.4, y);
			ctx.moveTo(x, y - s * 0.4);
			ctx.lineTo(x, y - s * 0.15);
			ctx.moveTo(x, y + s * 0.15);
			ctx.lineTo(x, y + s * 0.4);
			ctx.stroke();
			break;
		}
		case "bomb": {
			// Bomb with fuse
			ctx.beginPath();
			ctx.arc(x, y + s * 0.05, s * 0.25, 0, Math.PI * 2);
			ctx.fill();
			// Fuse
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.2);
			ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.35, x + s * 0.1, y - s * 0.4);
			ctx.stroke();
			break;
		}
		case "rocket": {
			// Rocket/missile
			ctx.beginPath();
			ctx.moveTo(x, y - s * 0.35);
			ctx.lineTo(x + s * 0.12, y + s * 0.1);
			ctx.lineTo(x + s * 0.12, y + s * 0.25);
			ctx.lineTo(x, y + s * 0.15);
			ctx.lineTo(x - s * 0.12, y + s * 0.25);
			ctx.lineTo(x - s * 0.12, y + s * 0.1);
			ctx.closePath();
			ctx.fill();
			// Fins
			ctx.fillRect(x - s * 0.2, y + s * 0.1, s * 0.08, s * 0.15);
			ctx.fillRect(x + s * 0.12, y + s * 0.1, s * 0.08, s * 0.15);
			break;
		}
		case "drone": {
			// Small drone
			ctx.beginPath();
			ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
			ctx.fill();
			// Wings
			ctx.beginPath();
			ctx.ellipse(x - s * 0.25, y, s * 0.12, s * 0.05, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(x + s * 0.25, y, s * 0.12, s * 0.05, 0, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case "burst": {
			// Radial burst
			const rays = 8;
			for (let i = 0; i < rays; i++) {
				const angle = (i / rays) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(x + Math.cos(angle) * s * 0.1, y + Math.sin(angle) * s * 0.1);
				ctx.lineTo(x + Math.cos(angle) * s * 0.35, y + Math.sin(angle) * s * 0.35);
				ctx.stroke();
			}
			ctx.beginPath();
			ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case "core": {
			// Glowing core
			ctx.beginPath();
			ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			ctx.stroke();
			// Energy lines
			ctx.beginPath();
			ctx.moveTo(x - s * 0.35, y);
			ctx.lineTo(x - s * 0.22, y);
			ctx.moveTo(x + s * 0.22, y);
			ctx.lineTo(x + s * 0.35, y);
			ctx.moveTo(x, y - s * 0.35);
			ctx.lineTo(x, y - s * 0.22);
			ctx.moveTo(x, y + s * 0.22);
			ctx.lineTo(x, y + s * 0.35);
			ctx.stroke();
			break;
		}
		default: {
			ctx.strokeRect(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
			break;
		}
	}
	
	ctx.restore();
}

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
	
	// Icon
	const iconId = choice.icon || UPGRADE_ICONS[choice.id] || "generic";
	drawUpgradeIcon(ctx, iconId, x + width / 2, y + 68, 38, rarityColor);
	
	// Upgrade name
	ctx.font = "bold 20px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(choice.name, x + width / 2, y + 105);
	
	// Horizontal divider line
	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 15, y + 125);
	ctx.lineTo(x + width - 15, y + 125);
	ctx.stroke();
	
	// Stack count (using player color accent if available)
	const currentStacks = choice.currentStacks || 0;
	ctx.font = "15px Changa";
	const stackColor = playerColor ? playerColor.rgbString() : '#88CCFF';
	ctx.fillStyle = stackColor;
	ctx.fillText(`${currentStacks} → ${currentStacks + 1}`, x + width / 2, y + 145);
	
	// Description (multiline) - more compact
	ctx.font = "13px Changa";
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	const descLines = choice.description.split('\n');
	let descY = y + 165;
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

// ===== DRONE SELECTION UI =====

function paintDroneUI(ctx) {
	if (!droneChoices || droneChoices.length === 0) return;
	
	// Get player color for accent
	const playerColor = user && user.baseColor ? user.baseColor : null;
	const accentColor = playerColor ? playerColor.rgbString() : '#4ECDC4';
	const shadowAccent = user && user.shadowColor ? user.shadowColor.rgbString() : '#2E8B8E';
	
	// Dark overlay matching game style
	ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	
	// Card dimensions - wider and taller to fit content
	const cardWidth = 220;
	const cardHeight = 320;
	const cardGap = 30;
	const totalWidth = (cardWidth * 3) + (cardGap * 2);
	const startX = (canvasWidth - totalWidth) / 2;
	const startY = (canvasHeight - cardHeight) / 2 - 30;
	
	// Title banner background
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
	ctx.fillText(`NEW DRONE!`, canvasWidth / 2 - 50, bannerY + bannerHeight / 2);
	
	ctx.fillStyle = "white";
	ctx.font = "bold 24px Changa";
	ctx.fillText(`#${droneSlotIndex + 1}`, canvasWidth / 2 + 70, bannerY + bannerHeight / 2);
	ctx.restore();
	
	// Draw each card
	for (let i = 0; i < droneChoices.length; i++) {
		const choice = droneChoices[i];
		const cardX = startX + i * (cardWidth + cardGap);
		const cardY = startY;
		const isHovered = (hoveredDrone === i);
		
		drawDroneCard(ctx, choice, cardX, cardY, cardWidth, cardHeight, isHovered, i + 1);
	}
	
	// Instructions at bottom
	ctx.save();
	ctx.font = "14px Changa";
	ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("Click or press 1, 2, 3", canvasWidth / 2, startY + cardHeight + 35);
	ctx.restore();
}

function drawDroneCard(ctx, choice, x, y, width, height, isHovered, keyNum) {
	const droneColor = choice.color || '#4ECDC4';
	
	ctx.save();
	
	// Hover offset effect
	const yOffset = isHovered ? -8 : 0;
	y += yOffset;
	
	// Shadow
	ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)";
	ctx.fillRect(x + 3, y + 5 - yOffset, width, height);
	
	// Main card background
	ctx.fillStyle = isHovered ? "rgba(50, 50, 55, 0.95)" : "rgba(30, 30, 35, 0.95)";
	ctx.fillRect(x, y, width, height);
	
	// Top accent bar (drone type color)
	const barHeight = 6;
	ctx.fillStyle = droneColor;
	ctx.fillRect(x, y, width, barHeight - 2);
	ctx.fillStyle = isHovered ? droneColor : shadeColor(droneColor, -30);
	ctx.fillRect(x, y + barHeight - 2, width, 2);
	
	// Border
	ctx.strokeStyle = isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, width, height);
	
	// Key number badge
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	ctx.fillRect(x + 8, y + 14, 28, 24);
	ctx.fillStyle = isHovered ? "#FFD700" : "rgba(255, 255, 255, 0.6)";
	ctx.font = "bold 18px Changa";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(keyNum, x + 22, y + 26);
	
	// Drone icon (circle with glow)
	const iconY = y + 60;
	ctx.beginPath();
	ctx.arc(x + width / 2, iconY, 20, 0, Math.PI * 2);
	ctx.fillStyle = droneColor;
	ctx.shadowBlur = isHovered ? 15 : 8;
	ctx.shadowColor = droneColor;
	ctx.fill();
	ctx.shadowBlur = 0;
	
	// Inner circle
	ctx.beginPath();
	ctx.arc(x + width / 2, iconY, 8, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	ctx.fill();
	
	// Drone name
	ctx.font = "bold 22px Changa";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(choice.name, x + width / 2, y + 100);
	
	// Horizontal divider
	ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 15, y + 120);
	ctx.lineTo(x + width - 15, y + 120);
	ctx.stroke();
	
	// Description - wrap text to fit card
	ctx.font = "12px Changa";
	ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	const descLines = wrapText(ctx, choice.description, width - 30);
	const descStartY = y + 130;
	const descLineHeight = 16;
	for (let i = 0; i < descLines.length; i++) {
		ctx.fillText(descLines[i], x + 15, descStartY + i * descLineHeight);
	}
	
	// Stats section - starts after description
	const stats = choice.stats || {};
	const statY = y + 190;
	const statSpacing = 26;
	ctx.textBaseline = "middle";
	
	const statLabels = [
		{ label: 'Damage', value: stats.damageMult || 1.0, good: true },
		{ label: 'Fire Rate', value: 1 / (stats.cooldownMult || 1.0), good: true },
		{ label: 'Range', value: stats.rangeMult || 1.0, good: true },
		{ label: 'Proc Rate', value: stats.procCoefficient || 1.0, good: true }
	];
	
	for (let i = 0; i < statLabels.length; i++) {
		const stat = statLabels[i];
		const sy = statY + i * statSpacing;
		
		// Stat name
		ctx.font = "12px Changa";
		ctx.textAlign = "left";
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.fillText(stat.label, x + 15, sy);
		
		// Stat bar background
		const barX = x + 90;
		const barW = 70;
		const barH = 10;
		ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
		ctx.fillRect(barX, sy - 5, barW, barH);
		
		// Stat bar fill - centered at 1.0, extends left (red) or right (teal)
		// Use logarithmic scale for better visualization of extreme values
		const centerX = barX + barW / 2;
		const halfBarW = barW / 2;
		const fillColor = stat.value >= 1.0 ? '#4ECDC4' : '#FF6B6B';
		ctx.fillStyle = fillColor;
		
		if (stat.value >= 1.0) {
			// Values >= 1.0: fill from center to right
			// Use log scale: log2(value) gives us how many "doublings" from 1.0
			// Cap at 2 doublings (4x) for the full bar
			const logValue = Math.log2(Math.max(1, stat.value));
			const fillW = Math.min(halfBarW, (logValue / 2) * halfBarW);
			ctx.fillRect(centerX, sy - 5, fillW, barH);
		} else {
			// Values < 1.0: fill from center to left
			// Use inverse log scale: -log2(value) gives us how many "halvings" from 1.0
			const logValue = -Math.log2(Math.max(0.01, stat.value));
			const fillW = Math.min(halfBarW, (logValue / 2) * halfBarW);
			ctx.fillRect(centerX - fillW, sy - 5, fillW, barH);
		}
		
		// Center line marker (the "1.0" baseline)
		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.fillRect(centerX - 1, sy - 5, 2, barH);
		
		// Value text - positioned after bar
		ctx.textAlign = "left";
		const percent = Math.round((stat.value - 1) * 100);
		const prefix = percent >= 0 ? '+' : '';
		ctx.fillStyle = stat.value >= 1.0 ? '#4ECDC4' : '#FF6B6B';
		ctx.font = "bold 12px Changa";
		ctx.fillText(`${prefix}${percent}%`, barX + barW + 8, sy);
	}
	
	// Hover glow
	if (isHovered) {
		ctx.strokeStyle = droneColor;
		ctx.lineWidth = 2;
		ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
	}
	
	ctx.restore();
}

// Helper function to wrap text to fit width
function wrapText(ctx, text, maxWidth) {
	const words = text.split(' ');
	const lines = [];
	let currentLine = '';
	
	for (let word of words) {
		const testLine = currentLine ? currentLine + ' ' + word : word;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

// Check if mouse is over a drone card
function getHoveredDroneCard(mouseX, mouseY) {
	if (!droneUIVisible || !droneChoices || droneChoices.length === 0) return -1;
	
	// Must match paintDroneUI dimensions
	const cardWidth = 220;
	const cardHeight = 320;
	const cardGap = 30;
	const totalWidth = (cardWidth * 3) + (cardGap * 2);
	const startX = (canvasWidth - totalWidth) / 2;
	const startY = (canvasHeight - cardHeight) / 2 - 30;
	
	for (let i = 0; i < droneChoices.length; i++) {
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

	// Zoom based on player size (scales with level)
	ctx.scale(zoom, zoom);
	ctx.translate(-offset[0] + consts.BORDER_WIDTH, -offset[1] + consts.BORDER_WIDTH);

	// Update view offset for mouse position calculation
	client.setViewOffset(offset[0] - consts.BORDER_WIDTH, offset[1] - consts.BORDER_WIDTH);

	paintGridBackground(ctx);

	// Singleplayer: only render the local player
	const allPlayers = user ? [user] : [];
	
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
	const t = Date.now() / 1000;
	const stats = client.getEnemyStats();
	const runTime = stats && stats.runTime != null ? stats.runTime : 0;
	const boostOrbLifetime = consts.BOOST_ORB_LIFETIME_SEC ?? 15;
	const boostOrbBlinkTime = consts.BOOST_ORB_BLINK_TIME ?? 3;
	for (const coin of coins) {
		if (coin.type === "boss") {
			// Boss XP orb - large sparkling golden orb
			const baseRadius = consts.COIN_RADIUS * 2.2;
			const pulse = 0.85 + 0.15 * Math.sin(t * 3 + (coin.id || 0));
			const orbRadius = baseRadius * pulse;
			
			// Outer glow
			const glowRadius = orbRadius * 2.2;
			const glow = ctx.createRadialGradient(
				coin.x, coin.y, 0,
				coin.x, coin.y, glowRadius
			);
			glow.addColorStop(0, "rgba(255, 255, 255, 0.7)");
			glow.addColorStop(0.25, "rgba(255, 230, 140, 0.45)");
			glow.addColorStop(0.6, "rgba(255, 170, 60, 0.18)");
			glow.addColorStop(1, "rgba(255, 170, 60, 0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, glowRadius, 0, Math.PI * 2);
			ctx.fill();
			
			// Core
			ctx.fillStyle = "rgba(255, 250, 200, 0.95)";
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, orbRadius * 0.55, 0, Math.PI * 2);
			ctx.fill();
			
			// Sparkles
			const sparkleCount = 6;
			for (let i = 0; i < sparkleCount; i++) {
				const angle = t * 2 + i * (Math.PI * 2 / sparkleCount) + (coin.id || 0) * 0.15;
				const dist = orbRadius * (1.2 + 0.25 * Math.sin(t * 4 + i));
				const sx = coin.x + Math.cos(angle) * dist;
				const sy = coin.y + Math.sin(angle) * dist;
				const sparkleSize = 2.5 + 1.5 * Math.sin(t * 5 + i);
				const sparkleAlpha = 0.5 + 0.4 * Math.sin(t * 6 + i);
				ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
				ctx.beginPath();
				ctx.arc(sx, sy, Math.max(1, sparkleSize), 0, Math.PI * 2);
				ctx.fill();
			}
		} else if (coin.type === "enemy") {
			// Enemy XP orb - Blue to Gold color fade loop with feathered edges
			const orbRadius = consts.COIN_RADIUS * 1.2;
			
			// Color fade: blue <-> gold (or purple <-> blue for double drops)
			// Use coin position + time for unique phase per orb
			// Much slower fade: 6 seconds per cycle
			const phase = (Date.now() / 6000 + coin.x * 0.01 + coin.y * 0.01) % 1;
			const fadeT = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2); // 0 to 1, smooth
			
			// Interpolate colors
			let startR = 120, startG = 180, startB = 255;
			let endR = 255, endG = 215, endB = 0;
			if (coin.isDoubleDrop) {
				startR = 150; startG = 80; startB = 255;  // Purple
				endR = 80;   endG = 180; endB = 255;  // Blue
			}
			const r = Math.round(startR + (endR - startR) * fadeT);
			const g = Math.round(startG + (endG - startG) * fadeT);
			const b = Math.round(startB + (endB - startB) * fadeT);
			
			// Brighter core colors
			const coreR = Math.min(255, r + 50);
			const coreG = Math.min(255, g + 40);
			const coreB = Math.min(255, b + 40);
			
			// Create radial gradient for feathered edge
			const gradient = ctx.createRadialGradient(
				coin.x, coin.y, 0,
				coin.x, coin.y, orbRadius
			);
			
			// Gradient stops: lower opacity, feathered edge
			gradient.addColorStop(0, `rgba(255, 255, 255, 0.4)`);
			gradient.addColorStop(0.15, `rgba(${coreR}, ${coreG}, ${coreB}, 0.35)`);
			gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.28)`);
			gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.12)`);
			gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
			
			// Draw feathered orb
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, orbRadius, 0, Math.PI * 2);
			ctx.fill();
		} else if (coin.type === "stamina" || coin.type === "heal") {
			// Stamina/Heal boost orb - yellow with plus sign and sparkles
			const isHeal = coin.type === "heal";
			const baseRadius = consts.COIN_RADIUS * 1.4;
			const timeRemaining = (coin.spawnTime != null)
				? boostOrbLifetime - (runTime - coin.spawnTime)
				: null;
			const isBlinking = timeRemaining != null && timeRemaining <= boostOrbBlinkTime;
			const blinkPulse = isBlinking ? (0.5 + 0.5 * Math.sin(t * 10 + (coin.id || 0) * 0.7)) : 1;
			const pulse = (0.9 + 0.1 * Math.sin(t * 4 + (coin.id || 0) * 0.5))
				* (isBlinking ? (0.85 + 0.2 * Math.abs(blinkPulse)) : 1);
			const orbRadius = baseRadius * pulse;
			
			ctx.save();
			if (isBlinking) {
				ctx.globalAlpha *= 0.35 + 0.65 * Math.abs(blinkPulse);
			}
			
			// Color: yellow for stamina, green-tinted for heal
			const mainColor = isHeal ? "rgba(100, 255, 150, 0.9)" : "rgba(255, 230, 80, 0.95)";
			const glowColor = isHeal ? "rgba(80, 255, 120, 0.5)" : "rgba(255, 215, 0, 0.6)";
			const coreColor = isHeal ? "rgba(180, 255, 200, 0.95)" : "rgba(255, 255, 200, 0.95)";
			
			// Outer glow
			const glowRadius = orbRadius * 2.5;
			const glow = ctx.createRadialGradient(
				coin.x, coin.y, 0,
				coin.x, coin.y, glowRadius
			);
			glow.addColorStop(0, coreColor);
			glow.addColorStop(0.3, glowColor);
			glow.addColorStop(0.6, isHeal ? "rgba(80, 255, 120, 0.15)" : "rgba(255, 215, 0, 0.15)");
			glow.addColorStop(1, "rgba(255, 255, 0, 0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, glowRadius, 0, Math.PI * 2);
			ctx.fill();
			
			// Main orb body
			ctx.fillStyle = mainColor;
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, orbRadius, 0, Math.PI * 2);
			ctx.fill();
			
			// Inner bright core
			ctx.fillStyle = coreColor;
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, orbRadius * 0.5, 0, Math.PI * 2);
			ctx.fill();
			
			// Plus sign
			const plusSize = orbRadius * 0.6;
			const plusThickness = orbRadius * 0.25;
			ctx.fillStyle = isHeal ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.9)";
			// Horizontal bar
			ctx.fillRect(coin.x - plusSize, coin.y - plusThickness / 2, plusSize * 2, plusThickness);
			// Vertical bar
			ctx.fillRect(coin.x - plusThickness / 2, coin.y - plusSize, plusThickness, plusSize * 2);
			
			// Sparkles orbiting around
			const sparkleCount = 4;
			for (let i = 0; i < sparkleCount; i++) {
				const angle = t * 3 + i * (Math.PI * 2 / sparkleCount) + (coin.id || 0) * 0.3;
				const dist = orbRadius * (1.4 + 0.2 * Math.sin(t * 5 + i));
				const sx = coin.x + Math.cos(angle) * dist;
				const sy = coin.y + Math.sin(angle) * dist;
				const sparkleSize = 2 + 1.5 * Math.sin(t * 6 + i);
				const sparkleAlpha = 0.6 + 0.3 * Math.sin(t * 7 + i);
				ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
				ctx.beginPath();
				ctx.arc(sx, sy, Math.max(1, sparkleSize), 0, Math.PI * 2);
				ctx.fill();
			}
			
			ctx.restore();
		} else {
			// Default gold coin (legacy fallback)
			ctx.fillStyle = "#FFD700";
			ctx.shadowBlur = 5;
			ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, consts.COIN_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.shadowBlur = 0;
		}
	}
	ctx.shadowBlur = 0;
	
	// Render animated loot coins
	renderLootCoins(ctx);
	
	// ===== LAYER 2.5: HEAL PACKS (Support drone passive) =====
	renderHealPacks(ctx);
	
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
		
		// Render Overcharge Core aura (red pulsing drain effect)
		if (p.derivedStats && p.derivedStats.hasOverchargeCore) {
			renderOverchargeAura(ctx, p);
		}
		
		// Render Heatseeker Drones (mini orbiting drones)
		if (p.derivedStats && p.derivedStats.hasHeatseekerDrones) {
			renderHeatseekerDrones(ctx, p);
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
	
	// ===== LAYER 7.5: PROJECTILES (above HP bars, below effects) =====
	renderProjectiles(ctx);
	
	// ===== LAYER 8: EFFECTS (top layers) =====
	// Render capture effects (pulse rings, particles, coins text)
	renderCaptureEffects(ctx);
	
	// Render death particles
	renderDeathParticles(ctx);
	
	// Render hitscan laser effects (only for actual hitscan weapons like laser/pulse)
	renderHitscanEffects(ctx);
	
	// Render projectile impact effects
	renderImpactEffects(ctx);
	
	// Render new upgrade effects (missiles, sticky charges, arc barrage)
	renderNewUpgradeEffects(ctx);
	
	// Render floating damage numbers
	renderDamageNumbers(ctx);

	// Reset transform for fixed UI
	ctx.restore();
	paintUIBar(ctx);
	paintBottomHPBar(ctx);
	paintBottomXPBar(ctx);
	paintPlayerStats(ctx);
	paintDebugOverlay(ctx);
	paintFPSDisplay(ctx);
	
	// Render upgrade selection UI if visible
	if (upgradeUIVisible) {
		paintUpgradeUI(ctx);
	}
	
	// Render drone selection UI if visible
	if (droneUIVisible) {
		paintDroneUI(ctx);
	}
	
	// Boss spawn announcement
	if (gameMessageText && Date.now() < gameMessageUntil) {
		const now = Date.now();
		const durationMs = Math.max(1, gameMessageUntil - gameMessageStart);
		const elapsed = now - gameMessageStart;
		const t = Math.min(1, Math.max(0, elapsed / durationMs));
		const fadeIn = Math.min(1, elapsed / 250);
		const fadeOut = Math.min(1, (gameMessageUntil - now) / 450);
		const alpha = Math.min(fadeIn, fadeOut);
		const popScale = 1 + 0.18 * Math.exp(-t * 6);
		const floatY = -6 * Math.sin(t * Math.PI);
		
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(canvasWidth / 2, BAR_HEIGHT + 40 + floatY);
		ctx.scale(popScale, popScale);
		
		// Backplate banner
		ctx.font = "bold 36px Changa";
		const bannerWidth = ctx.measureText(gameMessageText).width + 80;
		const bannerHeight = 46;
		ctx.fillStyle = "rgba(10, 10, 15, 0.7)";
		ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.roundRect(-bannerWidth / 2, -bannerHeight / 2, bannerWidth, bannerHeight, 10);
		ctx.fill();
		ctx.stroke();
		
		// Glow pulse
		ctx.shadowBlur = 18 + 8 * Math.sin(t * Math.PI);
		ctx.shadowColor = "rgba(255, 215, 0, 0.85)";
		
		// Text with outline
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#FFD700";
		ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
		ctx.lineWidth = 4;
		ctx.strokeText(gameMessageText, 0, 1);
		ctx.fillText(gameMessageText, 0, 0);
		ctx.restore();
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
	// Track FPS
	const now = performance.now();
	const deltaTime = now - lastFrameTime;
	if (deltaTime > 0) {
		currentFPS = Math.round(1000 / deltaTime);
		// Clamp FPS to reasonable range (0-120)
		currentFPS = Math.max(0, Math.min(120, currentFPS));
		
		// Add to history
		fpsHistory.push(currentFPS);
		if (fpsHistory.length > MAX_FPS_HISTORY) {
			fpsHistory.shift(); // Remove oldest entry
		}
	}
	lastFrameTime = now;
	
	paint(offctx);
	ctx.drawImage(offscreenCanvas, 0, 0);
}

function update() {
	updateSize();
	trackPlayerDamage();
	flushDamageNumberBuckets();
	flushHealNumberBuckets();
	
	// Update death animation effects
	updateDeathEffects();
	
	// Update speed buff and sound effects for local player
	updateSpeedBuffSound();
	
	// Refresh upgrades list when settings are open
	if (settingsOpen) {
		updateSettingsUpgradesList();
	}
	
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

	// Calculate player portion based on territory area (singleplayer)
	const mapArea = consts.GRID_COUNT * consts.CELL_WIDTH * consts.GRID_COUNT * consts.CELL_WIDTH;
	if (user) {
		const area = client.polygonArea(user.territory);
		playerPortion[user.num] = area;
		
		const roll = portionsRolling[user.num];
		if (roll) {
			roll.value = area / mapArea;
			roll.update();
		}
	}

	// Zoom based on player size (zoom out slightly as player grows)
	// Zoom scales at a fraction of the player size increase rate
	if (user) {
		const sizeScale = user.sizeScale || 1.0;
		const maxSizeScale = consts.PLAYER_SIZE_SCALE_MAX || 2.0;
		// Clamp sizeScale to max (stop zooming at max size)
		const clampedScale = Math.min(Math.max(sizeScale, 1.0), maxSizeScale);
		// Effective scale for zoom is 20% of the player's size increase
		// e.g., if player is 60% bigger (1.6x), zoom as if 12% bigger (1.12x) -> zoom ~0.89
		const zoomRate = consts.ZOOM_SCALE_RATE || 0.2;
		const effectiveScale = 1 + (clampedScale - 1) * zoomRate;
		const targetZoom = 1 / effectiveScale;
		// Smooth interpolation (but hard-clamp once max size is reached)
		if (sizeScale >= maxSizeScale) {
			zoom = targetZoom;
		} else {
			zoom = zoom + (targetZoom - zoom) * 0.05;
		}
		zoom = Math.max(0.5, Math.min(1, zoom));
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

// Render heal packs dropped by Support drone
function renderHealPacks(ctx) {
	const healPacks = client.getHealPacks();
	
	for (const pack of healPacks) {
		const x = pack.x;
		const y = pack.y;
		const size = 12;
		
		// Blinking effect when about to expire
		if (pack.isBlinking) {
			const blinkPhase = Math.sin(Date.now() / 100) * 0.5 + 0.5;
			if (blinkPhase < 0.3) continue; // Skip rendering during blink-off phase
		}
		
		// Pulsing glow effect
		const pulsePhase = Math.sin(Date.now() / 300) * 0.2 + 0.8;
		
		ctx.save();
		
		// Outer glow
		ctx.shadowColor = '#2ECC71';
		ctx.shadowBlur = 15 * pulsePhase;
		
		// White/green cross shape
		ctx.fillStyle = '#FFFFFF';
		
		// Draw cross (plus sign)
		const armWidth = size * 0.35;
		const armLength = size;
		
		// Horizontal arm
		ctx.fillRect(x - armLength, y - armWidth / 2, armLength * 2, armWidth);
		// Vertical arm
		ctx.fillRect(x - armWidth / 2, y - armLength, armWidth, armLength * 2);
		
		// Green outline for the cross
		ctx.strokeStyle = '#2ECC71';
		ctx.lineWidth = 2;
		
		// Draw cross outline path
		ctx.beginPath();
		// Top-left of vertical arm
		ctx.moveTo(x - armWidth / 2, y - armLength);
		ctx.lineTo(x + armWidth / 2, y - armLength);
		ctx.lineTo(x + armWidth / 2, y - armWidth / 2);
		ctx.lineTo(x + armLength, y - armWidth / 2);
		ctx.lineTo(x + armLength, y + armWidth / 2);
		ctx.lineTo(x + armWidth / 2, y + armWidth / 2);
		ctx.lineTo(x + armWidth / 2, y + armLength);
		ctx.lineTo(x - armWidth / 2, y + armLength);
		ctx.lineTo(x - armWidth / 2, y + armWidth / 2);
		ctx.lineTo(x - armLength, y + armWidth / 2);
		ctx.lineTo(x - armLength, y - armWidth / 2);
		ctx.lineTo(x - armWidth / 2, y - armWidth / 2);
		ctx.closePath();
		ctx.stroke();
		
		// Small heal amount text above
		ctx.shadowBlur = 0;
		ctx.fillStyle = '#2ECC71';
		ctx.font = 'bold 10px Changa';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'bottom';
		ctx.fillText(`+${Math.floor(pack.healAmount)}`, x, y - armLength - 4);
		
		ctx.restore();
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
	
	// Divider lines every 25 HP (at 25, 50, 75, 100, etc.)
	const hpPerChunk = 25;
	const maxHp = player.maxHp || 100;
	const numDividers = Math.floor(maxHp / hpPerChunk); // Number of 25 HP marks within maxHp
	
	ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
	ctx.lineWidth = Math.max(1, 1.5 * sizeScale);
	for (let i = 1; i <= numDividers; i++) {
		const chunkHp = i * hpPerChunk;
		// Only draw if the divider is within the bar (not at the very end)
		if (chunkHp < maxHp) {
			const divX = barX + (barWidth * chunkHp / maxHp);
			ctx.beginPath();
			ctx.moveTo(divX, barY);
			ctx.lineTo(divX, barY + barHeight);
			ctx.stroke();
		}
	}
	
	// Black outline (slightly thicker for local player)
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = Math.max(1, (isLocalPlayer ? 2.5 : 2) * sizeScale);
	ctx.strokeRect(barX, barY, barWidth, barHeight);
	
	// === STAMINA BAR (only for local player, below HP bar) ===
	if (isLocalPlayer && player.stamina !== undefined) {
		const staminaBarHeight = 4 * sizeScale * sizeMult;
		const staminaBarY = barY + barHeight + 2; // 2px gap below HP bar
		const staminaRatio = Math.max(0, Math.min(1, player.stamina / (player.maxStamina || 100)));
		
		// Background
		ctx.fillStyle = "rgba(10, 10, 10, 0.9)";
		ctx.fillRect(barX, staminaBarY, barWidth, staminaBarHeight);
		
		// Stamina fill (gold when good, orange when low, red when critical)
		if (staminaRatio > 0.3) {
			ctx.fillStyle = "#FFD700"; // Gold
		} else if (staminaRatio > 0.15) {
			ctx.fillStyle = "#FFA500"; // Orange
		} else {
			ctx.fillStyle = "#FF4500"; // Red-orange
		}
		ctx.fillRect(barX, staminaBarY, barWidth * staminaRatio, staminaBarHeight);
		
		// Outline
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = Math.max(1, 1.5 * sizeScale);
		ctx.strokeRect(barX, staminaBarY, barWidth, staminaBarHeight);
	}
}

// ===== HITSCAN/PROJECTILE EFFECTS =====

// Cap active effects so big drone fights don't tank FPS.
const MAX_HITSCAN_EFFECTS = 120;

// Attack type durations (ms)
const ATTACK_DURATIONS = {
	bullet: 120,
	laser: 80,
	laser_aim: 120,
	heal_link: 180,
	railgun: 300,
	plasma: 180,
	pulse: 200,
	flame: 140,
	burn: 140
};

// Parse hex color once and cache RGB values
function parseHexColor(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (result) {
		return {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		};
	}
	return { r: 255, g: 100, b: 100 }; // Fallback red
}

class HitscanEffect {
	constructor(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor, isChain = false) {
		this.fromX = fromX;
		this.fromY = fromY;
		this.toX = toX;
		this.toY = toY;
		this.ownerId = ownerId;
		this.damage = damage;
		this.attackType = attackType || 'bullet';
		this.isChain = isChain; // Chain lightning effect
		this.spawnTime = Date.now();
		this.duration = isChain ? 400 : (ATTACK_DURATIONS[this.attackType] || 150); // Chain lightning lasts longer
		this.life = 1;
		
		// Pre-parse color once in constructor
		const rgb = parseHexColor(typeColor || '#FF6B6B');
		this.r = rgb.r;
		this.g = rgb.g;
		this.b = rgb.b;
		
		// Pre-calculate for rendering
		this.angle = Math.atan2(toY - fromY, toX - fromX);
		this.distance = Math.hypot(toX - fromX, toY - fromY);
		
		// Generate lightning bolt segments for chain lightning
		if (isChain) {
			this.lightningSegments = this.generateLightningPath();
		}
	}
	
	// Generate a jagged lightning bolt path
	generateLightningPath() {
		const segments = [];
		const numSegments = Math.max(5, Math.floor(this.distance / 25));
		
		let prevX = this.fromX;
		let prevY = this.fromY;
		
		for (let i = 1; i <= numSegments; i++) {
			const t = i / numSegments;
			// Base position along the line
			let x = this.fromX + (this.toX - this.fromX) * t;
			let y = this.fromY + (this.toY - this.fromY) * t;
			
			// Add perpendicular jitter (except for endpoints)
			if (i < numSegments) {
				const perpX = -Math.sin(this.angle);
				const perpY = Math.cos(this.angle);
				const jitter = (Math.random() - 0.5) * 30; // Random offset
				x += perpX * jitter;
				y += perpY * jitter;
			}
			
			segments.push({ fromX: prevX, fromY: prevY, toX: x, toY: y });
			prevX = x;
			prevY = y;
		}
		
		return segments;
	}
	
	// Helper to get rgba string without parsing
	rgba(alpha) {
		return `rgba(${this.r},${this.g},${this.b},${alpha})`;
	}
	
	// Lighter version of color
	rgbaLight(alpha) {
		const r = Math.min(255, this.r + 60);
		const g = Math.min(255, this.g + 60);
		const b = Math.min(255, this.b + 60);
		return `rgba(${r},${g},${b},${alpha})`;
	}
	
	update() {
		const elapsed = Date.now() - this.spawnTime;
		this.life = 1 - (elapsed / this.duration);
		return this.life > 0;
	}
	
	render(ctx) {
		if (this.life <= 0) return;
		
		ctx.save();
		ctx.lineCap = 'round';
		
		// Chain lightning uses special rendering
		if (this.isChain) {
			this.renderChainLightning(ctx);
			ctx.restore();
			return;
		}
		
		switch (this.attackType) {
			case 'laser':
				this.renderLaser(ctx);
				break;
			case 'laser_aim':
				this.renderLaserAim(ctx);
				break;
			case 'heal_link':
				this.renderHealLink(ctx);
				break;
			case 'railgun':
				this.renderRailgun(ctx);
				break;
			case 'plasma':
				this.renderPlasma(ctx);
				break;
			case 'pulse':
				this.renderPulse(ctx);
				break;
			case 'bullet':
			default:
				this.renderBullet(ctx);
				break;
		}
		
		ctx.restore();
	}
	
	// CHAIN LIGHTNING - Animated electric bolt
	renderChainLightning(ctx) {
		if (!this.lightningSegments) return;
		
		const progress = 1 - this.life;
		
		// Animate the bolt traveling along the path
		const travelProgress = Math.min(1, progress * 3); // Fast travel
		const fadeStart = 0.4;
		const alpha = progress > fadeStart ? 1 - ((progress - fadeStart) / (1 - fadeStart)) : 1;
		
		// Flickering effect
		const flicker = 0.7 + 0.3 * Math.sin(Date.now() / 30 + Math.random() * 0.5);
		const effectAlpha = alpha * flicker;
		
		// Number of segments to draw based on travel progress
		const segmentsToDraw = Math.ceil(this.lightningSegments.length * travelProgress);
		
		// Outer electric glow
		ctx.shadowBlur = 25;
		ctx.shadowColor = `rgba(${this.r}, ${this.g}, ${this.b}, ${effectAlpha * 0.9})`;
		
		// Draw main bolt with thick glow
		ctx.strokeStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${effectAlpha * 0.6})`;
		ctx.lineWidth = 8 * this.life;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		for (let i = 0; i < segmentsToDraw; i++) {
			const seg = this.lightningSegments[i];
			if (i === 0) {
				ctx.moveTo(seg.fromX, seg.fromY);
			}
			ctx.lineTo(seg.toX, seg.toY);
		}
		ctx.stroke();
		
		// Middle layer - brighter
		ctx.strokeStyle = `rgba(${Math.min(255, this.r + 80)}, ${Math.min(255, this.g + 80)}, ${Math.min(255, this.b + 80)}, ${effectAlpha * 0.8})`;
		ctx.lineWidth = 4 * this.life;
		ctx.stroke();
		
		// Core - white hot center
		ctx.strokeStyle = `rgba(255, 255, 255, ${effectAlpha * 0.95})`;
		ctx.lineWidth = 2 * this.life;
		ctx.stroke();
		
		// Draw small branches/forks randomly
		if (Math.random() > 0.7) {
			const branchIdx = Math.floor(Math.random() * Math.min(segmentsToDraw, this.lightningSegments.length));
			if (branchIdx < this.lightningSegments.length) {
				const seg = this.lightningSegments[branchIdx];
				const branchAngle = this.angle + (Math.random() - 0.5) * Math.PI * 0.8;
				const branchLen = 15 + Math.random() * 20;
				const branchEndX = seg.toX + Math.cos(branchAngle) * branchLen;
				const branchEndY = seg.toY + Math.sin(branchAngle) * branchLen;
				
				ctx.strokeStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${effectAlpha * 0.5})`;
				ctx.lineWidth = 2 * this.life;
				ctx.beginPath();
				ctx.moveTo(seg.toX, seg.toY);
				ctx.lineTo(branchEndX, branchEndY);
				ctx.stroke();
			}
		}
		
		ctx.shadowBlur = 0;
		
		// Impact spark at the end
		if (travelProgress >= 0.8) {
			const sparkAlpha = effectAlpha * (1 - (travelProgress - 0.8) / 0.2);
			const sparkSize = 15 * this.life;
			
			// Electric sparks around impact point
			ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha})`;
			ctx.beginPath();
			ctx.arc(this.toX, this.toY, sparkSize * 0.5, 0, Math.PI * 2);
			ctx.fill();
			
			// Outer glow
			ctx.fillStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${sparkAlpha * 0.6})`;
			ctx.beginPath();
			ctx.arc(this.toX, this.toY, sparkSize, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	
	// BULLET - Visible moving projectile with trail
	renderBullet(ctx) {
		const progress = 1 - this.life;
		// Slower animation - bullet travels across duration
		const bulletPos = Math.min(1, progress * 1.2);
		const bulletX = this.fromX + (this.toX - this.fromX) * bulletPos;
		const bulletY = this.fromY + (this.toY - this.fromY) * bulletPos;
		
		// Longer trail for visibility
		const trailLength = Math.min(40, this.distance * 0.35);
		const trailStartX = bulletX - Math.cos(this.angle) * trailLength;
		const trailStartY = bulletY - Math.sin(this.angle) * trailLength;
		
		// Outer glow
		ctx.shadowBlur = 12;
		ctx.shadowColor = this.rgba(0.8);
		
		// Trail glow (thicker)
		ctx.strokeStyle = this.rgba(0.6 * this.life);
		ctx.lineWidth = 10 * this.life;
		ctx.beginPath();
		ctx.moveTo(trailStartX, trailStartY);
		ctx.lineTo(bulletX, bulletY);
		ctx.stroke();
		
		// Core trail
		ctx.strokeStyle = this.rgbaLight(0.9 * this.life);
		ctx.lineWidth = 5 * this.life;
		ctx.stroke();
		
		// Bright center
		ctx.strokeStyle = `rgba(255,255,255,${0.9 * this.life})`;
		ctx.lineWidth = 2 * this.life;
		ctx.stroke();
		
		// Bullet head (larger, glowing)
		ctx.fillStyle = `rgba(255,255,255,${this.life})`;
		ctx.beginPath();
		ctx.arc(bulletX, bulletY, 6 * this.life, 0, Math.PI * 2);
		ctx.fill();
		
		// Colored ring around head
		ctx.strokeStyle = this.rgba(this.life);
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(bulletX, bulletY, 8 * this.life, 0, Math.PI * 2);
		ctx.stroke();
		
		ctx.shadowBlur = 0;
		
		// Impact
		if (bulletPos >= 0.9) {
			this.renderImpactSimple(ctx, 18);
		}
	}
	
	// LASER - Thin, fast beam
	renderLaser(ctx) {
		// Glow
		ctx.strokeStyle = this.rgba(0.4 * this.life);
		ctx.lineWidth = 6 * this.life;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(this.toX, this.toY);
		ctx.stroke();
		
		// Core
		ctx.strokeStyle = this.rgbaLight(0.9 * this.life);
		ctx.lineWidth = 2 * this.life;
		ctx.stroke();
		
		// Center
		ctx.strokeStyle = `rgba(255,255,255,${this.life})`;
		ctx.lineWidth = 1;
		ctx.stroke();
		
		this.renderImpactSimple(ctx, 8);
	}
	
	// LASER AIM - Low-opacity aiming line
	renderLaserAim(ctx) {
		const alpha = 0.18 + (0.12 * this.life);
		ctx.strokeStyle = this.rgba(alpha);
		ctx.lineWidth = 3 * this.life;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(this.toX, this.toY);
		ctx.stroke();
	}
	
	// HEAL LINK - Curvy sparkly line
	renderHealLink(ctx) {
		const progress = 1 - this.life;
		const alpha = 0.25 * (1 - progress);
		const midX = (this.fromX + this.toX) * 0.5;
		const midY = (this.fromY + this.toY) * 0.5;
		const wobble = 18 * Math.sin(Date.now() / 120 + this.fromX * 0.01);
		const perpX = -Math.sin(this.angle);
		const perpY = Math.cos(this.angle);
		const ctrlX = midX + perpX * wobble;
		const ctrlY = midY + perpY * wobble;
		
		ctx.strokeStyle = this.rgba(alpha);
		ctx.lineWidth = 2.5 * this.life;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.quadraticCurveTo(ctrlX, ctrlY, this.toX, this.toY);
		ctx.stroke();
		
		// Sparkles along the curve
		for (let i = 0; i < 3; i++) {
			const t = (i + 1) / 4 + 0.1 * Math.sin(Date.now() / 90 + i);
			const bx = (1 - t) * (1 - t) * this.fromX + 2 * (1 - t) * t * ctrlX + t * t * this.toX;
			const by = (1 - t) * (1 - t) * this.fromY + 2 * (1 - t) * t * ctrlY + t * t * this.toY;
			ctx.fillStyle = `rgba(255,255,255,${alpha})`;
			ctx.beginPath();
			ctx.arc(bx, by, 2 * this.life, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	
	// RAILGUN - Thick traveling beam
	renderRailgun(ctx) {
		const progress = 1 - this.life;
		// Slower travel for railgun
		const beamPos = Math.min(1, progress * 1.5);
		const beamEndX = this.fromX + (this.toX - this.fromX) * beamPos;
		const beamEndY = this.fromY + (this.toY - this.fromY) * beamPos;
		
		// Calculate trail start (beam has length)
		const beamLength = Math.min(60, this.distance * 0.4);
		const beamStartProgress = Math.max(0, beamPos - beamLength / this.distance);
		const beamStartX = this.fromX + (this.toX - this.fromX) * beamStartProgress;
		const beamStartY = this.fromY + (this.toY - this.fromY) * beamStartProgress;
		
		// Outer glow
		ctx.shadowBlur = 20;
		ctx.shadowColor = this.rgba(0.9);
		
		// Wide glow
		ctx.strokeStyle = this.rgba(0.5 * this.life);
		ctx.lineWidth = 20 * this.life;
		ctx.beginPath();
		ctx.moveTo(beamStartX, beamStartY);
		ctx.lineTo(beamEndX, beamEndY);
		ctx.stroke();
		
		// Middle
		ctx.strokeStyle = this.rgba(0.8 * this.life);
		ctx.lineWidth = 10 * this.life;
		ctx.stroke();
		
		// Core
		ctx.strokeStyle = this.rgbaLight(0.95 * this.life);
		ctx.lineWidth = 5 * this.life;
		ctx.stroke();
		
		// White center
		ctx.strokeStyle = `rgba(255,255,255,${0.9 * this.life})`;
		ctx.lineWidth = 2;
		ctx.stroke();
		
		ctx.shadowBlur = 0;
		
		// Impact at head
		if (beamPos >= 0.85) {
			this.renderImpactSimple(ctx, 25);
		}
	}
	
	// PLASMA - Large slow energy ball
	renderPlasma(ctx) {
		const progress = 1 - this.life;
		// Slower travel for plasma
		const ballPos = Math.min(1, progress * 1.1);
		const ballX = this.fromX + (this.toX - this.fromX) * ballPos;
		const ballY = this.fromY + (this.toY - this.fromY) * ballPos;
		
		// Outer glow
		ctx.shadowBlur = 25;
		ctx.shadowColor = this.rgba(0.9);
		
		// Glowing trail
		ctx.strokeStyle = this.rgba(0.4 * this.life);
		ctx.lineWidth = 14 * this.life;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(ballX, ballY);
		ctx.stroke();
		
		// Pulsing effect
		const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 50);
		
		// Large ball outer glow
		ctx.fillStyle = this.rgba(0.5 * this.life);
		ctx.beginPath();
		ctx.arc(ballX, ballY, 20 * this.life * pulse, 0, Math.PI * 2);
		ctx.fill();
		
		// Ball main body
		ctx.fillStyle = this.rgba(0.8 * this.life);
		ctx.beginPath();
		ctx.arc(ballX, ballY, 14 * this.life, 0, Math.PI * 2);
		ctx.fill();
		
		// Ball core
		ctx.fillStyle = this.rgbaLight(0.95 * this.life);
		ctx.beginPath();
		ctx.arc(ballX, ballY, 8 * this.life, 0, Math.PI * 2);
		ctx.fill();
		
		// Bright center
		ctx.fillStyle = `rgba(255,255,255,${0.95 * this.life})`;
		ctx.beginPath();
		ctx.arc(ballX, ballY, 4 * this.life, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.shadowBlur = 0;
		
		if (ballPos >= 0.85) {
			this.renderImpactSimple(ctx, 30);
		}
	}
	
	// PULSE - Expanding ring
	renderPulse(ctx) {
		const progress = 1 - this.life;
		const wavePos = Math.min(1, progress * 2);
		const waveX = this.fromX + (this.toX - this.fromX) * wavePos;
		const waveY = this.fromY + (this.toY - this.fromY) * wavePos;
		const ringRadius = 5 + 12 * wavePos;
		
		// Ring
		ctx.strokeStyle = this.rgba(0.7 * this.life);
		ctx.lineWidth = 3 * this.life;
		ctx.beginPath();
		ctx.arc(waveX, waveY, ringRadius, 0, Math.PI * 2);
		ctx.stroke();
		
		// Inner
		ctx.strokeStyle = `rgba(255,255,255,${0.5 * this.life})`;
		ctx.lineWidth = 1.5 * this.life;
		ctx.beginPath();
		ctx.arc(waveX, waveY, ringRadius * 0.5, 0, Math.PI * 2);
		ctx.stroke();
		
		// Connection
		ctx.strokeStyle = this.rgba(0.3 * this.life);
		ctx.lineWidth = 2 * this.life;
		ctx.beginPath();
		ctx.moveTo(this.fromX, this.fromY);
		ctx.lineTo(waveX, waveY);
		ctx.stroke();
		
		if (wavePos >= 0.9) {
			this.renderImpactSimple(ctx, 15);
		}
	}
	
	// Simple impact without gradient (faster)
	renderImpactSimple(ctx, size) {
		const s = size * this.life;
		// Outer glow
		ctx.fillStyle = this.rgba(0.4 * this.life);
		ctx.beginPath();
		ctx.arc(this.toX, this.toY, s, 0, Math.PI * 2);
		ctx.fill();
		// Inner bright
		ctx.fillStyle = `rgba(255,255,255,${0.7 * this.life})`;
		ctx.beginPath();
		ctx.arc(this.toX, this.toY, s * 0.4, 0, Math.PI * 2);
		ctx.fill();
	}
}

function spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor, isChain = false) {
	hitscanEffects.push(new HitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor, isChain));

	// Hard cap (drop oldest) to prevent unbounded growth during large fights.
	if (hitscanEffects.length > MAX_HITSCAN_EFFECTS) {
		hitscanEffects.splice(0, hitscanEffects.length - MAX_HITSCAN_EFFECTS);
	}
}

// Impact effect for projectile hits (just shows explosion at target, no travel animation)
function spawnImpactEffect(x, y, attackType, typeColor) {
	// Create a short-lived impact effect
	const rgb = parseHexColor(typeColor || '#FF6B6B');
	const impact = {
		x,
		y,
		attackType,
		r: rgb.r,
		g: rgb.g,
		b: rgb.b,
		spawnTime: Date.now(),
		duration: 200, // Short impact duration
		isExplosion: false
	};
	impactEffects.push(impact);
	
	// Cap impacts
	if (impactEffects.length > 60) {
		impactEffects.splice(0, impactEffects.length - 60);
	}
}

// Explosion ring for Explosive Rounds
function spawnExplosionEffect(x, y) {
	const impact = {
		x,
		y,
		attackType: 'explosion',
		r: 255,
		g: 159,
		b: 28,
		spawnTime: Date.now(),
		duration: 260,
		isExplosion: true
	};
	impactEffects.push(impact);
	if (impactEffects.length > 80) {
		impactEffects.splice(0, impactEffects.length - 80);
	}
}

// Heatseeker drone attack effect - green laser zap
const heatseekerAttackEffects = [];

function spawnHeatseekerAttackEffect(fromX, fromY, toX, toY, ownerId, damage) {
	heatseekerAttackEffects.push({
		fromX, fromY, toX, toY,
		ownerId, damage,
		spawnTime: Date.now(),
		duration: 180 // Quick zap
	});
	// Cap effects
	if (heatseekerAttackEffects.length > 20) {
		heatseekerAttackEffects.splice(0, heatseekerAttackEffects.length - 20);
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
	// Also render heatseeker attack effects
	renderHeatseekerAttackEffects(ctx);
}

function renderHeatseekerAttackEffects(ctx) {
	const now = Date.now();
	for (let i = heatseekerAttackEffects.length - 1; i >= 0; i--) {
		const effect = heatseekerAttackEffects[i];
		const elapsed = now - effect.spawnTime;
		if (elapsed > effect.duration) {
			heatseekerAttackEffects.splice(i, 1);
			continue;
		}
		
		const progress = elapsed / effect.duration;
		const alpha = 1 - progress;
		
		ctx.save();
		
		// Calculate beam direction
		const dx = effect.toX - effect.fromX;
		const dy = effect.toY - effect.fromY;
		const len = Math.sqrt(dx * dx + dy * dy);
		
		// Animated beam - travels from source to target
		const beamProgress = Math.min(1, progress * 3); // Fast beam travel
		const currentLen = len * beamProgress;
		const endX = effect.fromX + (dx / len) * currentLen;
		const endY = effect.fromY + (dy / len) * currentLen;
		
		// Main beam (bright green)
		ctx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
		ctx.lineWidth = 3;
		ctx.shadowColor = '#00FF88';
		ctx.shadowBlur = 12;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(effect.fromX, effect.fromY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
		
		// Core beam (white)
		ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
		ctx.lineWidth = 1.5;
		ctx.shadowBlur = 0;
		ctx.beginPath();
		ctx.moveTo(effect.fromX, effect.fromY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
		
		// Impact spark at hit location
		if (beamProgress >= 1) {
			const sparkAlpha = alpha * 0.8;
			const sparkSize = 8 * (1 - progress * 0.5);
			
			// Glow
			const gradient = ctx.createRadialGradient(effect.toX, effect.toY, 0, effect.toX, effect.toY, sparkSize * 2);
			gradient.addColorStop(0, `rgba(0, 255, 136, ${sparkAlpha})`);
			gradient.addColorStop(0.5, `rgba(0, 200, 100, ${sparkAlpha * 0.5})`);
			gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(effect.toX, effect.toY, sparkSize * 2, 0, Math.PI * 2);
			ctx.fill();
			
			// Core
			ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha})`;
			ctx.beginPath();
			ctx.arc(effect.toX, effect.toY, sparkSize * 0.4, 0, Math.PI * 2);
			ctx.fill();
		}
		
		ctx.restore();
	}
}

function updateImpactEffects() {
	const now = Date.now();
	for (let i = impactEffects.length - 1; i >= 0; i--) {
		const impact = impactEffects[i];
		if (now - impact.spawnTime > impact.duration) {
			impactEffects.splice(i, 1);
		}
	}
}

function renderImpactEffects(ctx) {
	const now = Date.now();
	for (const impact of impactEffects) {
		const elapsed = now - impact.spawnTime;
		const progress = elapsed / impact.duration;
		const life = 1 - progress;
		
		if (life <= 0) continue;
		
		ctx.save();
		
		const rgba = (alpha) => `rgba(${impact.r},${impact.g},${impact.b},${alpha})`;
		
		// Expanding ring (larger for explosions)
		const ringRadius = impact.isExplosion ? (18 + progress * 50) : (8 + progress * 25);
		ctx.strokeStyle = rgba(impact.isExplosion ? 0.9 * life : 0.8 * life);
		ctx.lineWidth = (impact.isExplosion ? 4 : 3) * life;
		ctx.beginPath();
		ctx.arc(impact.x, impact.y, ringRadius, 0, Math.PI * 2);
		ctx.stroke();
		
		// Inner flash
		ctx.fillStyle = rgba((impact.isExplosion ? 0.75 : 0.6) * life);
		ctx.beginPath();
		ctx.arc(impact.x, impact.y, (impact.isExplosion ? 16 : 10) * life, 0, Math.PI * 2);
		ctx.fill();
		
		// White center
		ctx.fillStyle = `rgba(255,255,255,${0.9 * life})`;
		ctx.beginPath();
		ctx.arc(impact.x, impact.y, 5 * life, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
	}
}

// ===== DAMAGE NUMBERS (floating combat text) =====
function spawnDamageNumber(x, y, damage, isCrit, typeColor, isHeal = false, alwaysShow = false, isBleed = false) {
	if (!showDamageNumbers && !alwaysShow) return;
	
	// Slight random offset to prevent stacking
	const offsetX = (Math.random() - 0.5) * 20;
	const offsetY = (Math.random() - 0.5) * 10;
	
	damageNumbers.push({
		x: x + offsetX,
		y: y + offsetY,
		damage: Math.round(damage * 10) / 10,
		isCrit: isCrit,
		typeColor: isHeal ? '#2ECC71' : (typeColor || '#FF6B6B'), // Green for healing
		spawnTime: Date.now(),
		duration: isCrit ? 1200 : 900, // Crits last longer
		vy: -40 - (isCrit ? 20 : 0), // Float upward, crits float faster
		scale: isCrit ? 1.4 : 1.0,
		isHeal: isHeal, // Track if this is a heal number
		isBleed: isBleed,
		alwaysShow: alwaysShow
	});
	
	// Cap damage numbers
	if (damageNumbers.length > 80) {
		damageNumbers.splice(0, damageNumbers.length - 80);
	}
}

// Wrapper function for external use (heal pack pickup, etc)
function addDamageNumber(x, y, amount, isCrit = false, isHeal = false) {
	spawnDamageNumber(x, y, amount, isCrit, isHeal ? '#2ECC71' : null, isHeal);
}

function updateDamageNumbers() {
	const now = Date.now();
	const deltaSeconds = 1 / 60; // Assume ~60fps
	for (let i = damageNumbers.length - 1; i >= 0; i--) {
		const dmgNum = damageNumbers[i];
		if (now - dmgNum.spawnTime > dmgNum.duration) {
			damageNumbers.splice(i, 1);
		} else {
			// Float upward with deceleration
			dmgNum.y += dmgNum.vy * deltaSeconds;
			dmgNum.vy *= 0.95; // Slow down over time
		}
	}
}

function trackPlayerDamage() {
	const players = client.getPlayers();
	const activeIds = new Set();
	
	for (const p of players) {
		activeIds.add(p.num);
		if (p.hp === undefined || p.hp === null) continue;
		
		const prevHp = playerHpTracker.get(p.num);
		if (prevHp !== undefined) {
			if (p.hp < prevHp) {
				const dmg = prevHp - p.hp;
				if (dmg > 0) {
					playerDamaged(p.num, dmg, false);
				}
			} else if (p.hp > prevHp) {
				const healed = p.hp - prevHp;
				if (healed > 0) {
					playerHealed(p.num, healed);
				}
			}
		}
		playerHpTracker.set(p.num, p.hp);
	}
	
	for (const id of playerHpTracker.keys()) {
		if (!activeIds.has(id)) {
			playerHpTracker.delete(id);
		}
	}
}

function drawBleedIcon(ctx, x, y, size, color, alpha) {
	const radius = size * 0.45;
	const tipY = y + size * 0.6;
	ctx.save();
	ctx.fillStyle = color;
	ctx.globalAlpha = alpha;
	ctx.beginPath();
	ctx.arc(x, y - size * 0.1, radius, Math.PI * 0.15, Math.PI * 0.85, false);
	ctx.lineTo(x, tipY);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function renderDamageNumbers(ctx) {
	const now = Date.now();
	
	for (const dmgNum of damageNumbers) {
		if (!showDamageNumbers && !dmgNum.alwaysShow) continue;
		const elapsed = now - dmgNum.spawnTime;
		const progress = elapsed / dmgNum.duration;
		const life = 1 - progress;
		
		if (life <= 0) continue;
		
		ctx.save();
		
		// Fade out in the last 30%
		const alpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
		
		// Scale animation - pop in then shrink slightly
		let displayScale = dmgNum.scale;
		if (progress < 0.1) {
			// Pop-in animation
			displayScale *= 0.5 + (progress / 0.1) * 0.5;
		}
		
		const fontSize = Math.round(18 * displayScale);
		// Add "+" prefix for healing numbers
		const textValue = dmgNum.damage.toFixed(1);
		const text = dmgNum.isHeal ? '+' + textValue : textValue;
		
		// Parse color for glow
		const rgb = parseHexColor(dmgNum.typeColor);
		
		let finalText = text;
		if (dmgNum.isHeal) {
			// Healing number styling - green with heart-like effect
			ctx.font = `bold ${fontSize}px Changa`;
			
			// Green glow
			ctx.shadowBlur = 10;
			ctx.shadowColor = 'rgba(46, 204, 113, 0.8)';
			
			// Dark stroke for readability
			ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
			ctx.lineWidth = 3;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.strokeText(text, dmgNum.x, dmgNum.y);
			
			// Green fill
			ctx.fillStyle = `rgba(46, 204, 113, ${alpha})`;
			ctx.fillText(text, dmgNum.x, dmgNum.y);
		} else if (dmgNum.isCrit) {
			// Critical hit styling - gold/yellow with extra effects
			ctx.font = `bold ${fontSize}px Changa`;
			
			// Outer glow for crits
			ctx.shadowBlur = 12;
			ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
			
			// White stroke
			ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
			ctx.lineWidth = 4;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.strokeText(text + '!', dmgNum.x, dmgNum.y);
			
			// Gold fill
			ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
			finalText = text + '!';
			ctx.fillText(finalText, dmgNum.x, dmgNum.y);
		} else {
			// Normal damage styling
			ctx.font = `bold ${fontSize}px Changa`;
			
			// Subtle glow
			ctx.shadowBlur = 6;
			ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`;
			
			// Dark stroke for readability
			ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
			ctx.lineWidth = 3;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.strokeText(text, dmgNum.x, dmgNum.y);
			
			// White fill with slight tint from damage type
			const tintR = Math.min(255, 220 + rgb.r * 0.15);
			const tintG = Math.min(255, 220 + rgb.g * 0.15);
			const tintB = Math.min(255, 220 + rgb.b * 0.15);
			ctx.fillStyle = `rgba(${Math.round(tintR)}, ${Math.round(tintG)}, ${Math.round(tintB)}, ${alpha})`;
			ctx.fillText(text, dmgNum.x, dmgNum.y);
		}

		if (dmgNum.isBleed) {
			const textWidth = ctx.measureText(finalText).width;
			const iconSize = Math.max(6, fontSize * 0.35);
			const iconX = dmgNum.x + textWidth / 2 + iconSize * 0.6;
			const iconY = dmgNum.y - iconSize * 0.1;
			drawBleedIcon(ctx, iconX, iconY, iconSize, dmgNum.typeColor || '#8B0000', alpha);
		}
		
		ctx.restore();
	}
}

function spawnPlayerDamageNumber(player, damage, isCrit) {
	const isLocalPlayer = client.getUser && player === client.getUser();
	const sizeScale = player.sizeScale || 1.0;
	const scaledRadius = PLAYER_RADIUS * sizeScale;
	const sizeMult = isLocalPlayer ? 1.2 : 1.0;
	const barWidth = scaledRadius * 2.5 * sizeMult;
	const barHeight = 6 * sizeScale * sizeMult;
	const barX = player.x - barWidth / 2;
	const barY = player.y + scaledRadius + 8;
	const hpRatio = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHp || 1)));
	const numberX = barX + (barWidth * hpRatio);
	
	let numberY = barY + barHeight + 10;
	if (isLocalPlayer && player.stamina !== undefined) {
		const staminaBarHeight = 4 * sizeScale * sizeMult;
		const staminaBarY = barY + barHeight + 2;
		numberY = staminaBarY + staminaBarHeight + 10;
	}
	
	spawnDamageNumber(numberX, numberY, damage, isCrit, '#FF4444', false, true);
}

function spawnPlayerHealNumber(player, amount) {
	const isLocalPlayer = client.getUser && player === client.getUser();
	const sizeScale = player.sizeScale || 1.0;
	const scaledRadius = PLAYER_RADIUS * sizeScale;
	const sizeMult = isLocalPlayer ? 1.2 : 1.0;
	const barWidth = scaledRadius * 2.5 * sizeMult;
	const barHeight = 6 * sizeScale * sizeMult;
	const barX = player.x - barWidth / 2;
	const barY = player.y + scaledRadius + 8;
	const hpRatio = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHp || 1)));
	const numberX = barX + (barWidth * hpRatio);
	
	let numberY = barY + barHeight + 10;
	if (isLocalPlayer && player.stamina !== undefined) {
		const staminaBarHeight = 4 * sizeScale * sizeMult;
		const staminaBarY = barY + barHeight + 2;
		numberY = staminaBarY + staminaBarHeight + 10;
	}
	
	spawnDamageNumber(numberX, numberY, amount, false, '#2ECC71', true, true);
}

function flushDamageNumberBuckets() {
	const now = Date.now();
	const minInterval = 1000 / DAMAGE_NUMBER_MAX_PER_SEC;
	const players = client.getPlayers();
	const playerById = new Map(players.map(p => [p.num, p]));
	
	for (const [playerNum, bucket] of damageNumberBuckets.entries()) {
		const player = playerById.get(playerNum);
		if (!player) {
			damageNumberBuckets.delete(playerNum);
			continue;
		}
		
		const shouldFlush = bucket.pending > 0
			&& (now - bucket.lastDamage) >= DAMAGE_NUMBER_MERGE_WINDOW
			&& (now - bucket.lastSpawn) >= minInterval;
		
		if (shouldFlush) {
			const amount = bucket.pending;
			const isCrit = bucket.isCrit;
			bucket.pending = 0;
			bucket.isCrit = false;
			bucket.lastSpawn = now;
			spawnPlayerDamageNumber(player, amount, isCrit);
		}
	}
}

function flushHealNumberBuckets() {
	const now = Date.now();
	const minInterval = 1000 / DAMAGE_NUMBER_MAX_PER_SEC;
	const players = client.getPlayers();
	const playerById = new Map(players.map(p => [p.num, p]));
	
	for (const [playerNum, bucket] of healNumberBuckets.entries()) {
		const player = playerById.get(playerNum);
		if (!player) {
			healNumberBuckets.delete(playerNum);
			continue;
		}
		
		const shouldFlush = bucket.pending > 0
			&& (now - bucket.lastHeal) >= DAMAGE_NUMBER_MERGE_WINDOW
			&& (now - bucket.lastSpawn) >= minInterval;
		
		if (shouldFlush) {
			const amount = bucket.pending;
			bucket.pending = 0;
			bucket.lastSpawn = now;
			spawnPlayerHealNumber(player, amount);
		}
	}
}

// Player damage visual handler (red flash + damage number)
export function playerDamaged(playerNum, damage, isCrit = false) {
	const players = client.getPlayers();
	const player = players.find(p => p.num === playerNum);
	if (!player || damage <= 0) return;
	
	const now = Date.now();
	player.damageFlashDuration = DAMAGE_FLASH_DURATION;
	player.damageFlashUntil = Math.max(player.damageFlashUntil || 0, now + DAMAGE_FLASH_DURATION);
	
	const bucket = damageNumberBuckets.get(player.num) || {
		pending: 0,
		lastSpawn: 0,
		lastDamage: 0,
		isCrit: false
	};
	bucket.pending += damage;
	bucket.lastDamage = now;
	bucket.isCrit = bucket.isCrit || isCrit;
	
	const minInterval = 1000 / DAMAGE_NUMBER_MAX_PER_SEC;
	if (now - bucket.lastSpawn >= minInterval) {
		const amount = bucket.pending;
		const crit = bucket.isCrit;
		bucket.pending = 0;
		bucket.isCrit = false;
		bucket.lastSpawn = now;
		spawnPlayerDamageNumber(player, amount, crit);
	}
	
	damageNumberBuckets.set(player.num, bucket);
}

export function playerHealed(playerNum, amount) {
	const players = client.getPlayers();
	const player = players.find(p => p.num === playerNum);
	if (!player || amount <= 0) return;
	
	const now = Date.now();
	const bucket = healNumberBuckets.get(player.num) || {
		pending: 0,
		lastSpawn: 0,
		lastHeal: 0
	};
	bucket.pending += amount;
	bucket.lastHeal = now;
	
	const minInterval = 1000 / DAMAGE_NUMBER_MAX_PER_SEC;
	if (now - bucket.lastSpawn >= minInterval) {
		const healAmount = bucket.pending;
		bucket.pending = 0;
		bucket.lastSpawn = now;
		spawnPlayerHealNumber(player, healAmount);
	}
	
	healNumberBuckets.set(player.num, bucket);
}

// ===== PROJECTILE RENDERING (actual traveling projectiles from server) =====
function renderProjectiles(ctx) {
	const projectiles = client.getProjectiles();
	
	for (const proj of projectiles) {
		ctx.save();
		
		const size = proj.size || 8;
		const attackType = proj.attackType || 'bullet';
		const typeColor = proj.typeColor || '#FF6B6B';
		const opacity = Math.max(0, Math.min(1, proj.opacity ?? 1.0));
		ctx.globalAlpha = opacity;
		
		// Parse color
		const rgb = parseHexColor(typeColor);
		const rgba = (alpha) => `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
		const rgbaLight = (alpha) => {
			const r = Math.min(255, rgb.r + 60);
			const g = Math.min(255, rgb.g + 60);
			const b = Math.min(255, rgb.b + 60);
			return `rgba(${r},${g},${b},${alpha})`;
		};
		
		// Calculate trail direction from velocity
		const speed = Math.hypot(proj.vx || 0, proj.vy || 0);
		const angle = Math.atan2(proj.vy || 0, proj.vx || 0);
		
		switch (attackType) {
			case 'plasma':
				if (proj.blackHolePull) {
					renderBlackHoleProjectile(ctx, proj.x, proj.y, size, rgba, rgbaLight, proj.spawnTime);
				} else {
					renderPlasmaProjectile(ctx, proj.x, proj.y, size, rgba, rgbaLight);
				}
				break;
			case 'railgun':
				renderRailgunProjectile(ctx, proj.x, proj.y, size, angle, rgba, rgbaLight);
				break;
			case 'flame':
				renderFlameProjectile(ctx, proj.x, proj.y, size, angle, rgba, rgbaLight, proj.spawnTime);
				break;
			case 'bullet':
			default:
				renderBulletProjectile(ctx, proj.x, proj.y, size, angle, rgba, rgbaLight);
				break;
		}
		
		ctx.restore();
	}
}

// Render a bullet projectile - CIRCLE shape (starting projectile)
function renderBulletProjectile(ctx, x, y, size, angle, rgba, rgbaLight) {
	// Outer glow
	ctx.shadowBlur = 12;
	ctx.shadowColor = rgba(0.6);
	
	// Outer circle (semi-transparent)
	ctx.fillStyle = rgba(0.4);
	ctx.beginPath();
	ctx.arc(x, y, size * 1.2, 0, Math.PI * 2);
	ctx.fill();
	
	// Main circle body
	ctx.fillStyle = rgba(0.6);
	ctx.beginPath();
	ctx.arc(x, y, size * 0.9, 0, Math.PI * 2);
	ctx.fill();
	
	// Inner bright core
	ctx.fillStyle = rgbaLight(0.7);
	ctx.beginPath();
	ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
	ctx.fill();
	
	// Center highlight
	ctx.fillStyle = 'rgba(255,255,255,0.6)';
	ctx.beginPath();
	ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.shadowBlur = 0;
}

// Render a flame projectile - layered fire with flicker and ember trail
function renderFlameProjectile(ctx, x, y, size, angle, rgba, rgbaLight, spawnTime) {
	const flicker = 0.85 + 0.15 * Math.sin(Date.now() / 60 + x * 0.03);
	const length = size * 2.6 * flicker;
	const width = size * 1.2 * flicker;
	const ageMs = spawnTime ? (Date.now() - spawnTime) : 0;
	const fade = Math.max(0, 1 - (ageMs / 450));
	
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	
	// Outer glow sheath
	ctx.shadowBlur = 20;
	ctx.shadowColor = rgba(0.9);
	ctx.fillStyle = rgba(0.25);
	ctx.beginPath();
	ctx.ellipse(0, 0, length * 0.7, width * 0.55, 0, 0, Math.PI * 2);
	ctx.fill();
	
	// Core flame gradient
	const grad = ctx.createLinearGradient(-length * 0.7, 0, length * 0.7, 0);
	grad.addColorStop(0, rgbaLight(0.9));
	grad.addColorStop(0.45, rgba(0.7));
	grad.addColorStop(1, rgba(0.05));
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.ellipse(0, 0, length * 0.55, width * 0.45, 0, 0, Math.PI * 2);
	ctx.fill();
	
	// Ember trail cone
	ctx.shadowBlur = 0;
	ctx.fillStyle = rgba(0.35 * fade);
	ctx.beginPath();
	ctx.moveTo(-length * 0.15, -width * 0.25);
	ctx.quadraticCurveTo(-length * 0.9, 0, -length * 0.15, width * 0.25);
	ctx.closePath();
	ctx.fill();
	
	// Smoke wisps as flame fades
	if (fade < 0.95) {
		const rise = Math.min(1, ageMs / 450);
		const smokeAlpha = Math.max(0, (1 - fade) * 0.65);
		for (let i = 0; i < 5; i++) {
			const t = i / 4;
			const sx = -length * (0.45 + 0.25 * t);
			const sy = (-width * 0.45 * rise) + (Math.sin(Date.now() / 140 + i) * 0.12) * width;
			const sSize = width * (0.45 + 0.45 * t);
			ctx.fillStyle = `rgba(70, 70, 80, ${smokeAlpha * (1 - t)})`;
			ctx.beginPath();
			ctx.ellipse(sx, sy, sSize, sSize * 0.8, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	
	// Inner hot core
	ctx.fillStyle = 'rgba(255,230,190,0.8)';
	ctx.beginPath();
	ctx.ellipse(-length * 0.1, 0, length * 0.2, width * 0.18, 0, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.restore();
}

// Render a plasma projectile - HEXAGON shape
function renderPlasmaProjectile(ctx, x, y, size, rgba, rgbaLight) {
	// Pulsing effect
	const pulse = 0.9 + 0.1 * Math.sin(Date.now() / 100);
	const rotation = Date.now() / 500; // Slow rotation
	
	// Outer glow
	ctx.shadowBlur = 18;
	ctx.shadowColor = rgba(0.5);
	
	// Helper to draw hexagon
	const drawHexagon = (radius) => {
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = rotation + (i / 6) * Math.PI * 2;
			const px = x + Math.cos(angle) * radius;
			const py = y + Math.sin(angle) * radius;
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();
	};
	
	// Outer hexagon (semi-transparent)
	ctx.fillStyle = rgba(0.3);
	drawHexagon(size * 1.5 * pulse);
	ctx.fill();
	
	// Main hexagon body
	ctx.fillStyle = rgba(0.5);
	drawHexagon(size * 1.1);
	ctx.fill();
	
	// Inner hexagon
	ctx.fillStyle = rgbaLight(0.6);
	drawHexagon(size * 0.7);
	ctx.fill();
	
	// Center highlight (small circle)
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.beginPath();
	ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.shadowBlur = 0;
}

// Render a black hole projectile - dark core with accretion ring
function renderBlackHoleProjectile(ctx, x, y, size, rgba, rgbaLight, spawnTime) {
	const t = (Date.now() - (spawnTime || Date.now())) / 1000;
	const pulse = 0.85 + 0.15 * Math.sin(t * 4);
	const coreSize = size * 0.65 * pulse;
	const ringSize = size * 1.5 * (0.9 + 0.1 * Math.sin(t * 2.2));
	const rotation = t * 1.8;
	
	// Outer glow
	ctx.shadowBlur = 18;
	ctx.shadowColor = rgba(0.4);
	ctx.fillStyle = rgba(0.25);
	ctx.beginPath();
	ctx.arc(x, y, ringSize * 1.05, 0, Math.PI * 2);
	ctx.fill();
	
	// Accretion ring
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rotation);
	ctx.strokeStyle = rgbaLight(0.6);
	ctx.lineWidth = Math.max(2, size * 0.25);
	ctx.beginPath();
	ctx.ellipse(0, 0, ringSize, ringSize * 0.55, 0, 0.2, Math.PI * 1.4);
	ctx.stroke();
	ctx.restore();
	
	// Dark core
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
	ctx.beginPath();
	ctx.arc(x, y, coreSize, 0, Math.PI * 2);
	ctx.fill();
	
	// Inner event horizon glow
	ctx.strokeStyle = 'rgba(120, 140, 255, 0.35)';
	ctx.lineWidth = Math.max(1, size * 0.1);
	ctx.beginPath();
	ctx.arc(x, y, coreSize * 0.75, 0, Math.PI * 2);
	ctx.stroke();
}

// Render a railgun projectile - DIAMOND shape (elongated)
function renderRailgunProjectile(ctx, x, y, size, angle, rgba, rgbaLight) {
	// Outer glow
	ctx.shadowBlur = 15;
	ctx.shadowColor = rgba(0.5);
	
	// Helper to draw elongated diamond pointing in direction of travel
	const drawDiamond = (lengthMult, widthMult) => {
		const length = size * lengthMult;
		const width = size * widthMult;
		
		// Points of diamond: front, right, back, left
		const frontX = x + Math.cos(angle) * length;
		const frontY = y + Math.sin(angle) * length;
		const backX = x - Math.cos(angle) * length * 0.5;
		const backY = y - Math.sin(angle) * length * 0.5;
		const rightX = x + Math.cos(angle + Math.PI/2) * width;
		const rightY = y + Math.sin(angle + Math.PI/2) * width;
		const leftX = x + Math.cos(angle - Math.PI/2) * width;
		const leftY = y + Math.sin(angle - Math.PI/2) * width;
		
		ctx.beginPath();
		ctx.moveTo(frontX, frontY);
		ctx.lineTo(rightX, rightY);
		ctx.lineTo(backX, backY);
		ctx.lineTo(leftX, leftY);
		ctx.closePath();
	};
	
	// Outer diamond (semi-transparent)
	ctx.fillStyle = rgba(0.35);
	drawDiamond(2.0, 0.8);
	ctx.fill();
	
	// Main diamond body
	ctx.fillStyle = rgba(0.55);
	drawDiamond(1.5, 0.6);
	ctx.fill();
	
	// Inner diamond
	ctx.fillStyle = rgbaLight(0.65);
	drawDiamond(1.0, 0.4);
	ctx.fill();
	
	// Center highlight
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	drawDiamond(0.5, 0.2);
	ctx.fill();
	
	ctx.shadowBlur = 0;
}

// ===== ENEMY RENDERING =====
function renderEnemy(ctx, enemy) {
	ctx.save();
	
	const type = enemy.type || 'basic';
	const style = ENEMY_STYLES[type] || ENEMY_STYLES.basic;
	const isBoss = enemy.isBoss;
	const stats = client.getEnemyStats();
	const runTime = stats && stats.runTime != null ? stats.runTime : 0;
	
	// Get distance for LOD (Level of Detail)
	const dist = enemy._renderDistance || 0;
	const isNear = dist < 400; // Within 400 units = full detail
	const isMedium = dist < 800; // Within 800 units = medium detail
	
	// Get density info from context
	const density = ctx._enemyDensity || {};
	const isHighDensity = density.isHigh || false;
	const isVeryHighDensity = density.isVeryHigh || false;
	
	// Cache time for this enemy (reuse from paint context if available)
	const enemyTime = ctx._currentTime || Date.now();
	
	// Boss aura effect (pulsing outer glow) - skip when high density
	if (isBoss && isNear && !isHighDensity) {
		const pulse = 0.5 + 0.5 * Math.sin(enemyTime / 200);
		ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + pulse * 0.4})`; // Golden aura
		ctx.lineWidth = 4 + pulse * 3;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + pulse * 4, 0, Math.PI * 2);
		ctx.stroke();
	}
	
	// Charging glow effect - skip when high density
	if (enemy.isCharging && isNear && !isHighDensity) {
		const pulse = 0.5 + 0.5 * Math.sin(enemyTime / 80);
		ctx.shadowBlur = 15 + pulse * 10;
		ctx.shadowColor = style.color;
	}
	
	// Heal glow when recently healed
	if (enemy.healGlowUntil && runTime < enemy.healGlowUntil) {
		const glowStrength = Math.max(0, (enemy.healGlowUntil - runTime) / 0.6);
		ctx.shadowBlur = 12 + 8 * glowStrength;
		ctx.shadowColor = `rgba(80, 255, 140, ${0.4 + glowStrength * 0.3})`;
	}
	
	// Shadow (larger for bosses) - skip for distant enemies and high density
	if (isMedium && !isVeryHighDensity) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
		ctx.beginPath();
		ctx.arc(enemy.x + (isBoss ? 4 : 2), enemy.y + (isBoss ? 4 : 2), enemy.radius, 0, Math.PI * 2);
		ctx.fill();
	}
	
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
	
	// Type-specific visuals - only render when near and not high density
	if (isNear && !isHighDensity) {
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
			// Support healer: constant aura fill + outline, plus sign
			const auraRadius = enemy.healRadius || enemy.radius * 6;
			ctx.fillStyle = "rgba(120, 200, 255, 0.12)";
			ctx.beginPath();
			ctx.arc(enemy.x, enemy.y, auraRadius, 0, Math.PI * 2);
			ctx.fill();
			
			ctx.strokeStyle = "rgba(30, 120, 220, 0.55)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(enemy.x, enemy.y, auraRadius, 0, Math.PI * 2);
			ctx.stroke();
			
			ctx.strokeStyle = "rgba(240, 250, 255, 0.8)";
			ctx.lineWidth = 3;
			const crossSize = enemy.radius * 0.6;
			ctx.beginPath();
			ctx.moveTo(enemy.x, enemy.y - crossSize);
			ctx.lineTo(enemy.x, enemy.y + crossSize);
			ctx.moveTo(enemy.x - crossSize, enemy.y);
			ctx.lineTo(enemy.x + crossSize, enemy.y);
			ctx.stroke();
		}
	}
	
	// ===== BOSS-SPECIFIC VISUALS =====
	// Only render complex boss visuals when near and not high density
	if (isNear && isBoss && !isHighDensity) {
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
				const angle = (i / spikeCount) * Math.PI * 2 + enemyTime / 500;
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
			const time = enemyTime / 1000;
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
	}
	
	// Non-boss enemy HP outline (when enabled) - only when near
	if (!isBoss && isNear && showEnemyHealthBars && enemy.hp < enemy.maxHp) {
		renderEnemyHpOutline(ctx, enemy);
	}
	
	ctx.restore();
}

function renderEnemyHpOutline(ctx, enemy) {
	const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
	if (ratio <= 0) return;
	
	// Arc starts at 12 o'clock and shrinks counter-clockwise as HP decreases
	// Right side disappears first, leaving the left side when nearly dead
	const startAngle = -Math.PI / 2; // 12 o'clock (top)
	const arcLength = ratio * Math.PI * 2;
	const endAngle = startAngle - arcLength;
	
	ctx.save();
	ctx.strokeStyle = "rgba(255, 60, 60, 0.9)";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(enemy.x, enemy.y, enemy.radius + 4, startAngle, endAngle, true); // true = counter-clockwise
	ctx.stroke();
	ctx.restore();
}

function renderEnemies(ctx) {
	const enemyList = client.getEnemies();
	
	// Calculate viewport bounds for culling (reuse from paint function context)
	// We need to calculate it here since we don't have direct access to offset/zoom
	// Get viewport from the current transform context
	const viewportLeft = offset[0] - consts.BORDER_WIDTH - 150; // Add padding for enemies near edge
	const viewportRight = offset[0] - consts.BORDER_WIDTH + gameWidth / zoom + 150;
	const viewportTop = offset[1] - consts.BORDER_WIDTH - 150;
	const viewportBottom = offset[1] - consts.BORDER_WIDTH + gameHeight / zoom + 150;
	
	const playerX = user ? user.x : 0;
	const playerY = user ? user.y : 0;
	const NEAR_RADIUS = 400;
	const NEAR_RADIUS_SQ = NEAR_RADIUS * NEAR_RADIUS;
	
	// Count nearby enemies to detect high density
	let nearbyEnemyCount = 0;
	let nearbyBossCount = 0;
	
	// First pass: count nearby enemies
	for (const enemy of enemyList) {
		const enemyRadius = enemy.radius || 10;
		if (enemy.x + enemyRadius < viewportLeft || enemy.x - enemyRadius > viewportRight || 
		    enemy.y + enemyRadius < viewportTop || enemy.y - enemyRadius > viewportBottom) {
			continue;
		}
		const dx = enemy.x - playerX;
		const dy = enemy.y - playerY;
		const distSq = dx * dx + dy * dy;
		if (distSq < NEAR_RADIUS_SQ) {
			nearbyEnemyCount++;
			if (enemy.isBoss) nearbyBossCount++;
		}
	}
	
	// Determine rendering quality based on density
	const HIGH_ENEMY_DENSITY_THRESHOLD = 20; // More than 20 nearby enemies = high density
	const VERY_HIGH_ENEMY_DENSITY_THRESHOLD = 40; // More than 40 = very high density
	const isHighEnemyDensity = nearbyEnemyCount > HIGH_ENEMY_DENSITY_THRESHOLD;
	const isVeryHighEnemyDensity = nearbyEnemyCount > VERY_HIGH_ENEMY_DENSITY_THRESHOLD;
	
	// Store density info and cached time for renderEnemy
	ctx._enemyDensity = {
		isHigh: isHighEnemyDensity,
		isVeryHigh: isVeryHighEnemyDensity,
		nearbyCount: nearbyEnemyCount
	};
	ctx._currentTime = Date.now(); // Cache time for all enemies
	
	// Render enemies
	for (const enemy of enemyList) {
		// Viewport culling: skip enemies outside visible area
		const enemyRadius = enemy.radius || 10;
		if (enemy.x + enemyRadius < viewportLeft || enemy.x - enemyRadius > viewportRight || 
		    enemy.y + enemyRadius < viewportTop || enemy.y - enemyRadius > viewportBottom) {
			continue;
		}
		
		// Calculate distance from player for LOD
		const dx = enemy.x - playerX;
		const dy = enemy.y - playerY;
		const distSq = dx * dx + dy * dy;
		const dist = Math.sqrt(distSq);
		enemy._renderDistance = dist; // Store for use in renderEnemy
		
		renderEnemy(ctx, enemy);
	}
	
	// Clean up
	delete ctx._enemyDensity;
}

// ===== DRONE RENDERING =====

// Helper to convert hex color to rgba
function hexToRgba(hex, alpha) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (result) {
		const r = parseInt(result[1], 16);
		const g = parseInt(result[2], 16);
		const b = parseInt(result[3], 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	return hex;
}

function renderDrone(ctx, drone, ownerPlayer, isUserDrone) {
	const x = drone.x;
	const y = drone.y;
	// Scale drone size with owner's size scale
	const ownerSizeScale = drone.ownerSizeScale || (ownerPlayer && ownerPlayer.sizeScale) || 1.0;
	const radius = DRONE_VISUAL_RADIUS * ownerSizeScale;
	const isDisabled = ownerPlayer && ownerPlayer.isSnipped;
	const droneTypeColor = drone.typeColor || '#FF6B6B';
	const typeId = drone.typeId || 'assault';
	const time = Date.now();
	// Flame drone plume aligns with orbit direction when possible
	let engineAngle = null;
	if (ownerPlayer && ownerPlayer.x != null && ownerPlayer.y != null) {
		const orbitAngle = Math.atan2(y - ownerPlayer.y, x - ownerPlayer.x);
		engineAngle = orbitAngle - Math.PI / 2;
	}
	
	ctx.save();
	
	// Outer glow when targeting
	if (drone.targetId !== null && !isDisabled) {
		const pulse = 0.4 + 0.3 * Math.sin(time / 150 * 4);
		ctx.shadowBlur = 12 * pulse;
		ctx.shadowColor = droneTypeColor;
	}
	
	// Render type-specific design (shadows are handled per-type)
	if (isDisabled) {
		renderDisabledDrone(ctx, x, y, radius);
	} else {
		switch (typeId) {
			case 'assault':
				renderAssaultDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			case 'rapid':
				renderRapidDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			case 'sniper':
				renderSniperDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			case 'guardian':
				renderGuardianDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			case 'skirmisher':
				renderSkirmisherDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			case 'support':
				renderSupportDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null, engineAngle);
				break;
			case 'swarm':
				renderSwarmDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
				break;
			default:
				renderAssaultDrone(ctx, x, y, radius, droneTypeColor, time, drone.targetId !== null);
		}
	}
	
	ctx.shadowBlur = 0;
	
	// HP bar (only show if damaged and not disabled)
	if (drone.hp !== undefined && drone.maxHp !== undefined && drone.hp < drone.maxHp && !isDisabled) {
		const barWidth = radius * 2.2;
		const barHeight = 3;
		const barX = x - barWidth / 2;
		const barY = y - radius - 8;
		
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fillRect(barX, barY, barWidth, barHeight);
		
		const hpRatio = Math.max(0, drone.hp / drone.maxHp);
		ctx.fillStyle = hpRatio > 0.5 ? "#44ff44" : (hpRatio > 0.25 ? "#ffcc00" : "#ff4444");
		ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
	}
	
	ctx.restore();
}

// Disabled drone (gray with X)
function renderDisabledDrone(ctx, x, y, radius) {
	// Shadow
	ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
	ctx.beginPath();
	ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.strokeStyle = "rgba(60, 60, 60, 0.6)";
	ctx.lineWidth = 2;
	ctx.stroke();
	
	// X mark
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

// ASSAULT - Angular military design with targeting reticle
function renderAssaultDrone(ctx, x, y, radius, color, time, isTargeting) {
	// Hexagonal body
	ctx.fillStyle = hexToRgba(color, 0.9);
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
		const px = x + Math.cos(angle) * radius;
		const py = y + Math.sin(angle) * radius;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	
	// Border
	ctx.strokeStyle = shadeColor(color, -40);
	ctx.lineWidth = 2;
	ctx.stroke();
	
	// Inner chevron
	ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - radius * 0.4, y + radius * 0.2);
	ctx.lineTo(x, y - radius * 0.3);
	ctx.lineTo(x + radius * 0.4, y + radius * 0.2);
	ctx.stroke();
	
	// Targeting dot when active
	if (isTargeting) {
		const pulse = 0.5 + 0.5 * Math.sin(time / 80);
		ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * pulse})`;
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2);
		ctx.fill();
	}
}

// RAPID - Sleek triangular design with speed lines
function renderRapidDrone(ctx, x, y, radius, color, time, isTargeting) {
	const rotation = time / 200;
	
	// Main triangular body (pointing in orbit direction)
	ctx.fillStyle = hexToRgba(color, 0.9);
	ctx.beginPath();
	ctx.moveTo(x + Math.cos(rotation) * radius, y + Math.sin(rotation) * radius);
	ctx.lineTo(x + Math.cos(rotation + 2.4) * radius * 0.8, y + Math.sin(rotation + 2.4) * radius * 0.8);
	ctx.lineTo(x + Math.cos(rotation + 3.9) * radius * 0.8, y + Math.sin(rotation + 3.9) * radius * 0.8);
	ctx.closePath();
	ctx.fill();
	
	ctx.strokeStyle = shadeColor(color, -40);
	ctx.lineWidth = 2;
	ctx.stroke();
	
	// Speed trail lines
	ctx.strokeStyle = hexToRgba(color, 0.4);
	ctx.lineWidth = 1.5;
	for (let i = 1; i <= 3; i++) {
		const trailOffset = rotation - i * 0.3;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(trailOffset + 2.4) * radius * (0.6 - i * 0.1), 
				   y + Math.sin(trailOffset + 2.4) * radius * (0.6 - i * 0.1));
		ctx.lineTo(x + Math.cos(trailOffset + 3.9) * radius * (0.6 - i * 0.1), 
				   y + Math.sin(trailOffset + 3.9) * radius * (0.6 - i * 0.1));
		ctx.stroke();
	}
	
	// Core
	if (isTargeting) {
		ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.25, 0, Math.PI * 2);
		ctx.fill();
	}
}

// SNIPER - Scope/crosshair design with elongated shape
function renderSniperDrone(ctx, x, y, radius, color, time, isTargeting) {
	// Elongated diamond body
	ctx.fillStyle = hexToRgba(color, 0.9);
	ctx.beginPath();
	ctx.moveTo(x, y - radius * 1.2);
	ctx.lineTo(x + radius * 0.6, y);
	ctx.lineTo(x, y + radius * 1.2);
	ctx.lineTo(x - radius * 0.6, y);
	ctx.closePath();
	ctx.fill();
	
	ctx.strokeStyle = shadeColor(color, -40);
	ctx.lineWidth = 2;
	ctx.stroke();
	
	// Scope crosshair
	ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
	ctx.lineWidth = 1.5;
	// Vertical
	ctx.beginPath();
	ctx.moveTo(x, y - radius * 0.5);
	ctx.lineTo(x, y + radius * 0.5);
	ctx.stroke();
	// Horizontal
	ctx.beginPath();
	ctx.moveTo(x - radius * 0.5, y);
	ctx.lineTo(x + radius * 0.5, y);
	ctx.stroke();
	
	// Center targeting circle
	if (isTargeting) {
		const pulse = 0.5 + 0.5 * Math.sin(time / 100);
		ctx.strokeStyle = `rgba(255, 100, 100, ${0.6 + 0.4 * pulse})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
		ctx.stroke();
	}
}

// BLACK HOLE - Dark core with accretion ring
function renderGuardianDrone(ctx, x, y, radius, color, time, isTargeting) {
	const r = radius * 1.15;
	const pulse = 0.85 + 0.15 * Math.sin(time / 120);
	const rotation = time / 220;
	
	// Soft outer glow
	ctx.shadowBlur = 16;
	ctx.shadowColor = hexToRgba(color, 0.6);
	ctx.fillStyle = hexToRgba(color, 0.2);
	ctx.beginPath();
	ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
	ctx.fill();
	
	// Accretion ring
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rotation);
	ctx.strokeStyle = hexToRgba('#8FB7FF', 0.55);
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 0.95, r * 0.45, 0, 0.3, Math.PI * 1.6);
	ctx.stroke();
	ctx.restore();
	
	// Dark core
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(8, 8, 12, 0.95)';
	ctx.beginPath();
	ctx.arc(x, y, r * 0.55 * pulse, 0, Math.PI * 2);
	ctx.fill();
	
	// Inner glow ring
	ctx.strokeStyle = 'rgba(120, 140, 255, 0.35)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x, y, r * 0.38 * pulse, 0, Math.PI * 2);
	ctx.stroke();
	
	// Targeting pulse
	if (isTargeting) {
		const halo = 0.35 + 0.35 * Math.sin(time / 140);
		ctx.strokeStyle = `rgba(140, 170, 255, ${halo})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
		ctx.stroke();
	}
}

// SKIRMISHER - Dynamic swept-wing design with motion blur
function renderSkirmisherDrone(ctx, x, y, radius, color, time, isTargeting) {
	const spin = time / 300;
	
	// Rotating swept wings (3 blades)
	ctx.fillStyle = hexToRgba(color, 0.85);
	for (let i = 0; i < 3; i++) {
		const angle = spin + (i / 3) * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + Math.cos(angle - 0.3) * radius * 0.4, y + Math.sin(angle - 0.3) * radius * 0.4);
		ctx.lineTo(x + Math.cos(angle) * radius * 1.1, y + Math.sin(angle) * radius * 1.1);
		ctx.lineTo(x + Math.cos(angle + 0.3) * radius * 0.4, y + Math.sin(angle + 0.3) * radius * 0.4);
		ctx.closePath();
		ctx.fill();
	}
	
	// Wing borders
	ctx.strokeStyle = shadeColor(color, -40);
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 3; i++) {
		const angle = spin + (i / 3) * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(angle - 0.3) * radius * 0.4, y + Math.sin(angle - 0.3) * radius * 0.4);
		ctx.lineTo(x + Math.cos(angle) * radius * 1.1, y + Math.sin(angle) * radius * 1.1);
		ctx.lineTo(x + Math.cos(angle + 0.3) * radius * 0.4, y + Math.sin(angle + 0.3) * radius * 0.4);
		ctx.stroke();
	}
	
	// Central hub
	ctx.fillStyle = hexToRgba(shadeColor(color, 30), 0.9);
	ctx.beginPath();
	ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shadeColor(color, -30);
	ctx.lineWidth = 2;
	ctx.stroke();
	
	// Targeting core
	if (isTargeting) {
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.15, 0, Math.PI * 2);
		ctx.fill();
	}
}

// FLAME - Larger burner core with animated plume
function renderSupportDrone(ctx, x, y, radius, color, time, isTargeting, engineAngle) {
	const r = radius * 1.1;
	const plumeLen = radius * 1.65;
	const wobble = Math.sin(time / 170) * 0.18;
	const baseAngle = (engineAngle != null ? engineAngle : Math.PI / 2) - (Math.PI * (75 / 180));
	const angle = wobble + baseAngle;
	
	// Burner core
	ctx.fillStyle = hexToRgba(color, 0.85);
	ctx.beginPath();
	ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shadeColor(color, -30);
	ctx.lineWidth = 2;
	ctx.stroke();

	// Inner nozzle ring
	ctx.fillStyle = hexToRgba(shadeColor(color, 30), 0.9);
	ctx.beginPath();
	ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shadeColor(color, -50);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	
	// Flame plume
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	const grad = ctx.createLinearGradient(0, -plumeLen * 0.2, 0, plumeLen);
	grad.addColorStop(0, 'rgba(200,235,255,0.95)');
	grad.addColorStop(0.55, 'rgba(90,170,255,0.75)');
	grad.addColorStop(1, 'rgba(40,120,255,0.1)');
	ctx.fillStyle = grad;
	ctx.shadowBlur = 18;
	ctx.shadowColor = 'rgba(80,150,255,0.8)';
	ctx.beginPath();
	ctx.moveTo(0, -r * 0.25);
	ctx.quadraticCurveTo(plumeLen * 0.4, plumeLen * 0.3, 0, plumeLen);
	ctx.quadraticCurveTo(-plumeLen * 0.4, plumeLen * 0.3, 0, -r * 0.25);
	ctx.closePath();
	ctx.fill();
	
	// Inner hot tongue
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(180,220,255,0.75)';
	ctx.beginPath();
	ctx.moveTo(0, -r * 0.18);
	ctx.quadraticCurveTo(plumeLen * 0.2, plumeLen * 0.35, 0, plumeLen * 0.75);
	ctx.quadraticCurveTo(-plumeLen * 0.2, plumeLen * 0.35, 0, -r * 0.18);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	
	// Targeting flare
	if (isTargeting) {
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.beginPath();
		ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
		ctx.fill();
	}
}

// SWARM - Small insect-like design with multiple elements
function renderSwarmDrone(ctx, x, y, radius, color, time, isTargeting) {
	const r = radius * 0.85; // Slightly smaller
	const wingFlap = Math.sin(time / 50) * 0.3;
	
	// Body (elongated oval)
	ctx.fillStyle = hexToRgba(color, 0.9);
	ctx.beginPath();
	ctx.ellipse(x, y, r * 0.5, r * 0.8, 0, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.strokeStyle = shadeColor(color, -40);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	
	// Wings (4 small translucent wings)
	ctx.fillStyle = hexToRgba(color, 0.4);
	// Top-left wing
	ctx.beginPath();
	ctx.ellipse(x - r * 0.5, y - r * 0.3, r * 0.5, r * 0.25, -0.5 + wingFlap, 0, Math.PI * 2);
	ctx.fill();
	// Top-right wing
	ctx.beginPath();
	ctx.ellipse(x + r * 0.5, y - r * 0.3, r * 0.5, r * 0.25, 0.5 - wingFlap, 0, Math.PI * 2);
	ctx.fill();
	// Bottom-left wing
	ctx.beginPath();
	ctx.ellipse(x - r * 0.4, y + r * 0.2, r * 0.4, r * 0.2, -0.3 - wingFlap, 0, Math.PI * 2);
	ctx.fill();
	// Bottom-right wing
	ctx.beginPath();
	ctx.ellipse(x + r * 0.4, y + r * 0.2, r * 0.4, r * 0.2, 0.3 + wingFlap, 0, Math.PI * 2);
	ctx.fill();
	
	// Eyes
	ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
	ctx.beginPath();
	ctx.arc(x - r * 0.2, y - r * 0.4, r * 0.15, 0, Math.PI * 2);
	ctx.arc(x + r * 0.2, y - r * 0.4, r * 0.15, 0, Math.PI * 2);
	ctx.fill();
	
	// Red targeting eyes when active
	if (isTargeting) {
		const pulse = 0.5 + 0.5 * Math.sin(time / 80);
		ctx.fillStyle = `rgba(255, 50, 50, ${0.7 + 0.3 * pulse})`;
		ctx.beginPath();
		ctx.arc(x - r * 0.2, y - r * 0.4, r * 0.1, 0, Math.PI * 2);
		ctx.arc(x + r * 0.2, y - r * 0.4, r * 0.1, 0, Math.PI * 2);
		ctx.fill();
	}
}

function renderAllDrones(ctx) {
	const allPlayers = user ? [user] : [];
	
	for (const p of allPlayers) {
		if (!p.drones || p.drones.length === 0) continue;
		
		const isUserDrones = user && p.num === user.num;
		
		for (let i = 0; i < p.drones.length; i++) {
			const drone = p.drones[i];
			// Skip first drone (index 0) - it fires from the player's aim indicator instead
			if (drone.droneIndex === 0 || i === 0) continue;
			// Skip rendering drones with 0 HP (but render if HP is undefined)
			if (drone.hp !== undefined && drone.hp <= 0) continue;
			renderDrone(ctx, drone, p, isUserDrones);
		}
	}
}

function renderDroneRangeCircle(ctx, player) {
	const baseRange = consts.DRONE_RANGE || 200;
	// Scale range with player size and range upgrades
	const sizeScale = player.sizeScale || 1.0;
	const rangeMult = (player.derivedStats && player.derivedStats.rangeMult) || 1.0;
	const range = baseRange * sizeScale * rangeMult;
	
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
	
	// Update impact effects
	updateImpactEffects();
	
	// Update damage numbers
	updateDamageNumbers();
	
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
};

export function disconnect() {
	$("#wasted").fadeIn(1000);
};

export function removePlayer(player) {
	const isUser = user && player.num === user.num;
	spawnDeathEffect(player, isUser);
	
	// Play death sound (singleplayer)
	if (soundInitialized && isUser) {
		SoundManager.playDeathSound(true);
	}
	
	delete playerPortion[player.num];
	delete portionsRolling[player.num];
};

// Silent removal for players leaving AOI (not dead, just out of view)
export function removePlayerSilent(player) {
	delete playerPortion[player.num];
	delete portionsRolling[player.num];
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

// Heal pack pickup handler (called from game-client when Support drone heal pack is collected)
export function healPackPickup(pack, healAmount) {
	// Play heal sound (use coin pickup for now, could add dedicated heal sound)
	if (soundInitialized) {
		SoundManager.playCoinPickup();
	}
	
	// Add floating heal number
	const user = client.getUser();
	if (user && pack) {
		addDamageNumber(pack.x, pack.y - 20, healAmount, false, true); // isHeal = true
	}
}

// Boost pickup handler (stamina/heal boost orbs and heal feedback)
export function boostPickup(type, amount, x, y) {
	// Play pickup sound (skip for lifesteal/vampire to reduce noise)
	if (soundInitialized && type !== "lifesteal" && type !== "vampire") {
		SoundManager.playCoinPickup();
	}
	
	// Show floating number with appropriate color
	if (type === "heal") {
		// Green heal number
		addDamageNumber(x, y - 15, amount, false, true);
	} else if (type === "lifesteal") {
		// Lifesteal number under the player's healthbar
		const player = client.getUser && client.getUser();
		if (player) {
			spawnPlayerHealNumber(player, amount);
		} else {
			addDamageNumber(x, y - 15, amount, false, true);
		}
	} else if (type === "vampire") {
		// Vampire heal number under the player's healthbar
		const player = client.getUser && client.getUser();
		if (player) {
			spawnPlayerHealNumber(player, amount);
		} else {
			addDamageNumber(x, y - 15, amount, false, true);
		}
	} else {
		// Yellow stamina number
		spawnDamageNumber(x, y - 15, amount, false, '#FFD700', false);
	}
}

// Phase Shift visual handler (gold flash when nullified hit occurs)
export function phaseShiftUsed(playerNum, x, y) {
	const players = client.getPlayers();
	const player = players.find(p => p.num === playerNum);
	if (player) {
		player.phaseShiftFlashUntil = Date.now() + 500;
	}
}

// Adrenaline visual handler (speed glow when activated)
export function adrenalineActivated(playerNum, durationSec) {
	const players = client.getPlayers();
	const player = players.find(p => p.num === playerNum);
	if (player) {
		player.adrenalineGlowUntil = Date.now() + (durationSec * 1000);
	}
}

// Momentum sound cue handler
export function momentumStart(playerNum) {
	if (soundInitialized) {
		SoundManager.playMomentumSound();
	}
}

// Player kill handler (called from game-client when local player gets a kill)
export function playerKill(killerNum, victimNum, victimName, killType) {
	// Play kill sound (player kills) or lighter enemy death sound
	if (!soundInitialized) return;
	if (killType === "enemy") {
		SoundManager.playEnemyDeathSound(victimName);
	} else {
		SoundManager.playKillSound();
	}
}

// Player was killed handler (called from game-client when local player is killed)
export function playerWasKilled(killerName, killType) {
	lastKillerName = killerName;
}

// Hitscan visual effect handler (called from game-client)
export function hitscan(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor, isCrit, isChain, isExplosion, isBleedTick, isBurnTick) {
	const isBleed = !!isBleedTick || attackType === 'bleed';
	const isBurn = !!isBurnTick || attackType === 'burn';
	const damageColor = isBurn ? (typeColor || '#FF7A1A') : typeColor;
	// Track damage for DPS calculation (only for local player)
	if (user && ownerId === user.num && damage > 0) {
		const now = performance.now();
		damageHistory.push({ time: now, damage: damage });
		totalDamage += damage;
		
		// Remove old entries outside the time window
		const cutoffTime = now - DPS_WINDOW_SECONDS * 1000;
		while (damageHistory.length > 0 && damageHistory[0].time < cutoffTime) {
			totalDamage -= damageHistory[0].damage;
			damageHistory.shift();
		}
		
		// Calculate current DPS
		if (damageHistory.length > 0) {
			const timeSpan = (now - damageHistory[0].time) / 1000;
			currentDPS = timeSpan > 0 ? Math.round(totalDamage / timeSpan) : 0;
		} else {
			currentDPS = 0;
		}
	}
	
	if (isExplosion) {
		spawnExplosionEffect(toX, toY);
		// Show damage number for explosion hits
		if (damage > 0) {
			spawnDamageNumber(toX, toY, damage, isCrit, damageColor, false, false, isBleed);
		}
		return;
	}
	// Chain lightning always shows the animated lightning bolt effect
	if (isChain) {
		spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor, true);
		// Spawn damage number at hit location
		if (damage > 0) {
			spawnDamageNumber(toX, toY, damage, isCrit, damageColor, false, false, isBleed);
		}
		// Chain lightning uses laser impact sound
		if (soundInitialized && user) {
			const dx = toX - user.x;
			const dy = toY - user.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			SoundManager.playProjectileImpact('laser', distance);
		}
		return;
	}
	
	if (attackType === 'laser_aim') {
		spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor);
		return;
	}
	
	if (attackType === 'heal_link') {
		spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor);
		return;
	}
	
	// For actual hitscan weapons (laser, pulse), show the full beam animation
	// For projectile weapons (bullet, railgun, plasma), only show impact effect
	// (the traveling projectile is rendered separately via renderProjectiles())
	const isActualHitscan = attackType === 'laser' || attackType === 'pulse';
	
	if (isActualHitscan) {
		// Full beam animation for hitscan weapons
		spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage, attackType, typeColor);
	} else {
		// For projectiles, spawn impact effect at target location only
		spawnImpactEffect(toX, toY, attackType, typeColor);
	}
	
	// Spawn damage number at hit location
	if (damage > 0) {
		spawnDamageNumber(toX, toY, damage, isCrit, damageColor, false, false, isBleed);
	}
	
	// Play per-attack-type sounds
	if (soundInitialized && user) {
		const isOwnShot = ownerId === user.num;
		const dx = toX - user.x;
		const dy = toY - user.y;
		const impactDistance = Math.sqrt(dx * dx + dy * dy);
		
		if (isActualHitscan) {
			// Hitscan weapons: play both fire and impact sounds
			// Fire sound uses origin position
			const fireDx = fromX - user.x;
			const fireDy = fromY - user.y;
			const fireDistance = Math.sqrt(fireDx * fireDx + fireDy * fireDy);
			SoundManager.playProjectileFire(attackType, fireDistance, isOwnShot);
		}
		
		// All weapons: play impact sound at hit location
		// (projectile fire sounds are triggered on spawn in game-client.js)
		SoundManager.playProjectileImpact(attackType, impactDistance);
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

// ===== DRONE UI EXPORTS =====

export function showDroneUI(choices, droneIndex, droneCount) {
	droneChoices = choices || [];
	droneSlotIndex = droneIndex || 0;
	newDroneCount = droneCount || 1;
	droneUIVisible = true;
	hoveredDrone = -1;
}

export function hideDroneUI() {
	droneUIVisible = false;
	droneChoices = [];
	hoveredDrone = -1;
}

// Game message handler (boss spawn announcement)
export function gameMessage(text, durationSec = 2.5) {
	gameMessageText = text;
	gameMessageStart = Date.now();
	gameMessageUntil = gameMessageStart + (durationSec * 1000);
}

// ===== NEW UPGRADE VISUAL EFFECTS =====

// Missile tracking for rendering
const missilesById = new Map();

export function missileSpawn(id, x, y, vx, vy, ownerId) {
	missilesById.set(id, { id, x, y, vx, vy, ownerId, spawnTime: Date.now() });
}

export function missileUpdate(id, x, y, vx, vy) {
	const missile = missilesById.get(id);
	if (missile) {
		missile.x = x;
		missile.y = y;
		missile.vx = vx;
		missile.vy = vy;
	}
}

export function missileRemove(id) {
	missilesById.delete(id);
}

// Sticky charge detonation effect
const stickyDetonations = [];

export function stickyChargeDetonate(x, y, damage, charges, ownerId) {
	// Track damage for DPS calculation
	if (user && ownerId === user.num && damage > 0) {
		const now = performance.now();
		damageHistory.push({ time: now, damage: damage });
		totalDamage += damage;
		
		const cutoffTime = now - DPS_WINDOW_SECONDS * 1000;
		while (damageHistory.length > 0 && damageHistory[0].time < cutoffTime) {
			totalDamage -= damageHistory[0].damage;
			damageHistory.shift();
		}
	}
	
	stickyDetonations.push({
		x, y, damage, charges,
		spawnTime: Date.now(),
		duration: 400
	});
	// Show damage number for sticky detonation.
	spawnDamageNumber(x, y, damage, false, '#FF6600');
}

// Arc barrage burst effect
const arcBarrageEffects = [];

export function arcBarrageBurst(x, y, radius, playerNum, damage, hitCount, hits = []) {
	// Track damage for DPS calculation
	if (user && playerNum === user.num) {
		const now = performance.now();
		let totalHitDamage = 0;
		
		if (Array.isArray(hits) && hits.length > 0) {
			for (const hit of hits) {
				if (!hit) continue;
				const hitDamage = hit.damage ?? damage;
				totalHitDamage += hitDamage;
			}
		} else {
			// Fallback to damage * hitCount if hits array not provided
			totalHitDamage = damage * hitCount;
		}
		
		if (totalHitDamage > 0) {
			damageHistory.push({ time: now, damage: totalHitDamage });
			totalDamage += totalHitDamage;
			
			const cutoffTime = now - DPS_WINDOW_SECONDS * 1000;
			while (damageHistory.length > 0 && damageHistory[0].time < cutoffTime) {
				totalDamage -= damageHistory[0].damage;
				damageHistory.shift();
			}
		}
	}
	
	arcBarrageEffects.push({
		x, y, radius,
		spawnTime: Date.now(),
		duration: 500  // Longer duration for visibility
	});
	
	// Spawn damage numbers on each hit enemy (if provided by server)
	if (Array.isArray(hits) && hits.length > 0) {
		for (const hit of hits) {
			if (!hit) continue;
			spawnDamageNumber(hit.x, hit.y, hit.damage ?? damage, false, '#00FFFF');
		}
	}
}

// Render missiles (called from main paint)
function renderMissiles(ctx) {
	const now = Date.now();
	for (const [id, missile] of missilesById) {
		const age = now - missile.spawnTime;
		const pulse = 0.8 + 0.2 * Math.sin(age / 50);
		
		// Missile body
		ctx.save();
		ctx.translate(missile.x, missile.y);
		const angle = Math.atan2(missile.vy, missile.vx);
		ctx.rotate(angle);
		
		// Trail
		ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
		ctx.beginPath();
		ctx.moveTo(-15, 0);
		ctx.lineTo(-25, -4);
		ctx.lineTo(-25, 4);
		ctx.closePath();
		ctx.fill();
		
		// Body
		ctx.fillStyle = `rgba(255, 69, 0, ${pulse})`;
		ctx.shadowColor = '#FF4500';
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
		ctx.fill();
		
		// Nose
		ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
		ctx.beginPath();
		ctx.arc(5, 0, 2, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
	}
}

// Render sticky charge detonations
function renderStickyDetonations(ctx) {
	const now = Date.now();
	for (let i = stickyDetonations.length - 1; i >= 0; i--) {
		const det = stickyDetonations[i];
		const elapsed = now - det.spawnTime;
		if (elapsed > det.duration) {
			stickyDetonations.splice(i, 1);
			continue;
		}
		
		const progress = elapsed / det.duration;
		const radius = 30 + progress * 40;
		const alpha = 1 - progress;
		
		ctx.save();
		ctx.globalAlpha = alpha;
		
		// Outer ring
		ctx.strokeStyle = '#FF6600';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(det.x, det.y, radius, 0, Math.PI * 2);
		ctx.stroke();
		
		// Inner flash
		const gradient = ctx.createRadialGradient(det.x, det.y, 0, det.x, det.y, radius * 0.6);
		gradient.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
		gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(det.x, det.y, radius * 0.6, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
	}
}

// Render arc barrage bursts - VERY VISIBLE electric pulse
function renderArcBarrageEffects(ctx) {
	const now = Date.now();
	for (let i = arcBarrageEffects.length - 1; i >= 0; i--) {
		const burst = arcBarrageEffects[i];
		const elapsed = now - burst.spawnTime;
		if (elapsed > burst.duration) {
			arcBarrageEffects.splice(i, 1);
			continue;
		}
		
		const progress = elapsed / burst.duration;
		const expandedRadius = burst.radius * (0.3 + progress * 0.7);
		
		ctx.save();
		
		// Multiple expanding rings for dramatic effect
		for (let ring = 0; ring < 3; ring++) {
			const ringProgress = Math.max(0, progress - ring * 0.15);
			const ringAlpha = Math.max(0, 0.9 - ringProgress * 1.2);
			const ringRadius = expandedRadius * (0.6 + ring * 0.2 + ringProgress * 0.4);
			
			if (ringAlpha <= 0) continue;
			
			ctx.globalAlpha = ringAlpha;
			
			// Bright cyan/white ring
			ctx.strokeStyle = ring === 0 ? '#FFFFFF' : '#00FFFF';
			ctx.lineWidth = (6 - ring * 1.5) * (1 - progress * 0.5);
			ctx.shadowColor = '#00FFFF';
			ctx.shadowBlur = 25;
			ctx.beginPath();
			ctx.arc(burst.x, burst.y, ringRadius, 0, Math.PI * 2);
			ctx.stroke();
		}
		
		// Central flash
		const flashAlpha = Math.max(0, 1 - progress * 2);
		if (flashAlpha > 0) {
			ctx.globalAlpha = flashAlpha * 0.8;
			const flashGradient = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, expandedRadius * 0.5);
			flashGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
			flashGradient.addColorStop(0.3, 'rgba(100, 255, 255, 0.8)');
			flashGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
			ctx.fillStyle = flashGradient;
			ctx.beginPath();
			ctx.arc(burst.x, burst.y, expandedRadius * 0.5, 0, Math.PI * 2);
			ctx.fill();
		}
		
		// Electric arcs (lightning bolts around the ring)
		ctx.globalAlpha = Math.max(0, 0.8 - progress);
		ctx.strokeStyle = '#00FFFF';
		ctx.lineWidth = 2;
		ctx.shadowBlur = 10;
		const arcCount = 8;
		for (let a = 0; a < arcCount; a++) {
			const baseAngle = (a / arcCount) * Math.PI * 2 + progress * 5;
			const arcLen = 15 + Math.sin(now / 50 + a) * 8;
			const startR = expandedRadius * 0.9;
			const endR = expandedRadius * 0.9 + arcLen;
			
			ctx.beginPath();
			ctx.moveTo(
				burst.x + Math.cos(baseAngle) * startR,
				burst.y + Math.sin(baseAngle) * startR
			);
			// Jagged lightning effect
			const midAngle = baseAngle + (Math.random() - 0.5) * 0.3;
			ctx.lineTo(
				burst.x + Math.cos(midAngle) * (startR + arcLen * 0.5),
				burst.y + Math.sin(midAngle) * (startR + arcLen * 0.5)
			);
			ctx.lineTo(
				burst.x + Math.cos(baseAngle) * endR,
				burst.y + Math.sin(baseAngle) * endR
			);
			ctx.stroke();
		}
		
		ctx.restore();
	}
}

// Render Overcharge Core red pulsing aura around player
function renderOverchargeAura(ctx, player) {
	const sizeScale = player.sizeScale || 1.0;
	const radius = PLAYER_RADIUS * sizeScale;
	const time = Date.now() / 1000;
	
	ctx.save();
	
	// Pulsing red aura
	const pulsePhase = (time * 3) % 1;
	const baseAlpha = 0.3 + 0.2 * Math.sin(time * 4);
	
	// Inner burning core
	const innerGlow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, radius * 1.5);
	innerGlow.addColorStop(0, `rgba(255, 50, 50, ${baseAlpha * 0.6})`);
	innerGlow.addColorStop(0.5, `rgba(200, 30, 30, ${baseAlpha * 0.3})`);
	innerGlow.addColorStop(1, 'rgba(150, 20, 20, 0)');
	ctx.fillStyle = innerGlow;
	ctx.beginPath();
	ctx.arc(player.x, player.y, radius * 1.5, 0, Math.PI * 2);
	ctx.fill();
	
	// Expanding pulse ring
	const pulseRadius = radius * (1.2 + pulsePhase * 0.8);
	const pulseAlpha = (1 - pulsePhase) * 0.5;
	ctx.strokeStyle = `rgba(255, 80, 80, ${pulseAlpha})`;
	ctx.lineWidth = 2;
	ctx.shadowColor = '#FF3333';
	ctx.shadowBlur = 10;
	ctx.beginPath();
	ctx.arc(player.x, player.y, pulseRadius, 0, Math.PI * 2);
	ctx.stroke();
	
	// Small red particles floating outward
	const particleCount = 4;
	for (let i = 0; i < particleCount; i++) {
		const angle = (time * 2 + i * Math.PI * 2 / particleCount) % (Math.PI * 2);
		const dist = radius * (0.8 + 0.4 * ((time + i * 0.25) % 1));
		const px = player.x + Math.cos(angle) * dist;
		const py = player.y + Math.sin(angle) * dist;
		const particleAlpha = 0.6 - 0.4 * ((time + i * 0.25) % 1);
		
		ctx.fillStyle = `rgba(255, 100, 100, ${Math.max(0, particleAlpha)})`;
		ctx.beginPath();
		ctx.arc(px, py, 2, 0, Math.PI * 2);
		ctx.fill();
	}
	
	ctx.restore();
}

// Render Heatseeker mini-drones orbiting the player
function renderHeatseekerDrones(ctx, player) {
	const sizeScale = player.sizeScale || 1.0;
	const playerRadius = PLAYER_RADIUS * sizeScale;
	const time = Date.now() / 1000;
	const droneCount = 2; // 2 heatseeker drones
	const orbitRadius = playerRadius * 1.6; // Tight orbit, closer than regular drones
	const droneSize = 5;
	
	ctx.save();
	
	for (let i = 0; i < droneCount; i++) {
		// Each drone orbits at different phase
		const baseAngle = (i / droneCount) * Math.PI * 2;
		const orbitSpeed = consts.DRONE_ORBIT_SPEED || 1.5; // Same speed as regular drones (radians/sec)
		const angle = baseAngle + time * orbitSpeed;
		
		// Slight wobble in orbit
		const wobble = Math.sin(time * 3 + i * 3) * 2;
		const currentOrbitRadius = orbitRadius + wobble;
		
		const droneX = player.x + Math.cos(angle) * currentOrbitRadius;
		const droneY = player.y + Math.sin(angle) * currentOrbitRadius;
		
		// Drone glow
		const glowGradient = ctx.createRadialGradient(droneX, droneY, 0, droneX, droneY, droneSize * 2.5);
		glowGradient.addColorStop(0, 'rgba(0, 255, 136, 0.5)');
		glowGradient.addColorStop(0.5, 'rgba(0, 200, 100, 0.2)');
		glowGradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
		ctx.fillStyle = glowGradient;
		ctx.beginPath();
		ctx.arc(droneX, droneY, droneSize * 2.5, 0, Math.PI * 2);
		ctx.fill();
		
		// Drone body - small triangular shape pointing in orbit direction
		ctx.save();
		ctx.translate(droneX, droneY);
		ctx.rotate(angle + Math.PI / 2); // Point in direction of travel
		
		// Main body (bright green)
		ctx.fillStyle = '#00FF88';
		ctx.shadowColor = '#00FF88';
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.moveTo(0, -droneSize);
		ctx.lineTo(-droneSize * 0.7, droneSize * 0.6);
		ctx.lineTo(droneSize * 0.7, droneSize * 0.6);
		ctx.closePath();
		ctx.fill();
		
		// Inner core (white)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
		ctx.shadowBlur = 0;
		ctx.beginPath();
		ctx.arc(0, 0, droneSize * 0.3, 0, Math.PI * 2);
		ctx.fill();
		
		// Pulsing energy ring
		const pulseAlpha = 0.4 + 0.3 * Math.sin(time * 10 + i * Math.PI);
		ctx.strokeStyle = `rgba(0, 255, 136, ${pulseAlpha})`;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(0, 0, droneSize * 0.8, 0, Math.PI * 2);
		ctx.stroke();
		
		ctx.restore();
		
		// Trail effect
		const trailLength = 3;
		for (let t = 1; t <= trailLength; t++) {
			const trailAngle = angle - (t * 0.08);
			const trailX = player.x + Math.cos(trailAngle) * currentOrbitRadius;
			const trailY = player.y + Math.sin(trailAngle) * currentOrbitRadius;
			const trailAlpha = 0.25 * (1 - t / trailLength);
			const trailSize = droneSize * (1 - t * 0.2);
			
			ctx.fillStyle = `rgba(0, 255, 136, ${trailAlpha})`;
			ctx.beginPath();
			ctx.arc(trailX, trailY, trailSize * 0.4, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	
	ctx.restore();
}

// Export for use in main render
export function renderNewUpgradeEffects(ctx) {
	renderMissiles(ctx);
	renderStickyDetonations(ctx);
	renderArcBarrageEffects(ctx);
}

