import jquery from "jquery";
import { Color } from "../core";
import * as client from "../game-client";
import { consts } from "../../config.js";

const SHADOW_OFFSET = 5;
const ANIMATE_FRAMES = 24;
const MIN_BAR_WIDTH = 65;
const BAR_HEIGHT = 45;
const BAR_WIDTH = 400;
const PLAYER_RADIUS = consts.CELL_WIDTH / 2;

let canvas, ctx, offscreenCanvas, offctx, canvasWidth, canvasHeight, gameWidth, gameHeight;
const $ = jquery;

// Death animation system
const deathParticles = [];
let screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
const dyingPlayers = []; // Track players with death animations

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
	
	// Send target angle on every frame
	setInterval(() => {
		client.sendTargetAngle();
	}, 1000 / 60);
});

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

	// Coins HUD
	ctx.fillStyle = "#FFD700"; // Gold color
	const unbankedText = "Unbanked: " + (user.unbankedCoins || 0);
	const bankedText = "Banked: " + (user.bankedCoins || 0);
	const coinOffset = killsOffset + ctx.measureText(killsText).width + 30;
	ctx.fillText(unbankedText, coinOffset, BAR_HEIGHT - 15);
	ctx.fillText(bankedText, coinOffset + ctx.measureText(unbankedText).width + 30, BAR_HEIGHT - 15);

	// Stamina bar
	const staminaWidth = 120;
	const staminaHeight = 20;
	const staminaX = coinOffset + ctx.measureText(unbankedText).width + ctx.measureText(bankedText).width + 90;
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
	ctx.font = "bold 12px Changa";
	ctx.textAlign = "center";
	ctx.fillText(user.isExhausted ? "EXHAUSTED" : "STAMINA", staminaX + staminaWidth / 2, staminaY + staminaHeight - 5);
	ctx.textAlign = "left"; // Reset alignment

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
	ctx.fillText(rankText, staminaX + staminaWidth + 20, BAR_HEIGHT - 15);

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
	
	// Render all players
	client.getPlayers().forEach(p => {
		const fr = p.waitLag;
		const dissolve = getDyingPlayerEffect(p);
		
		if (dissolve > 0) {
			// Player is dying - apply dissolve effect
			ctx.globalAlpha = Math.max(0, 1 - dissolve);
		}
		
		if (fr < ANIMATE_FRAMES) {
			p.render(ctx, fr / ANIMATE_FRAMES);
		} else {
			p.render(ctx);
		}
		
		ctx.globalAlpha = 1;
	});
	
	// Render death particles
	renderDeathParticles(ctx);

	// Reset transform for fixed UI
	ctx.restore();
	paintUIBar(ctx);

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
			// Explosive burst particles
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
			// Fast sparks
			const angle = Math.random() * Math.PI * 2;
			const speed = 8 + Math.random() * 12;
			this.vx = Math.cos(angle) * speed;
			this.vy = Math.sin(angle) * speed;
			this.size = 2 + Math.random() * 3;
			this.life = 1;
			this.decay = 0.04 + Math.random() * 0.03;
			this.trail = [];
		} else if (type === 'ring') {
			// Expanding ring
			this.radius = 5;
			this.maxRadius = 80 + Math.random() * 40;
			this.expandSpeed = 4 + Math.random() * 2;
			this.life = 1;
			this.decay = 0.025;
			this.lineWidth = 8;
		} else if (type === 'shard') {
			// Territory shards
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
			// Store trail position
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
			
			// Draw as a small square/diamond
			ctx.fillStyle = this.color;
			ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
			
			// Glow effect
			ctx.shadowColor = this.color;
			ctx.shadowBlur = 10 * alpha;
			ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
			
			ctx.restore();
		} else if (this.type === 'spark') {
			// Draw trail
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
			
			// Draw head
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

function spawnDeathEffect(player, isUser = false) {
	const x = player.x;
	const y = player.y;
	const color = player.baseColor.rgbString();
	const lightColor = player.lightBaseColor.rgbString();
	
	// Burst particles (main explosion)
	const burstCount = isUser ? 40 : 25;
	for (let i = 0; i < burstCount; i++) {
		deathParticles.push(new DeathParticle(x, y, color, 'burst'));
	}
	
	// Sparks (fast moving)
	const sparkCount = isUser ? 20 : 12;
	for (let i = 0; i < sparkCount; i++) {
		deathParticles.push(new DeathParticle(x, y, lightColor, 'spark'));
	}
	
	// Expanding rings
	deathParticles.push(new DeathParticle(x, y, color, 'ring'));
	if (isUser) {
		setTimeout(() => {
			deathParticles.push(new DeathParticle(x, y, lightColor, 'ring'));
		}, 100);
	}
	
	// Territory shards (if player has territory)
	if (player.territory && player.territory.length > 3) {
		const shardCount = isUser ? 15 : 8;
		for (let i = 0; i < shardCount; i++) {
			// Spawn shards from random points along territory
			const idx = Math.floor(Math.random() * player.territory.length);
			const pt = player.territory[idx];
			deathParticles.push(new DeathParticle(pt.x, pt.y, color, 'shard'));
		}
	}
	
	// Screen shake for user death
	if (isUser) {
		screenShake.intensity = 25;
	}
	
	// Track dying player for dissolve effect
	dyingPlayers.push({
		player: player,
		deathTime: Date.now(),
		dissolveProgress: 0
	});
}

function updateDeathEffects() {
	// Update particles
	for (let i = deathParticles.length - 1; i >= 0; i--) {
		if (!deathParticles[i].update()) {
			deathParticles.splice(i, 1);
		}
	}
	
	// Update screen shake
	if (screenShake.intensity > 0.5) {
		screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
		screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
		screenShake.intensity *= screenShake.decay;
	} else {
		screenShake.x = 0;
		screenShake.y = 0;
		screenShake.intensity = 0;
	}
	
	// Update dying players
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
	// Trigger death animation
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
