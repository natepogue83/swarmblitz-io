import http from "http";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import Game from "./src/game-server.js";
import { MSG, encodePacket, decodePacket } from "./src/net/packet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.VITE) {
	config.dev ? exec("npm run build-dev") : exec("npm run build");
}

const port = process.env.PORT || config.port;
const wsPath = config.wsPath || "/ws";
const isProd = config.prod || process.env.NODE_ENV === "production";
const simRate = config.serverTickRate || config.fps || 60;
const netRate = config.netTickRate || simRate;
const enableMetrics = !!process.env.BW_LOG;

const staticRoot = path.join(__dirname, "public");
const fontRoot = path.join(__dirname, "node_modules/@fortawesome/fontawesome-free");
const playlistDir = path.join(__dirname, "public", "music", "playlist");

const mimeTypes = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav",
	".json": "application/json"
};

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return mimeTypes[ext] || "application/octet-stream";
}

function safeJoin(base, target) {
	const targetPath = path.normalize(path.join(base, target));
	if (!targetPath.startsWith(base)) {
		return null;
	}
	return targetPath;
}

function serveFile(res, filePath) {
	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404);
			res.end("Not found");
			return;
		}
		res.writeHead(200, { "Content-Type": getMimeType(filePath) });
		res.end(data);
	});
}

function serveStatic(res, baseDir, urlPath) {
	const sanitized = urlPath === "/" ? "/index.html" : urlPath;
	const filePath = safeJoin(baseDir, decodeURIComponent(sanitized));
	if (!filePath) {
		res.writeHead(400);
		res.end("Bad path");
		return;
	}
	fs.stat(filePath, (err, stats) => {
		if (err || !stats.isFile()) {
			res.writeHead(404);
			res.end("Not found");
			return;
		}
		serveFile(res, filePath);
	});
}

const game = new Game();

const metrics = {
	bytesIn: 0,
	bytesOut: 0,
	simMs: 0,
	netMs: 0,
	connected: 0
};

function sendPacket(ws, type, payload) {
	const data = encodePacket(type, payload);
	metrics.bytesOut += data.length || data.byteLength || 0;
	ws.send(data);
}

function makeClient(ws) {
	return {
		sendPacket: (type, payload) => sendPacket(ws, type, payload),
		close: () => ws.close()
	};
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const pathname = url.pathname;
	
	if (pathname === "/api/playlist") {
		fs.readdir(playlistDir, (err, files) => {
			if (err) {
				console.error("Error reading playlist directory:", err);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ tracks: [] }));
				return;
			}
			
			const tracks = files.filter(file =>
				file.toLowerCase().endsWith(".mp3") ||
				file.toLowerCase().endsWith(".ogg") ||
				file.toLowerCase().endsWith(".wav")
			);
			
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ tracks }));
		});
		return;
	}
	
	if (pathname.startsWith("/font/")) {
		const urlPath = pathname.replace("/font", "");
		serveStatic(res, fontRoot, urlPath);
		return;
	}
	
	serveStatic(res, staticRoot, pathname);
});

const wss = new WebSocketServer({
	noServer: true,
	perMessageDeflate: true,
	maxPayload: 16 * 1024 * 1024
});

server.on("upgrade", (req, socket, head) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	if (url.pathname !== wsPath) {
		socket.destroy();
		return;
	}
	wss.handleUpgrade(req, socket, head, (ws) => {
		wss.emit("connection", ws, req);
	});
});

wss.on("connection", (ws) => {
	ws.client = makeClient(ws);
	metrics.connected += 1;
	
	ws.on("message", (message) => {
		metrics.bytesIn += message.byteLength || 0;
		let decoded;
		try {
			decoded = decodePacket(message);
		} catch (err) {
			console.warn("Failed to decode packet:", err);
			return;
		}
		const [type, payload] = decoded;
		
		if (type === MSG.PING) {
			sendPacket(ws, MSG.PONG);
			return;
		}
		
		if (type === MSG.HELLO) {
			const name = payload?.name;
			
			if (name && name.length > 32) {
				sendPacket(ws, MSG.HELLO_ACK, { ok: false, error: "Your name is too long!" });
				return;
			}
			
			const result = game.addPlayer(ws.client, name);
			if (!result.ok) {
				sendPacket(ws, MSG.HELLO_ACK, { ok: false, error: result.error || "Unable to join." });
				return;
			}
			
			ws.player = result.player;
			sendPacket(ws, MSG.HELLO_ACK, { ok: true });
			game.sendFullState(ws.player);
			return;
		}
		
		if (type === MSG.INPUT && ws.player) {
			game.handleInput(ws.player, payload);
			return;
		}
		
		if (type === MSG.UPGRADE_PICK && ws.player) {
			const upgradeId = payload?.upgradeId;
			if (upgradeId) {
				game.handleUpgradePick(ws.player, upgradeId);
			}
			return;
		}
		
		if (type === MSG.DRONE_PICK && ws.player) {
			const droneTypeId = payload?.droneTypeId;
			if (droneTypeId) {
				game.handleDronePick(ws.player, droneTypeId);
			}
			return;
		}
		
		if (type === MSG.PAUSE && ws.player) {
			const paused = payload?.paused;
			if (paused !== undefined) {
				game.handlePause(ws.player, paused);
			}
			return;
		}
		
		if (type === MSG.DEV_CMD && ws.player) {
			// Dev commands for testing (only in dev mode)
			game.handleDevCommand(ws.player, payload);
			return;
		}
		
		if (type === MSG.REQUEST) {
			if (ws.player) game.sendFullState(ws.player);
		}
	});
	
	ws.on("close", () => {
		if (ws.player) {
			game.handleDisconnect(ws.player);
		}
		metrics.connected = Math.max(0, metrics.connected - 1);
	});
});

server.listen(port, () => {
	console.log(`Server listening on ${port}`);
});

const simIntervalMs = 1000 / simRate;
const netIntervalMs = 1000 / netRate;
const simDeltaSeconds = 1 / simRate;

setInterval(() => {
	const start = performance.now();
	game.tickSim(simDeltaSeconds);
	metrics.simMs += performance.now() - start;
}, simIntervalMs);

setInterval(() => {
	const start = performance.now();
	game.flushFrame();
	metrics.netMs += performance.now() - start;
}, netIntervalMs);

if (enableMetrics) {
	setInterval(() => {
		const bytesOutPerSec = (metrics.bytesOut / 5).toFixed(1);
		const bytesInPerSec = (metrics.bytesIn / 5).toFixed(1);
		console.log(`[METRICS] players=${metrics.connected} simMs/5s=${metrics.simMs.toFixed(1)} netMs/5s=${metrics.netMs.toFixed(1)} outB/s=${bytesOutPerSec} inB/s=${bytesInPerSec}`);
		metrics.bytesOut = 0;
		metrics.bytesIn = 0;
		metrics.simMs = 0;
		metrics.netMs = 0;
	}, 5000);
}

