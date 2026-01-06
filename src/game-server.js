import { Color, Player, initPlayer, updateFrame, polygonArea } from "./core/index.js";
import { consts } from "../config.js";

function Game(id) {
	const possColors = Color.possColors();
	let nextInd = 0;
	const players = [];
	const gods = [];
	let newPlayers = [];
	let frame = 0;
	const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	
	this.id = id;
	
	this.addPlayer = (client, name) => {
		if (players.length >= consts.MAX_PLAYERS) return false;
		
		const start = findEmptySpawn(players, mapSize);
		if (!start) return false;
		
		const params = {
			x: start.x,
			y: start.y,
			angle: Math.random() * Math.PI * 2,
			name,
			num: nextInd,
			base: possColors.shift()
		};
		
		const p = new Player(params);
		p.targetAngle = params.angle;
		p.client = client;
		players.push(p);
		newPlayers.push(p);
		nextInd++;
		initPlayer(p);
		
		if (p.name.indexOf("[BOT]") == -1) {
			console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) joined.`);
		}
		
		client.on("requestFrame", () => {
			if (p.frame === frame) return;
			p.frame = frame;
			
			const splayers = players.map(val => val.serialData());
			client.emit("game", {
				"num": p.num,
				"gameid": id,
				"frame": frame,
				"players": splayers
			});
		});
		
		client.on("frame", (data, errorHan) => {
			if (typeof data === "function") {
				errorHan(false, "No data supplied.");
				return;
			}
			if (typeof errorHan !== "function") errorHan = () => {};
			
			if (!data) {
				errorHan(false, "No data supplied.");
			} else if (data.targetAngle !== undefined) {
				if (typeof data.targetAngle === "number" && !isNaN(data.targetAngle)) {
					p.targetAngle = data.targetAngle;
					errorHan(true);
				} else {
					errorHan(false, "Target angle must be a valid number.");
				}
			} else {
				errorHan(true);
			}
		});
		
		client.on("disconnect", () => {
			p.die();
			p.disconnected = true;
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`[${new Date()}] ${p.name || "Unnamed"} (${p.num}) left.`);
			}
		});
		
		return true;
	};
	
	this.addGod = client => {
		const g = {
			client,
			frame
		};
		gods.push(g);
		
		const splayers = players.map(val => val.serialData());
		client.emit("game", {
			"gameid": id,
			"frame": frame,
			"players": splayers
		});
		
		client.on("requestFrame", () => {
			if (g.frame === frame) return;
			g.frame = frame;
			
			const splayers = players.map(val => val.serialData());
			g.client.emit("game", {
				"gameid": id,
				"frame": frame,
				"players": splayers
			});
		});
		
		return true;
	};

	function tick() {
		const splayers = players.map(val => val.serialData());
		const snews = newPlayers.map(val => {
			val.client.emit("game", {
				"num": val.num,
				"gameid": id,
				"frame": frame,
				"players": splayers
			});
			return val.serialData();
		});
		
		const moves = players.map(val => {
			return {
				num: val.num,
				left: !!val.disconnected,
				targetAngle: val.targetAngle
			};
		});
		
		update();
		
		const data = {
			frame: frame + 1,
			moves
		};
		
		if (snews.length > 0) {
			data.newPlayers = snews;
			newPlayers = [];
		}
		
		for (const p of players) {
			p.client.emit("notifyFrame", data);
		}
		for (const g of gods) {
			g.client.emit("notifyFrame", data);
		}
		
		frame++;
	}
	
	this.tickFrame = tick;

	function update() {
		const dead = [];
		updateFrame(players, dead);
		
		for (const p of dead) {
			if (!p.handledDead) {
				possColors.push(p.baseColor);
				p.handledDead = true;
			}
			if (p.name.indexOf("[BOT]") == -1) {
				console.log(`${p.name || "Unnamed"} (${p.num}) died.`);
			}
			p.client.emit("dead");
			p.client.disconnect(true);
		}
	}
}

function findEmptySpawn(players, mapSize) {
	const margin = consts.CELL_WIDTH * 3;
	const minDist = consts.CELL_WIDTH * 5;
	
	// Try to find a spot away from other players
	for (let attempts = 0; attempts < 100; attempts++) {
		const x = margin + Math.random() * (mapSize - margin * 2);
		const y = margin + Math.random() * (mapSize - margin * 2);
		
		let tooClose = false;
		for (const player of players) {
			const dist = Math.hypot(player.x - x, player.y - y);
			if (dist < minDist) {
				tooClose = true;
				break;
			}
		}
		
		if (!tooClose) {
			return { x, y };
		}
	}
	
	// If we can't find empty spot, just return a random position
	return {
		x: margin + Math.random() * (mapSize - margin * 2),
		y: margin + Math.random() * (mapSize - margin * 2)
	};
}

export default Game;
