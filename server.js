// https://github.com/socketio/socket.io/blob/master/examples/chat/index.js
import MiServer from "mimi-server";
import { Server } from "socket.io";
import express from "express";
import path from "path";
import fs from "fs";
import { exec, fork } from "child_process";
import { config } from "./config.js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.VITE) {
	config.dev ? exec("npm run build-dev") : exec("npm run build");
}

const port = process.env.PORT || config.port;

const { app, server } = new MiServer({
	port,
	static: path.join(__dirname, "public")
});

const io = new Server(server);

// ===============================
// Bandwidth logger (server-side)
// ===============================
// This does NOT add bandwidth. It uses existing per-socket byte counters from the underlying TCP socket.
// It should add negligible CPU overhead (a small aggregation once per interval).
const ENABLE_BW_LOG = ["1", "true", "yes", "on"].includes(String(process.env.BW_LOG || "").toLowerCase());
const BW_LOG_INTERVAL_MS = Math.max(250, Number(process.env.BW_LOG_INTERVAL_MS || 1000));
const BW_LOG_TOP_N = Math.max(0, Number(process.env.BW_LOG_TOP_N || 0));

// ANSI color helpers for logs (safe: does not affect bandwidth).
// Disable with NO_COLOR=1 (https://no-color.org/) or BW_LOG_COLOR=off
const BW_LOG_USE_COLOR =
	!["1", "true", "yes", "on"].includes(String(process.env.NO_COLOR || "").toLowerCase()) &&
	!["0", "false", "no", "off"].includes(String(process.env.BW_LOG_COLOR || "").toLowerCase());
const BW_LOG_COLOR = String(process.env.BW_LOG_COLOR || "cyan").toLowerCase();

const ANSI = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m"
};

function bwColorize(s) {
	if (!BW_LOG_USE_COLOR) return s;
	const c =
		BW_LOG_COLOR === "green" ? ANSI.green :
		BW_LOG_COLOR === "yellow" ? ANSI.yellow :
		BW_LOG_COLOR === "magenta" ? ANSI.magenta :
		BW_LOG_COLOR === "blue" ? ANSI.blue :
		ANSI.cyan;
	return `${c}${s}${ANSI.reset}`;
}

function fmtBps(bytesPerSec) {
	if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MiB/s`;
	if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`;
	return `${Math.round(bytesPerSec)} B/s`;
}

function attachBwCounters(socket) {
	// Tries to find the underlying net.Socket when using WebSocket transport (ws).
	// For ws in Node, the TCP socket is usually at `transport.socket._socket`.
	const getNetSocket = () => {
		const conn = socket.conn;
		const transport = conn && conn.transport;
		const ws = transport && transport.socket;
		const net = ws && ws._socket;
		return net || null;
	};

	socket.data = socket.data || {};
	socket.data._bw = {
		getNetSocket,
		inPrev: 0,
		outPrev: 0,
		inBps: 0,
		outBps: 0
	};

	// Initialize baseline counters if possible.
	const net = getNetSocket();
	if (net) {
		socket.data._bw.inPrev = net.bytesRead || 0;
		socket.data._bw.outPrev = net.bytesWritten || 0;
	}
}

if (ENABLE_BW_LOG) {
	setInterval(() => {
		const sockets = Array.from(io.of("/").sockets.values());
		let totalInBps = 0;
		let totalOutBps = 0;

		for (const s of sockets) {
			if (!s.data || !s.data._bw) continue;
			const net = s.data._bw.getNetSocket();
			if (!net) continue;

			const inNow = net.bytesRead || 0;
			const outNow = net.bytesWritten || 0;
			const inDelta = Math.max(0, inNow - (s.data._bw.inPrev || 0));
			const outDelta = Math.max(0, outNow - (s.data._bw.outPrev || 0));

			s.data._bw.inPrev = inNow;
			s.data._bw.outPrev = outNow;

			// Convert interval deltas to bytes/sec
			s.data._bw.inBps = (inDelta * 1000) / BW_LOG_INTERVAL_MS;
			s.data._bw.outBps = (outDelta * 1000) / BW_LOG_INTERVAL_MS;

			totalInBps += s.data._bw.inBps;
			totalOutBps += s.data._bw.outBps;
		}

		const count = sockets.length || 1;
		const avgInBps = totalInBps / count;
		const avgOutBps = totalOutBps / count;
		const players = sockets.length;
		const perPlayerOutBps = players > 0 ? (totalOutBps / players) : 0;
		const perPlayerInBps = players > 0 ? (totalInBps / players) : 0;

		console.log(bwColorize(
			`[BW] players=${players} total_out=${fmtBps(totalOutBps)} total_in=${fmtBps(totalInBps)} per_player_out=${fmtBps(perPlayerOutBps)} per_player_in=${fmtBps(perPlayerInBps)} avg_out=${fmtBps(avgOutBps)} avg_in=${fmtBps(avgInBps)} interval=${BW_LOG_INTERVAL_MS}ms`
		));

		if (BW_LOG_TOP_N > 0 && sockets.length > 0) {
			const top = sockets
				.filter(s => s.data && s.data._bw)
				.sort((a, b) => ((b.data._bw.outBps + b.data._bw.inBps) - (a.data._bw.outBps + a.data._bw.inBps)))
				.slice(0, BW_LOG_TOP_N);

			for (const s of top) {
				const addr =
					(s.handshake && s.handshake.address) ||
					(s.conn && s.conn.remoteAddress) ||
					s.id;
				console.log(bwColorize(`  [BW] ${addr} out=${fmtBps(s.data._bw.outBps)} in=${fmtBps(s.data._bw.inBps)}`));
			}
		}
	}, BW_LOG_INTERVAL_MS);
}

// Routing
app.use("/font", express.static(path.join(__dirname, "node_modules/@fortawesome/fontawesome-free")));

// API endpoint to list music playlist files
app.get("/api/playlist", (req, res) => {
	const playlistDir = path.join(__dirname, "public", "music", "playlist");
	
	fs.readdir(playlistDir, (err, files) => {
		if (err) {
			console.error("Error reading playlist directory:", err);
			return res.json({ tracks: [] });
		}
		
		// Filter for MP3 files only
		const mp3Files = files.filter(file => 
			file.toLowerCase().endsWith('.mp3') || 
			file.toLowerCase().endsWith('.ogg') ||
			file.toLowerCase().endsWith('.wav')
		);
		
		res.json({ tracks: mp3Files });
	});
});

import Game from "./src/game-server.js";
const game = new Game();

io.on("connection", socket => {
	if (ENABLE_BW_LOG) attachBwCounters(socket);
	socket.on("hello", (data, fn) => {
		//TODO: error checking.
		if (data.god && game.addGod(socket)) {
			fn(true);
			return;
		}
		if (data.name && data.name.length > 32) fn(false, "Your name is too long!");
		else if (!game.addPlayer(socket, data.name, data.viewport)) fn(false, "There're too many platers!");
		else fn(true);
	});
	socket.on("pings", (fn) => {
		socket.emit("pongs");
		socket.disconnect();
	});
});

setInterval(() => {
	game.tickFrame();
}, 1000 / 60);

const botProcesses = [];

function spawnBot() {
	const botProcess = fork(path.join(__dirname, "paper-io-bot.js"), [`http://localhost:${port}`], {
		stdio: "inherit"
	});
	
	botProcess.on("exit", (code, signal) => {
		// Remove from array
		const index = botProcesses.indexOf(botProcess);
		if (index > -1) {
			botProcesses.splice(index, 1);
		}
		
		// Respawn bot after a short delay
		setTimeout(() => {
			if (botProcesses.length < parseInt(config.bots)) {
				spawnBot();
			}
		}, 2000);
	});
	
	botProcesses.push(botProcess);
}

// Spawn initial bots
for (let i = 0; i < parseInt(config.bots); i++) {
	setTimeout(() => spawnBot(), i * 500); // Stagger bot spawns
}
