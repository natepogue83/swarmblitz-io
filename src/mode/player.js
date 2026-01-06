import jquery from "jquery";
import { Color } from "../core";
import * as client from "../game-client";
import { consts } from "../../config.js";

// Drone rendering constants
const DRONE_VISUAL_RADIUS = consts.DRONE_RADIUS || 10;

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

// Bank meter tweening
const BANK_TWEEN_DURATION = 0.4;

let canvas, ctx, offscreenCanvas, offctx, canvasWidth, canvasHeight, gameWidth, gameHeight;
const $ = jquery;

// Track if user is near their bank store
let userNearStore = false;

// Death animation system
const deathParticles = [];
let screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
const dyingPlayers = []; // Track players with death animations

// Loot coin animation system
const lootCoins = []; // Animated coins dropping from deaths

// Projectile hit effects
const projectileHitEffects = [];

// Capture feedback effects
const captureEffects = [];

// Bank meter tweening state
const bankMeterTween = {
	startValue: 0,
	targetValue: 0,
	currentValue: 0,
	startTime: 0,
	duration: BANK_TWEEN_DURATION * 1000
};

// Local player outline thickening state
let localOutlineThicken = {
	active: false,
	startTime: 0,
	duration: 500 // ms
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
	
	// Keyboard input for upgrade selection (1/2/3)
	window.addEventListener("keydown", handleKeyDown);
	
	// Mouse click for upgrade selection
	canvas.addEventListener("click", handleClick);
	
	// Send target angle on every frame
	setInterval(() => {
		client.sendTargetAngle();
	}, 1000 / 60);
});

function handleKeyDown(e) {
	const user = client.getUser();
	if (!user) return;
	
	// Handle upgrade selection (1/2/3) when choosing
	if (user.isChoosingUpgrade && user.upgradeOptions && user.upgradeOptions.length > 0) {
		const key = e.key;
		if (key >= "1" && key <= "3") {
			const idx = parseInt(key) - 1;
			if (idx < user.upgradeOptions.length) {
				const upgrade = user.upgradeOptions[idx];
				client.chooseUpgrade(upgrade.id, (success, msg) => {
					if (success) {
						console.log("Upgrade selected:", upgrade.name);
					} else {
						console.log("Upgrade selection failed:", msg);
					}
				});
			}
		}
	}
	
	// Handle drone purchase (B key) when near home base
	if (e.key === 'b' || e.key === 'B') {
		if (userNearStore) {
			client.buyDrone((success, msg) => {
				if (success) {
					console.log("Drone purchased!");
				} else {
					console.log("Drone purchase failed:", msg);
				}
			});
		}
	}
}

function handleClick(e) {
	const user = client.getUser();
	if (!user || !user.isChoosingUpgrade || !user.upgradeOptions) return;
	
	// Check if click is on one of the upgrade cards
	const rect = canvas.getBoundingClientRect();
	const clickX = e.clientX - rect.left;
	const clickY = e.clientY - rect.top;
	
	// Card dimensions (must match paintUpgradeModal)
	const cardWidth = 200;
	const cardHeight = 140;
	const cardGap = 30;
	const numCards = user.upgradeOptions.length;
	const totalWidth = numCards * cardWidth + (numCards - 1) * cardGap;
	const startX = (canvasWidth - totalWidth) / 2;
	const cardY = (canvasHeight - cardHeight) / 2;
	
	for (let i = 0; i < numCards; i++) {
		const cardX = startX + i * (cardWidth + cardGap);
		if (clickX >= cardX && clickX <= cardX + cardWidth &&
			clickY >= cardY && clickY <= cardY + cardHeight) {
			const upgrade = user.upgradeOptions[i];
			client.chooseUpgrade(upgrade.id, (success, msg) => {
				if (success) {
					console.log("Upgrade selected:", upgrade.name);
				} else {
					console.log("Upgrade selection failed:", msg);
				}
			});
			break;
		}
	}
}

function handleMouseMove(e) {
	const rect = canvas.getBoundingClientRect();
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
	
	// Clear death effects
	deathParticles.length = 0;
	dyingPlayers.length = 0;
	screenShake.intensity = 0;
	screenShake.x = 0;
	screenShake.y = 0;
	
	// Clear loot coin animations
	lootCoins.length = 0;
	
	// Clear projectile hit effects
	projectileHitEffects.length = 0;
	
	// Clear capture effects
	captureEffects.length = 0;
	
	// Reset bank meter tween
	bankMeterTween.startValue = 0;
	bankMeterTween.targetValue = 0;
	bankMeterTween.currentValue = 0;
	bankMeterTween.startTime = 0;
	
	// Reset outline thickening
	localOutlineThicken.active = false;
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
	// UI Bar background
	ctx.fillStyle = "#24422c";
	ctx.fillRect(0, 0, canvasWidth, BAR_HEIGHT);

	let barOffset;
	ctx.fillStyle = "white";
	ctx.font = "24px Changa";
	barOffset = (user && user.name) ? (ctx.measureText(user.name).width + 20) : 0;
	ctx.fillText(user ? user.name : "", 5, BAR_HEIGHT - 15);

	// Draw filled bar background
	ctx.fillStyle = "rgba(180, 180, 180, .3)";
	ctx.fillRect(barOffset, 0, BAR_WIDTH, BAR_HEIGHT);

	const userPortions = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
	let barSize = Math.ceil((BAR_WIDTH - MIN_BAR_WIDTH) * userPortions + MIN_BAR_WIDTH);
	ctx.fillStyle = user ? user.baseColor.rgbString() : "";
	ctx.fillRect(barOffset, 0, barSize, BAR_HEIGHT - SHADOW_OFFSET);
	ctx.fillStyle = user ? user.shadowColor.rgbString() : "";
	ctx.fillRect(barOffset, BAR_HEIGHT - SHADOW_OFFSET, barSize, SHADOW_OFFSET);

	// Percentage
	ctx.fillStyle = "white";
	ctx.font = "18px Changa";
	ctx.fillText((userPortions * 100).toFixed(3) + "%", 5 + barOffset, BAR_HEIGHT - 15);

	// Number of kills
	const killsText = "Kills: " + client.getKills();
	const killsOffset = 20 + BAR_WIDTH + barOffset;
	ctx.fillText(killsText, killsOffset, BAR_HEIGHT - 15);

	// Bank Meter HUD (Archero-style)
	const bankProgress = user.bankProgress || 0;
	const bankTarget = user.bankTarget || consts.BANK_BASE_TARGET;
	const bankLevel = user.bankLevel || 0;
	const coins = user.coins || 0;
	
	// Bank meter bar
	const bankBarWidth = 150;
	const bankBarHeight = 20;
	const bankBarX = killsOffset + ctx.measureText(killsText).width + 30;
	const bankBarY = (BAR_HEIGHT - bankBarHeight) / 2;
	
	// Background
	ctx.fillStyle = "rgba(50, 50, 50, 0.7)";
	ctx.fillRect(bankBarX, bankBarY, bankBarWidth, bankBarHeight);
	
	// Progress fill with smooth tweening
	const tweenedProgress = updateBankMeterTween(bankProgress);
	const progressRatio = Math.min(1, tweenedProgress / bankTarget);
	const gradient = ctx.createLinearGradient(bankBarX, 0, bankBarX + bankBarWidth, 0);
	gradient.addColorStop(0, "#FFD700");
	gradient.addColorStop(1, "#FFA500");
	ctx.fillStyle = gradient;
	ctx.fillRect(bankBarX, bankBarY, bankBarWidth * progressRatio, bankBarHeight);
	
	// Flash effect when close to full
	if (progressRatio > 0.8) {
		const time = Date.now() / 200;
		const pulse = 0.1 + 0.1 * Math.sin(time * 3);
		ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
		ctx.fillRect(bankBarX, bankBarY, bankBarWidth * progressRatio, bankBarHeight);
	}
	
	// Border
	ctx.strokeStyle = "#FFD700";
	ctx.lineWidth = 2;
	ctx.strokeRect(bankBarX, bankBarY, bankBarWidth, bankBarHeight);
	
	// Bank text
	ctx.fillStyle = "#FFFFFF";
	ctx.font = "bold 12px Changa";
	ctx.textAlign = "center";
	ctx.fillText(`${bankProgress}/${bankTarget}`, bankBarX + bankBarWidth / 2, bankBarY + bankBarHeight - 5);
	ctx.textAlign = "left";
	
	// Level indicator
	ctx.fillStyle = "#FFD700";
	ctx.font = "bold 14px Changa";
	ctx.fillText(`Lv.${bankLevel}`, bankBarX + bankBarWidth + 10, BAR_HEIGHT - 15);
	
	// Coins in pocket
	const coinsText = `💰 ${coins}`;
	ctx.fillStyle = "#FFD700";
	ctx.font = "16px Changa";
	ctx.fillText(coinsText, bankBarX + bankBarWidth + 60, BAR_HEIGHT - 15);
	
	// Drone count indicator
	const droneCount = user.droneCount || 1;
	const maxDrones = consts.MAX_DRONES || 6;
	const droneText = `🛸 ${droneCount}/${maxDrones}`;
	ctx.fillStyle = "#88CCFF";
	ctx.font = "14px Changa";
	ctx.fillText(droneText, bankBarX + bankBarWidth + 115, BAR_HEIGHT - 15);

	// Stamina bar
	const staminaWidth = 100;
	const staminaHeight = 18;
	const staminaX = bankBarX + bankBarWidth + 180;
	const staminaY = (BAR_HEIGHT - staminaHeight) / 2;

	// Background
	ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
	ctx.fillRect(staminaX, staminaY, staminaWidth, staminaHeight);

	// Foreground (Stamina)
	const staminaRatio = (user.stamina || 0) / (user.maxStamina || 100);
	if (user.isExhausted) {
		ctx.fillStyle = "#ff4444"; // Red when exhausted
	} else if (staminaRatio < 0.3) {
		ctx.fillStyle = "#ffcc00"; // Yellow when low
	} else {
		ctx.fillStyle = "#44ff44"; // Green normally
	}
	ctx.fillRect(staminaX, staminaY, staminaWidth * staminaRatio, staminaHeight);

	// Stamina Text
	ctx.fillStyle = "white";
	ctx.font = "bold 10px Changa";
	ctx.textAlign = "center";
	ctx.fillText(user.isExhausted ? "EXHAUSTED" : "STAMINA", staminaX + staminaWidth / 2, staminaY + staminaHeight - 4);
	ctx.textAlign = "left";

	// Calculate rank
	const sorted = [];
	client.getPlayers().forEach(val => {
		sorted.push({ player: val, portion: playerPortion[val.num] || 0 });
	});
	sorted.sort((a, b) => {
		return (a.portion === b.portion) ? a.player.num - b.player.num : b.portion - a.portion;
	});

	const rank = sorted.findIndex(val => val.player === user);
	const rankText = "Rank: " + (rank === -1 ? "--" : rank + 1) + " of " + sorted.length;
	ctx.font = "16px Changa";
	ctx.fillStyle = "white";
	ctx.fillText(rankText, staminaX + staminaWidth + 15, BAR_HEIGHT - 15);

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
		barSize = Math.ceil((BAR_WIDTH - MIN_BAR_WIDTH) * portion + MIN_BAR_WIDTH);
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

function paintUpgradeModal(ctx) {
	if (!user || !user.isChoosingUpgrade || !user.upgradeOptions || user.upgradeOptions.length === 0) return;
	
	// Darken background
	ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	
	// Title
	ctx.fillStyle = "#FFD700";
	ctx.font = "bold 36px Changa";
	ctx.textAlign = "center";
	ctx.fillText("⬆️ LEVEL UP! ⬆️", canvasWidth / 2, 100);
	
	ctx.fillStyle = "#FFFFFF";
	ctx.font = "20px Changa";
	ctx.fillText("Choose an upgrade:", canvasWidth / 2, 140);
	
	// Draw upgrade cards
	const cardWidth = 200;
	const cardHeight = 140;
	const cardGap = 30;
	const numCards = user.upgradeOptions.length;
	const totalWidth = numCards * cardWidth + (numCards - 1) * cardGap;
	const startX = (canvasWidth - totalWidth) / 2;
	const cardY = (canvasHeight - cardHeight) / 2;
	
	for (let i = 0; i < numCards; i++) {
		const upgrade = user.upgradeOptions[i];
		const cardX = startX + i * (cardWidth + cardGap);
		
		// Card background
		ctx.fillStyle = "rgba(30, 50, 40, 0.95)";
		ctx.strokeStyle = "#FFD700";
		ctx.lineWidth = 3;
		
		// Rounded rectangle
		const radius = 12;
		ctx.beginPath();
		ctx.moveTo(cardX + radius, cardY);
		ctx.lineTo(cardX + cardWidth - radius, cardY);
		ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
		ctx.lineTo(cardX + cardWidth, cardY + cardHeight - radius);
		ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - radius, cardY + cardHeight);
		ctx.lineTo(cardX + radius, cardY + cardHeight);
		ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - radius);
		ctx.lineTo(cardX, cardY + radius);
		ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		
		// Key indicator (1/2/3)
		ctx.fillStyle = "#FFD700";
		ctx.font = "bold 24px monospace";
		ctx.textAlign = "center";
		ctx.fillText(`[${i + 1}]`, cardX + cardWidth / 2, cardY + 30);
		
		// Upgrade name
		ctx.fillStyle = "#FFFFFF";
		ctx.font = "bold 16px Changa";
		ctx.fillText(upgrade.name, cardX + cardWidth / 2, cardY + 60);
		
		// Description (wrap if needed)
		ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
		ctx.font = "12px Changa";
		const desc = upgrade.description || "";
		const words = desc.split(" ");
		let line = "";
		let lineY = cardY + 85;
		const maxLineWidth = cardWidth - 20;
		
		for (const word of words) {
			const testLine = line + word + " ";
			if (ctx.measureText(testLine).width > maxLineWidth) {
				ctx.fillText(line.trim(), cardX + cardWidth / 2, lineY);
				line = word + " ";
				lineY += 14;
			} else {
				line = testLine;
			}
		}
		if (line.trim()) {
			ctx.fillText(line.trim(), cardX + cardWidth / 2, lineY);
		}
		
		// Click hint
		ctx.fillStyle = "rgba(255, 215, 0, 0.6)";
		ctx.font = "10px Changa";
		ctx.fillText("Click or press key", cardX + cardWidth / 2, cardY + cardHeight - 10);
	}
	
	ctx.textAlign = "left";
}

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

	// Render coins
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
	
	// Render BankStores
	const bankStores = client.getBankStores();
	for (const store of bankStores) {
		const isOwner = user && store.ownerId === user.num;
		const ownerPlayer = client.getPlayers().find(p => p.num === store.ownerId);
		const storeColor = ownerPlayer ? ownerPlayer.baseColor : null;
		
		// Draw store circle
		ctx.save();
		
		// Outer glow for owner's store
		if (isOwner) {
			const time = Date.now() / 1000;
			const pulse = 0.6 + 0.4 * Math.sin(time * 2);
			ctx.shadowBlur = 20 * pulse;
			ctx.shadowColor = "#FFD700";
		}
		
		// Store background circle
		ctx.beginPath();
		ctx.arc(store.x, store.y, store.radius, 0, Math.PI * 2);
		if (storeColor) {
			ctx.fillStyle = storeColor.deriveAlpha(isOwner ? 0.3 : 0.1).rgbString();
		} else {
			ctx.fillStyle = isOwner ? "rgba(255, 215, 0, 0.3)" : "rgba(200, 200, 200, 0.1)";
		}
		ctx.fill();
		
		// Store border
		ctx.setLineDash([8, 4]);
		ctx.lineWidth = isOwner ? 4 : 2;
		ctx.strokeStyle = isOwner ? "#FFD700" : "rgba(200, 200, 200, 0.4)";
		ctx.stroke();
		ctx.setLineDash([]);
		
		ctx.shadowBlur = 0;
		
		// Draw bank icon (simple building shape)
		const iconSize = 24;
		ctx.fillStyle = isOwner ? "#FFD700" : (storeColor ? storeColor.deriveAlpha(0.7).rgbString() : "#888");
		
		// Building base
		ctx.fillRect(store.x - iconSize/2, store.y - iconSize/4, iconSize, iconSize/2);
		
		// Roof (triangle)
		ctx.beginPath();
		ctx.moveTo(store.x - iconSize/2 - 6, store.y - iconSize/4);
		ctx.lineTo(store.x, store.y - iconSize/2 - 10);
		ctx.lineTo(store.x + iconSize/2 + 6, store.y - iconSize/4);
		ctx.closePath();
		ctx.fill();
		
		// Pillars
		ctx.fillStyle = isOwner ? "#DAA520" : "#666";
		ctx.fillRect(store.x - iconSize/3, store.y - iconSize/4, 5, iconSize/2);
		ctx.fillRect(store.x + iconSize/3 - 5, store.y - iconSize/4, 5, iconSize/2);
		
		// "BANK" text label
		ctx.fillStyle = isOwner ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)";
		ctx.font = "bold 14px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		const progressText = ownerPlayer ? `${ownerPlayer.bankProgress}/${ownerPlayer.bankTarget}` : "BANK";
		ctx.fillText(progressText, store.x, store.y + iconSize/4 + 10);
		
		// Owner indicator + deposit hint
		if (isOwner) {
			ctx.fillStyle = "#FFD700";
			ctx.font = "bold 11px Arial";
			ctx.fillText("DEPOSIT HERE", store.x, store.y + iconSize/4 + 26);
			
			// Check if user is near store to show drone purchase UI
			const distToStore = Math.hypot(user.x - store.x, user.y - store.y);
			if (distToStore < store.radius) {
				// Show drone purchase info
				const droneCount = user.droneCount || 1;
				const maxDrones = consts.MAX_DRONES || 6;
				
				if (droneCount < maxDrones) {
					const droneCost = client.getDroneNextCost(droneCount);
					const canAfford = (user.coins || 0) >= droneCost;
					
					ctx.font = "bold 12px Arial";
					ctx.fillStyle = canAfford ? "#66FF66" : "#FF6666";
					ctx.fillText(`[B] Buy Drone (${droneCost} coins)`, store.x, store.y + iconSize/4 + 42);
					ctx.fillStyle = "#FFFFFF";
					ctx.font = "10px Arial";
					ctx.fillText(`Drones: ${droneCount}/${maxDrones}`, store.x, store.y + iconSize/4 + 56);
				} else {
					ctx.font = "bold 10px Arial";
					ctx.fillStyle = "#888888";
					ctx.fillText(`Max Drones (${maxDrones}/${maxDrones})`, store.x, store.y + iconSize/4 + 42);
				}
			}
		}
		
		ctx.restore();
	}
	
	// Render turrets
	const turrets = client.getTurrets();
	for (const turret of turrets) {
		renderTurret(ctx, turret);
	}
	
	// Render projectiles
	const projectiles = client.getProjectiles();
	for (const proj of projectiles) {
		renderProjectile(ctx, proj);
	}
	
	// Render projectile hit effects
	renderProjectileHitEffects(ctx);
	
	// Render drones
	renderAllDrones(ctx);
	
	// Render capture effects (pulse rings, particles, coins text)
	renderCaptureEffects(ctx);
	
	// Get all players sorted by num for consistent z-ordering
	// This ensures overlapping territories always show the same owner
	const allPlayers = client.getPlayers().slice().sort((a, b) => a.num - b.num);
	
	// FIRST PASS: Render all territories in sorted order (for overlap resolution)
	// Territories rendered later will be on top, giving consistent ownership at overlap points
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
		
		// Get outline thickness (thicker for local player after capture)
		const outlineThickness = getOutlineThickness(p);
		
		// Render territory fill and outline
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
	
	// SECOND PASS: Render all territory outlines (on top of all fills)
	// This prevents outline overlap-blur by drawing all outlines after all fills
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
	
	// THIRD PASS: Render player bodies, trails, and other per-player visuals
	for (const p of allPlayers) {
		const fr = p.waitLag;
		const dissolve = getDyingPlayerEffect(p);
		
		if (dissolve > 0) {
			ctx.globalAlpha = Math.max(0, 1 - dissolve);
		}
		
		// Draw "choosing" indicator for players selecting upgrades
		if (p.isChoosingUpgrade) {
			ctx.save();
			const time = Date.now() / 500;
			const pulse = 0.5 + 0.5 * Math.sin(time * 3);
			ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.5 * pulse})`;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(p.x, p.y, PLAYER_RADIUS + 8 + 4 * pulse, 0, Math.PI * 2);
			ctx.stroke();
			
			// "CHOOSING" text above player
			ctx.fillStyle = "#FFD700";
			ctx.font = "bold 10px Arial";
			ctx.textAlign = "center";
			ctx.fillText("CHOOSING...", p.x, p.y - PLAYER_RADIUS - 25);
			ctx.restore();
		}
		
		const outlineThickness = getOutlineThickness(p);
		
		// Render player (skip territory since we rendered it separately)
		if (fr < ANIMATE_FRAMES) {
			p.renderBody(ctx, fr / ANIMATE_FRAMES);
		} else {
			p.renderBody(ctx, 1);
		}
		
		// Render HP bar above player (only if damaged)
		if (p.hp !== undefined && p.hp < p.maxHp) {
			renderPlayerHpBar(ctx, p);
		}
		
		ctx.globalAlpha = 1;
	}
	
	// Render death particles
	renderDeathParticles(ctx);

	// Reset transform for fixed UI
	ctx.restore();
	paintUIBar(ctx);
	
	// Check if user is near their bank store
	userNearStore = false;
	if (user && !user.dead) {
		const bankStores = client.getBankStores();
		const userStore = bankStores.find(s => s.ownerId === user.num);
		if (userStore) {
			const dist = Math.hypot(user.x - userStore.x, user.y - userStore.y);
			if (dist < userStore.radius) {
				userNearStore = true;
			}
		}
	}
	
	// Draw upgrade selection modal if choosing
	if (user && user.isChoosingUpgrade) {
		paintUpgradeModal(ctx);
	}

	if ((!user || user.dead) && !showedDead) {
		showedDead = true;
		console.log("You died!");
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

	// Zoom goes from 1 to .5 as territory grows
	if (user && portionsRolling[user.num]) {
		zoom = 1 / (portionsRolling[user.num].lag * 10 + 1);
		zoom = Math.max(0.3, Math.min(1, zoom));
		client.updateZoom(zoom);
	}
	
	if (user) centerOnPlayer(user, animateTo);
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

// ===== TURRET RENDERING =====

function renderTurret(ctx, turret) {
	const ownerPlayer = client.getPlayers().find(p => p.num === turret.ownerId);
	const baseColor = ownerPlayer ? ownerPlayer.baseColor : null;
	const isUserTurret = user && turret.ownerId === user.num;
	const turretRadius = consts.TURRET_RADIUS || 18;
	
	ctx.save();
	
	// Ring-based size scaling (ring 1 = bigger)
	const sizeMultiplier = turret.ringIndex === 1 ? 1.2 : (turret.ringIndex === 2 ? 1.0 : 0.85);
	const radius = turretRadius * sizeMultiplier;
	
	// Shadow
	ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
	ctx.beginPath();
	ctx.arc(turret.x + 3, turret.y + 3, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Base color (owner's color or gray)
	if (baseColor) {
		ctx.fillStyle = baseColor.deriveAlpha(isUserTurret ? 0.9 : 0.7).rgbString();
	} else {
		ctx.fillStyle = isUserTurret ? "rgba(100, 150, 100, 0.9)" : "rgba(150, 150, 150, 0.7)";
	}
	
	// Turret body (hexagon for visual interest)
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
		const x = turret.x + Math.cos(angle) * radius;
		const y = turret.y + Math.sin(angle) * radius;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.fill();
	
	// Border (thicker for stronger turrets)
	ctx.strokeStyle = baseColor ? baseColor.deriveLumination(-0.2).rgbString() : "#555";
	ctx.lineWidth = turret.ringIndex === 1 ? 3 : (turret.ringIndex === 2 ? 2 : 1.5);
	ctx.stroke();
	
	// Inner detail - targeting reticle
	if (turret.targetId !== null) {
		// Turret is targeting - show active indicator
		const time = Date.now() / 200;
		const pulse = 0.5 + 0.5 * Math.sin(time * 4);
		ctx.strokeStyle = `rgba(255, 100, 100, ${0.5 + 0.5 * pulse})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(turret.x, turret.y, radius * 0.5, 0, Math.PI * 2);
		ctx.stroke();
	} else {
		// Idle indicator
		ctx.fillStyle = baseColor ? baseColor.deriveLumination(0.2).rgbString() : "#888";
		ctx.beginPath();
		ctx.arc(turret.x, turret.y, radius * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
	
	// Ring indicator (small dots for ring level)
	ctx.fillStyle = isUserTurret ? "#FFD700" : "#AAA";
	const dotRadius = 3;
	const dotDist = radius + 8;
	for (let i = 0; i < turret.ringIndex; i++) {
		const angle = -Math.PI / 2 + (i - (turret.ringIndex - 1) / 2) * 0.4;
		const dx = turret.x + Math.cos(angle) * dotDist;
		const dy = turret.y + Math.sin(angle) * dotDist;
		ctx.beginPath();
		ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
		ctx.fill();
	}
	
	// HP bar (only show if damaged)
	if (turret.hp < turret.maxHp) {
		const barWidth = radius * 2;
		const barHeight = 4;
		const barX = turret.x - barWidth / 2;
		const barY = turret.y - radius - 10;
		
		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fillRect(barX, barY, barWidth, barHeight);
		
		// HP fill
		const hpRatio = turret.hp / turret.maxHp;
		if (hpRatio > 0.5) {
			ctx.fillStyle = "#44ff44";
		} else if (hpRatio > 0.25) {
			ctx.fillStyle = "#ffcc00";
		} else {
			ctx.fillStyle = "#ff4444";
		}
		ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
	}
	
	ctx.restore();
}

function renderPlayerHpBar(ctx, player) {
	const barWidth = PLAYER_RADIUS * 2.5;
	const barHeight = 5;
	const barX = player.x - barWidth / 2;
	const barY = player.y - PLAYER_RADIUS - 35; // Above name
	
	// Background
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
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
	
	// Border
	ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
	ctx.lineWidth = 1;
	ctx.strokeRect(barX, barY, barWidth, barHeight);
}

// ===== PROJECTILE RENDERING =====

function renderProjectile(ctx, proj) {
	const ownerPlayer = client.getPlayers().find(p => p.num === proj.ownerId);
	const baseColor = ownerPlayer ? ownerPlayer.baseColor : null;
	const radius = proj.radius || (consts.PROJECTILE_RADIUS || 6);
	
	ctx.save();
	
	// Calculate direction for trail effect
	const speed = Math.hypot(proj.vx, proj.vy);
	const dirX = proj.vx / speed;
	const dirY = proj.vy / speed;
	
	// Trail (motion blur effect)
	const trailLength = 15;
	const gradient = ctx.createLinearGradient(
		proj.x - dirX * trailLength, 
		proj.y - dirY * trailLength,
		proj.x, 
		proj.y
	);
	
	if (baseColor) {
		gradient.addColorStop(0, baseColor.deriveAlpha(0).rgbString());
		gradient.addColorStop(1, baseColor.deriveAlpha(0.8).rgbString());
	} else {
		gradient.addColorStop(0, 'rgba(255, 200, 100, 0)');
		gradient.addColorStop(1, 'rgba(255, 200, 100, 0.8)');
	}
	
	ctx.strokeStyle = gradient;
	ctx.lineWidth = radius * 1.5;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(proj.x - dirX * trailLength, proj.y - dirY * trailLength);
	ctx.lineTo(proj.x, proj.y);
	ctx.stroke();
	
	// Outer glow
	ctx.shadowBlur = 10;
	ctx.shadowColor = baseColor ? baseColor.rgbString() : '#FFA500';
	
	// Main projectile body
	if (baseColor) {
		ctx.fillStyle = baseColor.deriveLumination(0.2).rgbString();
	} else {
		ctx.fillStyle = '#FFCC00';
	}
	ctx.beginPath();
	ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Inner bright core
	ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
	ctx.beginPath();
	ctx.arc(proj.x, proj.y, radius * 0.5, 0, Math.PI * 2);
	ctx.fill();
	
	ctx.restore();
}

// ===== PROJECTILE HIT EFFECTS =====

class ProjectileHitEffect {
	constructor(x, y, damage) {
		this.x = x;
		this.y = y;
		this.damage = damage;
		this.spawnTime = Date.now();
		this.duration = 300; // ms
		this.life = 1;
		
		// Particles
		this.particles = [];
		const numParticles = 6 + Math.floor(damage / 5);
		for (let i = 0; i < numParticles; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 4;
			this.particles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				size: 2 + Math.random() * 3,
				life: 1
			});
		}
	}
	
	update() {
		const elapsed = Date.now() - this.spawnTime;
		this.life = 1 - (elapsed / this.duration);
		
		// Update particles
		for (const p of this.particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vx *= 0.95;
			p.vy *= 0.95;
			p.life = this.life;
		}
		
		return this.life > 0;
	}
	
	render(ctx) {
		if (this.life <= 0) return;
		
		ctx.save();
		
		// Impact flash
		const flashSize = 20 * this.life;
		const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, flashSize);
		gradient.addColorStop(0, `rgba(255, 255, 200, ${this.life})`);
		gradient.addColorStop(0.4, `rgba(255, 150, 50, ${this.life * 0.6})`);
		gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(this.x, this.y, flashSize, 0, Math.PI * 2);
		ctx.fill();
		
		// Particles
		ctx.fillStyle = `rgba(255, 200, 100, ${this.life})`;
		for (const p of this.particles) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
		}
		
		ctx.restore();
	}
}

function spawnProjectileHitEffect(x, y, damage) {
	projectileHitEffects.push(new ProjectileHitEffect(x, y, damage));
}

function updateProjectileHitEffects() {
	for (let i = projectileHitEffects.length - 1; i >= 0; i--) {
		if (!projectileHitEffects[i].update()) {
			projectileHitEffects.splice(i, 1);
		}
	}
}

function renderProjectileHitEffects(ctx) {
	for (const effect of projectileHitEffects) {
		effect.render(ctx);
	}
}

// ===== DRONE RENDERING =====

function renderDrone(ctx, drone, ownerPlayer, isUserDrone) {
	const x = drone.x;
	const y = drone.y;
	const radius = DRONE_VISUAL_RADIUS;
	const baseColor = ownerPlayer ? ownerPlayer.baseColor : null;
	
	ctx.save();
	
	// Shadow
	ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
	ctx.beginPath();
	ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Outer glow when targeting
	if (drone.targetId !== null) {
		const time = Date.now() / 150;
		const pulse = 0.4 + 0.3 * Math.sin(time * 4);
		ctx.shadowBlur = 12 * pulse;
		ctx.shadowColor = isUserDrone ? '#FFD700' : (baseColor ? baseColor.rgbString() : '#FF6600');
	}
	
	// Main body - filled circle
	if (baseColor) {
		ctx.fillStyle = baseColor.deriveAlpha(isUserDrone ? 0.95 : 0.8).rgbString();
	} else {
		ctx.fillStyle = isUserDrone ? "rgba(100, 200, 100, 0.95)" : "rgba(200, 100, 100, 0.8)";
	}
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	
	// Border
	ctx.strokeStyle = baseColor ? baseColor.deriveLumination(-0.2).rgbString() : "#444";
	ctx.lineWidth = 2;
	ctx.stroke();
	
	ctx.shadowBlur = 0;
	
	// Inner core (highlight)
	ctx.fillStyle = baseColor ? baseColor.deriveLumination(0.3).deriveAlpha(0.7).rgbString() : "rgba(255, 255, 255, 0.5)";
	ctx.beginPath();
	ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
	ctx.fill();
	
	// Targeting indicator (small dot when active)
	if (drone.targetId !== null) {
		const time = Date.now() / 100;
		const pulse = 0.5 + 0.5 * Math.sin(time * 5);
		ctx.fillStyle = `rgba(255, 100, 100, ${0.6 + 0.4 * pulse})`;
		ctx.beginPath();
		ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
	
	// HP bar (only show if damaged)
	if (drone.hp < drone.maxHp) {
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

// ===== CAPTURE FEEDBACK EFFECT SYSTEM =====

class CaptureEffect {
	constructor(x, y, coinsGained, player, isLocalPlayer) {
		this.x = x;
		this.y = y;
		this.coinsGained = coinsGained;
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
		
		// Render coins earned text
		if (this.textAlpha > 0 && this.coinsGained > 0) {
			ctx.save();
			ctx.globalAlpha = this.textAlpha;
			ctx.fillStyle = '#FFD700';
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.lineWidth = 3;
			ctx.font = 'bold 18px Changa';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			
			const text = `+${this.coinsGained} 💰`;
			ctx.strokeText(text, this.x, this.textY);
			ctx.fillText(text, this.x, this.textY);
			ctx.restore();
		}
		
		ctx.globalAlpha = 1;
	}
}

function spawnCaptureEffect(x, y, coinsGained, player, isLocalPlayer) {
	captureEffects.push(new CaptureEffect(x, y, coinsGained, player, isLocalPlayer));
}

// Turret capture effect - simpler burst effect
class TurretCaptureEffect {
	constructor(x, y, newOwner) {
		this.x = x;
		this.y = y;
		this.newOwner = newOwner;
		this.spawnTime = Date.now();
		this.color = newOwner ? newOwner.baseColor : null;
		
		// Burst particles
		this.particles = [];
		for (let i = 0; i < 20; i++) {
			const angle = (i / 20) * Math.PI * 2;
			const speed = 3 + Math.random() * 4;
			this.particles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				size: 4 + Math.random() * 4,
				life: 1
			});
		}
		
		// Ring effect
		this.ringRadius = 10;
		this.ringMaxRadius = 60;
	}
	
	update() {
		const elapsed = (Date.now() - this.spawnTime) / 1000;
		const progress = Math.min(1, elapsed / 0.6);
		
		// Update ring
		this.ringRadius = 10 + (this.ringMaxRadius - 10) * progress;
		
		// Update particles
		for (const p of this.particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vx *= 0.94;
			p.vy *= 0.94;
			p.life = 1 - progress;
		}
		
		return progress < 1;
	}
	
	render(ctx) {
		const elapsed = (Date.now() - this.spawnTime) / 1000;
		const progress = Math.min(1, elapsed / 0.6);
		const alpha = 1 - progress;
		
		const colorStr = this.color ? this.color.rgbString() : '#00FF00';
		
		// Ring
		ctx.save();
		ctx.strokeStyle = this.color ? this.color.deriveAlpha(alpha * 0.8).rgbString() : `rgba(0, 255, 0, ${alpha * 0.8})`;
		ctx.lineWidth = 3 * alpha;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.ringRadius, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
		
		// Particles
		for (const p of this.particles) {
			if (p.life <= 0) continue;
			ctx.save();
			ctx.globalAlpha = p.life;
			ctx.fillStyle = colorStr;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
		
		// "CAPTURED!" text
		if (alpha > 0.3) {
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = colorStr;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
			ctx.lineWidth = 3;
			ctx.font = 'bold 14px Changa';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.strokeText('CAPTURED!', this.x, this.y - 30);
			ctx.fillText('CAPTURED!', this.x, this.y - 30);
			ctx.restore();
		}
		
		ctx.globalAlpha = 1;
	}
}

// Store turret capture effects in the capture effects array for simplicity
function spawnTurretCaptureEffect(x, y, newOwner) {
	captureEffects.push(new TurretCaptureEffect(x, y, newOwner));
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

// Update bank meter tween
function updateBankMeterTween(currentProgress) {
	if (bankMeterTween.targetValue !== currentProgress) {
		// New target value - start a new tween
		bankMeterTween.startValue = bankMeterTween.currentValue;
		bankMeterTween.targetValue = currentProgress;
		bankMeterTween.startTime = Date.now();
	}
	
	const elapsed = Date.now() - bankMeterTween.startTime;
	const progress = Math.min(1, elapsed / bankMeterTween.duration);
	
	// Ease out quad
	const eased = progress * (2 - progress);
	bankMeterTween.currentValue = bankMeterTween.startValue + (bankMeterTween.targetValue - bankMeterTween.startValue) * eased;
	
	return bankMeterTween.currentValue;
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
	
	// Update projectile hit effects
	updateProjectileHitEffects();
	
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

// Projectile hit visual effect handler (called from game-client)
export function projectileHit(x, y, damage) {
	spawnProjectileHitEffect(x, y, damage);
}

// Capture success visual effect handler (called from game-client)
export function captureSuccess(x, y, coinsGained, player, isLocalPlayer) {
	spawnCaptureEffect(x, y, coinsGained, player, isLocalPlayer);
}

// Turret captured visual effect handler (called from game-client)
export function turretCaptured(x, y, newOwner) {
	spawnTurretCaptureEffect(x, y, newOwner);
}
