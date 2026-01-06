import jquery from "jquery";
import { Color } from "../core";
import * as client from "../game-client";
import { consts } from "../../config.js";

const SHADOW_OFFSET = 5;
const ANIMATE_FRAMES = 24;
const MIN_BAR_WIDTH = 65;
const BAR_HEIGHT = 45;
const BAR_WIDTH = 400;

let canvas, ctx, offscreenCanvas, offctx, canvasWidth, canvasHeight, gameWidth, gameHeight;
const $ = jquery;

$(() => {
	canvas = $("#main-ui")[0];
	ctx = canvas.getContext("2d");
	offscreenCanvas = document.createElement("canvas");
	offctx = offscreenCanvas.getContext("2d");
	updateSize();
});

let playerPortion, portionsRolling, barProportionRolling, offset, user, zoom, showedDead;

function updateSize() {
	let changed = false;
	if (canvasWidth != window.innerWidth) {
		gameWidth = canvasWidth = offscreenCanvas.width = canvas.width = window.innerWidth;
		changed = true;
	}
	if (canvasHeight != window.innerHeight) {
		gameHeight = canvasHeight = offscreenCanvas.height = canvas.height = window.innerHeight;
		changed = true;
	}
}

function reset() {
	playerPortion = [];
	portionsRolling = [];
	barProportionRolling = [];
	offset = [0, 0];
	user = null;
	// Zoom to fit entire map
	const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT;
	zoom = Math.min(canvasWidth, canvasHeight) / (mapSize + consts.BORDER_WIDTH * 2);
	showedDead = false;
}

reset();

// Paint methods
function paintGridBackground(ctx) {
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	// Background
	ctx.fillStyle = "rgb(211, 225, 237)";
	ctx.fillRect(0, 0, mapSize, mapSize);
	
	// Grid lines (subtle)
	ctx.strokeStyle = "rgba(180, 200, 220, 0.3)";
	ctx.lineWidth = 1;
	const gridSpacing = consts.CELL_WIDTH * 4;
	
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
	ctx.fillStyle = "white";
	ctx.font = "18px Changa";

	// Calculate rank
	const sorted = [];
	client.getPlayers().forEach(val => {
		sorted.push({ player: val, portion: playerPortion[val.num] || 0 });
	});
	sorted.sort((a, b) => {
		return (a.portion === b.portion) ? a.player.num - b.player.num : b.portion - a.portion;
	});

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
		const barSize = Math.ceil((BAR_WIDTH - MIN_BAR_WIDTH) * portion + MIN_BAR_WIDTH);
		const barX = canvasWidth - barSize;
		const barY = BAR_HEIGHT * i;
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

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, gameWidth, gameHeight);
	ctx.clip();

	// Center the map
	const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT + consts.BORDER_WIDTH * 2;
	const offsetX = (gameWidth - mapSize * zoom) / 2;
	const offsetY = (gameHeight - mapSize * zoom) / 2;
	
	ctx.translate(offsetX, offsetY);
	ctx.scale(zoom, zoom);
	ctx.translate(consts.BORDER_WIDTH, consts.BORDER_WIDTH);

	paintGridBackground(ctx);
	
	// Render BankStores
	const bankStores = client.getBankStores();
	for (const store of bankStores) {
		const ownerPlayer = client.getPlayers().find(p => p.num === store.ownerId);
		const storeColor = ownerPlayer ? ownerPlayer.baseColor : null;
		
		ctx.save();
		
		// Store background circle
		ctx.beginPath();
		ctx.arc(store.x, store.y, store.radius, 0, Math.PI * 2);
		if (storeColor) {
			ctx.fillStyle = storeColor.deriveAlpha(0.15).rgbString();
		} else {
			ctx.fillStyle = "rgba(200, 200, 200, 0.15)";
		}
		ctx.fill();
		
		// Store border
		ctx.setLineDash([6, 3]);
		ctx.lineWidth = 2;
		if (storeColor) {
			ctx.strokeStyle = storeColor.deriveAlpha(0.5).rgbString();
		} else {
			ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
		}
		ctx.stroke();
		ctx.setLineDash([]);
		
		// Bank icon
		const iconSize = 16;
		ctx.fillStyle = storeColor ? storeColor.deriveAlpha(0.8).rgbString() : "#FFD700";
		ctx.fillRect(store.x - iconSize/2, store.y - iconSize/4, iconSize, iconSize/2);
		ctx.beginPath();
		ctx.moveTo(store.x - iconSize/2 - 3, store.y - iconSize/4);
		ctx.lineTo(store.x, store.y - iconSize/2 - 6);
		ctx.lineTo(store.x + iconSize/2 + 3, store.y - iconSize/4);
		ctx.closePath();
		ctx.fill();
		
		ctx.restore();
	}
	
	// Render all players
	client.getPlayers().forEach(p => {
		const fr = p.waitLag;
		if (fr < ANIMATE_FRAMES) {
			p.render(ctx, fr / ANIMATE_FRAMES);
		} else {
			p.render(ctx);
		}
	});

	ctx.restore();
	paintUIBar(ctx);

	if ((!user || user.dead) && !showedDead) {
		showedDead = true;
		console.log("Spectating...");
	}
}

function paintDoubleBuff() {
	paint(offctx);
	ctx.drawImage(offscreenCanvas, 0, 0);
}

function update() {
	updateSize();
	
	// Recalculate zoom to fit map
	const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT;
	zoom = Math.min(canvasWidth, canvasHeight) / (mapSize + consts.BORDER_WIDTH * 2);

	// Calculate player portions based on territory area
	const mapArea = mapSize * mapSize;
	client.getPlayers().forEach(player => {
		const area = client.polygonArea(player.territory);
		playerPortion[player.num] = area;
		
		const roll = portionsRolling[player.num];
		if (roll) {
			roll.value = area / mapArea;
			roll.update();
		}
	});
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

export default {
	addPlayer: function(player) {
		playerPortion[player.num] = 0;
		portionsRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
		barProportionRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
	},
	disconnect: function() {
	},
	removePlayer: function(player) {
		delete playerPortion[player.num];
		delete portionsRolling[player.num];
		delete barProportionRolling[player.num];
	},
	setUser: function(player) {
		user = player;
	},
	reset: reset,
	paint: paintDoubleBuff,
	update: update
};
