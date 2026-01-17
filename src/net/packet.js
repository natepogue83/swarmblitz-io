import { encode, decode } from "@msgpack/msgpack";

export const MSG = {
	HELLO: 1,
	HELLO_ACK: 2,
	INIT: 3,
	FRAME: 4,
	INPUT: 5,
	REQUEST: 6,
	PING: 8,
	PONG: 9,
	DEAD: 10,
	UPGRADE_OFFER: 11,   // Server -> Client: 3 upgrade choices
	UPGRADE_PICK: 12,    // Client -> Server: selected upgrade ID
	DRONE_OFFER: 13,     // Server -> Client: 3 drone type choices
	DRONE_PICK: 14,      // Client -> Server: selected drone type ID
	PAUSE: 15,           // Client -> Server: pause/unpause game (for settings menu)
	DEV_CMD: 16          // Client -> Server: dev console command (give xp, upgrades, etc.)
};

export function encodePacket(type, payload) {
	return encode([type, payload]);
}

export function decodePacket(data) {
	if (data instanceof ArrayBuffer) {
		return decode(new Uint8Array(data));
	}
	if (ArrayBuffer.isView(data)) {
		return decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
	}
	return decode(new Uint8Array(data));
}
