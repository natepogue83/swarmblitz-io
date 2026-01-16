if (process.argv.length < 3) {
	console.log("Usage: node paper-io-bot.js <socket-url> [<name>]")
	process.exit(1);
}

import { consts } from "./config.js";
import WebSocket from "ws";
import { MSG, encodePacket, decodePacket } from "./src/net/packet.js";

let socket;
let startFrame = -1;
let endFrame = -1;
let user = null;
let players = [];
let frame = 0;

// Bot state
let targetAngle = Math.random() * Math.PI * 2;
let wanderAngle = 0;
let returnToTerritory = false;
let trailLength = 0;

const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
const margin = consts.CELL_WIDTH * 2;

function connect() {
	const prefixes = consts.PREFIXES.split(" ");
	const names = consts.NAMES.split(" ");
	const name = process.argv[3] || [prefixes[Math.floor(Math.random() * prefixes.length)], names[Math.floor(Math.random() * names.length)]].join(" ");
	
	socket = new WebSocket(process.argv[2]);
	socket.binaryType = "arraybuffer";
	
	socket.on("open", () => {
		console.log("Bot connected to server");
		socket.send(encodePacket(MSG.HELLO, {
			name: "[BOT] " + name,
			type: 0,
			gameid: -1,
			god: false
		}));
	});
	
	socket.on("message", (raw) => {
		const [type, data] = decodePacket(raw);
		if (type === MSG.HELLO_ACK) {
			if (!data?.ok) {
				console.error("Failed to join:", data?.error);
				setTimeout(connect, 1000);
			}
			return;
		}
		
		if (type === MSG.INIT) {
			frame = data.frame;
			players = data.players || [];
			
			if (data.num !== undefined) {
				user = players.find(p => p.num === data.num);
				if (user) {
					targetAngle = user.angle || Math.random() * Math.PI * 2;
				}
			}
			
			if (startFrame === -1) startFrame = frame;
			return;
		}
		
		if (type === MSG.FRAME) {
			frame = data.frame;
			endFrame = frame;
			
			if (data.moves) {
				data.moves.forEach(move => {
					const player = players.find(p => p.num === move.num);
					if (player) {
						player.targetAngle = move.targetAngle;
						if (move.left) player.dead = true;
					}
				});
			}
			
			if (data.xpUpdates) {
				data.xpUpdates.forEach(update => {
					if (user && update.num === user.num) {
						user.level = update.level;
						user.xp = update.xp;
						user.sizeScale = update.sizeScale;
						user.droneCount = update.droneCount;
					}
				});
			}
			
			if (data.levelUps) {
				data.levelUps.forEach(levelUp => {
					if (user && levelUp.playerNum === user.num) {
						console.log(`[${new Date()}] Bot leveled up to level ${levelUp.newLevel}!`);
					}
				});
			}
			
			if (data.newPlayers) {
				players.push(...data.newPlayers);
			}
			
			if (user) {
				const updatedUser = players.find(p => p.num === user.num);
				if (updatedUser) {
					simulateMovement(updatedUser);
					user = updatedUser;
				}
			}
			
			updateBot();
			return;
		}
		
		if (type === MSG.DEAD) {
			console.log(`[${new Date()}] I died... (survived for ${endFrame - startFrame} frames.)`);
			socket.close();
			process.exit(0);
		}
	});
	
	socket.on("close", () => {
		if (startFrame !== -1) {
			console.log(`[${new Date()}] Disconnected (survived for ${endFrame - startFrame} frames.)`);
		}
		process.exit(0);
	});
}

function simulateMovement(player) {
	if (!player || player.dead) return;
	
	// Simple simulation of movement
	const turnSpeed = 0.12;
	let angleDiff = (player.targetAngle || 0) - (player.angle || 0);
	
	while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
	while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
	
	if (Math.abs(angleDiff) > turnSpeed) {
		player.angle = (player.angle || 0) + Math.sign(angleDiff) * turnSpeed;
	} else {
		player.angle = player.targetAngle;
	}
	
	player.x = (player.x || 0) + Math.cos(player.angle || 0) * consts.SPEED;
	player.y = (player.y || 0) + Math.sin(player.angle || 0) * consts.SPEED;
	
	// Track trail length
	if (player.trail && player.trail.points) {
		trailLength = player.trail.points.length;
	}
}

function updateBot() {
	if (!user || !socket) return;
	
	const x = user.x || 0;
	const y = user.y || 0;
	
	// Check if we're in our territory
	const inTerritory = isInTerritory(x, y, user.territory);
	
	// Avoid walls
	let avoidAngle = null;
	if (x < margin) {
		avoidAngle = 0; // Go right
	} else if (x > mapSize - margin) {
		avoidAngle = Math.PI; // Go left
	} else if (y < margin) {
		avoidAngle = Math.PI / 2; // Go down
	} else if (y > mapSize - margin) {
		avoidAngle = -Math.PI / 2; // Go up
	}
	
	if (avoidAngle !== null) {
		targetAngle = avoidAngle;
	} else if (inTerritory) {
		// In territory - wander outward to claim more land
		returnToTerritory = false;
		trailLength = 0;
		
		// Random wandering with bias away from center of territory
		wanderAngle += (Math.random() - 0.5) * 0.3;
		targetAngle = wanderAngle;
		
		// Occasionally change direction significantly
		if (Math.random() < 0.02) {
			wanderAngle = Math.random() * Math.PI * 2;
		}
	} else {
		// Outside territory
		trailLength++;
		
		// Return to territory after claiming enough land
		const maxTrailLength = 50 + Math.random() * 100;
		if (trailLength > maxTrailLength || returnToTerritory) {
			returnToTerritory = true;
			
			// Navigate back to territory center
			if (user.territory && user.territory.length > 0) {
				const center = getTerritoryCenter(user.territory);
				targetAngle = Math.atan2(center.y - y, center.x - x);
			} else {
				// No territory, head to center of map
				targetAngle = Math.atan2(mapSize / 2 - y, mapSize / 2 - x);
			}
		} else {
			// Continue wandering
			wanderAngle += (Math.random() - 0.5) * 0.2;
			targetAngle = wanderAngle;
		}
		
		// Avoid other players' trails
		const others = players.filter(p => p.num !== user.num && !p.dead);
		for (const other of others) {
			if (other.trail && other.trail.points) {
				for (const point of other.trail.points) {
					const dist = Math.hypot(point.x - x, point.y - y);
					if (dist < consts.CELL_WIDTH * 3) {
						// Turn away from the trail
						const awayAngle = Math.atan2(y - point.y, x - point.x);
						targetAngle = awayAngle;
						break;
					}
				}
			}
		}
		
		// Avoid own trail
		if (user.trail && user.trail.points) {
			for (let i = 0; i < user.trail.points.length - 10; i++) {
				const point = user.trail.points[i];
				const dist = Math.hypot(point.x - x, point.y - y);
				if (dist < consts.CELL_WIDTH * 2) {
					const awayAngle = Math.atan2(y - point.y, x - point.x);
					targetAngle = awayAngle;
					break;
				}
			}
		}
	}
	
	// Send target angle to server
	socket.send(encodePacket(MSG.INPUT, {
		frame: frame,
		targetAngle: targetAngle
	}));
}

function isInTerritory(x, y, territory) {
	if (!territory || territory.length < 3) return false;
	
	let inside = false;
	for (let i = 0, j = territory.length - 1; i < territory.length; j = i++) {
		const xi = territory[i].x, yi = territory[i].y;
		const xj = territory[j].x, yj = territory[j].y;
		
		if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	return inside;
}

function getTerritoryCenter(territory) {
	if (!territory || territory.length === 0) {
		return { x: mapSize / 2, y: mapSize / 2 };
	}
	
	let cx = 0, cy = 0;
	for (const point of territory) {
		cx += point.x;
		cy += point.y;
	}
	return { x: cx / territory.length, y: cy / territory.length };
}

// Start the bot
connect();
