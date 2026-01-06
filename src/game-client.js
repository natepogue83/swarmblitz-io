import { Player, initPlayer, updateFrame, polygonArea } from "./core/index.js";
import { consts } from "../config.js";

let running = false;
let user, socket, frame;
let players, allPlayers;
let coinsById = new Map();
let kills;
let timeout = undefined;
let dirty = false;
let deadFrames = 0;
let requesting = -1;
let frameCache = [];
let _allowAnimation = true;
let renderer;
let mouseX = 0, mouseY = 0;
let lastScreenX = 0, lastScreenY = 0;
let lastZoom = 1;
let mouseSet = false;
let viewOffset = { x: 0, y: 0 };

let requestAnimationFrame;
try {
	requestAnimationFrame = window.requestAnimationFrame;
} catch {
	requestAnimationFrame = callback => { setTimeout(callback, 1000 / 30) };
}

// Public API
function connectGame(io, url, name, callback, flag) {
	if (running) return;
	running = true;
	user = null;
	deadFrames = 0;
	
	const prefixes = consts.PREFIXES.split(" ");
	const names = consts.NAMES.split(" ");
	name = name || [prefixes[Math.floor(Math.random() * prefixes.length)], names[Math.floor(Math.random() * names.length)]].join(" ");
	
	io.j = [];
	io.sockets = [];
	socket = io(url, {
		"forceNew": true,
		upgrade: false,
		transports: ["websocket"]
	});
	
	socket.on("connect", () => {
		console.info("Connected to server.");
	});
	
	socket.on("game", data => {
		if (timeout != undefined) clearTimeout(timeout);
		
		frame = data.frame;
		reset();
		
		// Load coins
		if (data.coins) {
			data.coins.forEach(c => coinsById.set(c.id, c));
		}

		// Load players
		data.players.forEach(p => {
			const pl = new Player(p);
			addPlayer(pl);
			if (!p.territory || p.territory.length === 0) {
				initPlayer(pl);
			}
		});
		
		user = allPlayers[data.num];
		setUser(user);
		
		invokeRenderer("paint", []);
		frame = data.frame;
		
		if (requesting !== -1) {
			const minFrame = requesting;
			requesting = -1;
			while (frameCache.length > frame - minFrame) {
				processFrame(frameCache[frame - minFrame]);
			}
			frameCache = [];
		}
	});
	
	socket.on("notifyFrame", processFrame);
	
	socket.on("dead", () => {
		socket.disconnect();
	});
	
	socket.on("disconnect", () => {
		console.info("Server has disconnected. Creating new game.");
		socket.disconnect();
		if (!user) return;
		user.die();
		dirty = true;
		paintLoop();
		running = false;
		invokeRenderer("disconnect", []);
	});
	
	socket.emit("hello", {
		name: name,
		type: 0,
		gameid: -1,
		god: flag
	}, (success, msg) => {
		if (success) console.info("Connected to game!");
		else {
			console.error("Unable to connect to game: " + msg);
			running = false;
		}
		if (callback) callback(success, msg);
	});
}

function updateMousePosition(clientX, clientY, canvasRect, canvasWidth, canvasHeight, zoom) {
	if (!user) return;
	
	// Store screen position and zoom for continuous updates
	lastScreenX = clientX - canvasRect.left;
	const screenY = clientY - canvasRect.top;
	
	const BAR_HEIGHT = 45;
	lastScreenY = screenY - BAR_HEIGHT;
	lastZoom = zoom;
	mouseSet = true;
	
	// Convert to world coordinates
	mouseX = (lastScreenX / lastZoom) + viewOffset.x;
	mouseY = (lastScreenY / lastZoom) + viewOffset.y;
}

function setViewOffset(x, y) {
	viewOffset.x = x;
	viewOffset.y = y;
}

function updateZoom(zoom) {
	lastZoom = zoom;
}

function sendTargetAngle() {
	if (!user || user.dead || !socket || !mouseSet) return;
	
	// Update world mouse position based on last screen position and current view offset.
	// This ensures the target world point moves with the camera if the mouse is stationary,
	// effectively making the mouse a direction vector relative to the screen center.
	mouseX = (lastScreenX / lastZoom) + viewOffset.x;
	mouseY = (lastScreenY / lastZoom) + viewOffset.y;

	// Calculate angle from player to mouse position
	const dx = mouseX - user.x;
	const dy = mouseY - user.y;
	
	// If mouse is too close to player center, don't update angle to avoid "shaking" or tight circles.
	// 10 pixels is a reasonable threshold.
	if (dx * dx + dy * dy < 100) return;
	
	const targetAngle = Math.atan2(dy, dx);
	
	socket.emit("frame", {
		frame: frame,
		targetAngle: targetAngle
	}, (success, msg) => {
		if (!success) console.error(msg);
	});
}

function getUser() {
	return user;
}

function getPlayers() {
	return players.slice();
}

function getOthers() {
	const ret = [];
	for (const p of players) {
		if (p !== user) ret.push(p);
	}
	return ret;
}

function getCoins() {
	return Array.from(coinsById.values());
}

function disconnect() {
	socket.disconnect();
	running = false;
}

// Private API
function addPlayer(player) {
	if (allPlayers[player.num]) return;
	allPlayers[player.num] = players[players.length] = player;
	invokeRenderer("addPlayer", [player]);
	return players.length - 1;
}

function invokeRenderer(name, args) {
	if (renderer && typeof renderer[name] === "function") {
		renderer[name].apply(null, args);
	}
}

function processFrame(data) {
	if (timeout != undefined) clearTimeout(timeout);
	
	if (requesting !== -1 && requesting < data.frame) {
		frameCache.push(data);
		return;
	}
	
	if (data.frame - 1 !== frame) {
		console.error("Frames don't match up!");
		socket.emit("requestFrame");
		requesting = data.frame;
		frameCache.push(data);
		return;
	}
	
	frame++;
	
	// Handle economy deltas
	if (data.coinSpawns) {
		data.coinSpawns.forEach(c => coinsById.set(c.id, c));
	}
	if (data.coinRemovals) {
		data.coinRemovals.forEach(id => coinsById.delete(id));
	}
	if (data.coinTotals) {
		data.coinTotals.forEach(update => {
			const p = allPlayers[update.num];
			if (p) {
				p.unbankedCoins = update.unbankedCoins;
				p.bankedCoins = update.bankedCoins;
			}
		});
	}

	if (data.newPlayers) {
		data.newPlayers.forEach(p => {
			if (user && p.num === user.num) return;
			const pl = new Player(p);
			addPlayer(pl);
			initPlayer(pl);
		});
	}
	
	const found = new Array(players.length);
	data.moves.forEach((val, i) => {
		const player = allPlayers[val.num];
		if (!player) return;
		if (val.left) player.die();
		found[i] = true;
		player.targetAngle = val.targetAngle;
	});
	
	for (let i = 0; i < players.length; i++) {
		if (!found[i]) {
			const player = players[i];
			player && player.die();
		}
	}
	
	update();
	
	dirty = true;
	requestAnimationFrame(paintLoop);
	
	timeout = setTimeout(() => {
		console.warn("Server has timed-out. Disconnecting.");
		socket.disconnect();
	}, 3000);
}

function paintLoop() {
	if (!dirty) return;
	invokeRenderer("paint", []);
	dirty = false;
	
	if (user && user.dead) {
		if (timeout) clearTimeout(timeout);
		if (deadFrames === 60) {
			const before = _allowAnimation;
			_allowAnimation = false;
			update();
			invokeRenderer("paint", []);
			_allowAnimation = before;
			user = null;
			deadFrames = 0;
			return;
		}
		socket.disconnect();
		deadFrames++;
		dirty = true;
		update();
		requestAnimationFrame(paintLoop);
	}
}

function reset() {
	user = null;
	players = [];
	allPlayers = [];
	coinsById.clear();
	kills = 0;
	invokeRenderer("reset");
}

function setUser(player) {
	user = player;
	invokeRenderer("setUser", [player]);
}

function update() {
	const dead = [];
	updateFrame(players, dead, (killer, other) => {
		if (players[killer] === user && killer !== other) kills++;
	});
	
	dead.forEach(val => {
		console.log((val.name || "Unnamed") + " is dead");
		delete allPlayers[val.num];
		invokeRenderer("removePlayer", [val]);
	});
	
	invokeRenderer("update", [frame]);
}

function setRenderer(r) {
	renderer = r;
}

function setAllowAnimation(allow) {
	_allowAnimation = allow;
}

function getKills() {
	return kills;
}

// Export stuff
export { 
	connectGame, 
	getUser, 
	getPlayers, 
	getOthers, 
	getCoins,
	disconnect, 
	setRenderer, 
	setAllowAnimation, 
	getKills,
	updateMousePosition,
	sendTargetAngle,
	setViewOffset,
	updateZoom,
	polygonArea
};

export const allowAnimation = {
	get: function() {
		return _allowAnimation;
	},
	set: function(val) {
		_allowAnimation = !!val;
	},
	enumerable: true
};
