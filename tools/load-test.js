import WebSocket from "ws";
import { MSG, encodePacket, decodePacket } from "../src/net/packet.js";

const targetCount = parseInt(process.argv[2] || "50", 10);
const url = process.argv[3] || "ws://localhost:8083/ws";
const durationMs = parseInt(process.argv[4] || "30000", 10);

let bytesIn = 0;
let bytesOut = 0;
let connected = 0;
let ready = 0;

const sockets = [];

function trackBytes(data) {
	if (!data) return 0;
	if (Buffer.isBuffer(data)) return data.length;
	if (data.byteLength) return data.byteLength;
	return 0;
}

function spawnBot(idx) {
	const ws = new WebSocket(url);
	ws.binaryType = "arraybuffer";
	
	ws.on("open", () => {
		connected += 1;
		const payload = encodePacket(MSG.HELLO, {
			name: `[LOAD]${idx}`,
			type: 0,
			gameid: -1,
			god: false
		});
		bytesOut += trackBytes(payload);
		ws.send(payload);
	});
	
	ws.on("message", (raw) => {
		bytesIn += trackBytes(raw);
		const [type, data] = decodePacket(raw);
		if (type === MSG.HELLO_ACK) {
			if (!data?.ok) {
				ws.close();
			}
			return;
		}
		if (type === MSG.INIT) {
			ready += 1;
			return;
		}
	});
	
	ws.on("close", () => {
		connected = Math.max(0, connected - 1);
	});
	
	sockets.push(ws);
}

for (let i = 0; i < targetCount; i++) {
	setTimeout(() => spawnBot(i), i * 5);
}

const inputInterval = setInterval(() => {
	for (const ws of sockets) {
		if (ws.readyState !== WebSocket.OPEN) continue;
		const angle = Math.random() * Math.PI * 2;
		const payload = encodePacket(MSG.INPUT, { targetAngle: angle });
		bytesOut += trackBytes(payload);
		ws.send(payload);
	}
}, 250);

setTimeout(() => {
	clearInterval(inputInterval);
	for (const ws of sockets) {
		if (ws.readyState === WebSocket.OPEN) ws.close();
	}
	setTimeout(() => {
		const seconds = durationMs / 1000;
		console.log(`[LOAD] connected=${connected} ready=${ready} inB/s=${(bytesIn / seconds).toFixed(1)} outB/s=${(bytesOut / seconds).toFixed(1)}`);
		process.exit(0);
	}, 1000);
}, durationMs);
