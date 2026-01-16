import { encode, decode } from "@msgpack/msgpack";

export const MSG = {
	HELLO: 1,
	HELLO_ACK: 2,
	INIT: 3,
	FRAME: 4,
	INPUT: 5,
	REQUEST: 6,
	VIEWPORT: 7,
	PING: 8,
	PONG: 9,
	DEAD: 10
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
