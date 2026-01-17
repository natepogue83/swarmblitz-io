import Game from "./game-server.js";
import { MSG } from "./net/packet.js";
import { config } from "../config.js";

/**
 * LocalSession provides a WebSocket-like interface for client-side game simulation.
 * Instead of network communication, it routes messages directly to a local Game instance
 * using plain JS objects (no serialization) for maximum performance.
 */
export class LocalSession {
	constructor() {
		this.readyState = 0; // CONNECTING
		this.binaryType = "arraybuffer"; // Match WebSocket API
		this._listeners = {
			open: [],
			message: [],
			close: [],
			error: []
		};
		
		// Create local game instance
		this.game = new Game(-1); // Local game ID
		this.player = null;
		
		// Simulation timers
		this.simInterval = null;
		this.netInterval = null;
		
		// Client interface for Game to send packets back
		this.clientInterface = {
			sendPacket: (type, payload) => {
				// Direct object passing - no encode/decode
				this._emitMessage(type, payload);
			},
			close: () => {
				this.close();
			}
		};
	}
	
	/**
	 * Start the local session (mimic WebSocket open)
	 */
	connect() {
		// Simulate async connection
		setTimeout(() => {
			this.readyState = 1; // OPEN
			this._emit('open', {});
		}, 0);
	}
	
	/**
	 * Send a message to the local Game
	 * @param {ArrayBuffer|Uint8Array|Object} data - Raw message data or [type, payload] tuple
	 */
	send(data) {
		if (this.readyState !== 1) {
			console.warn("LocalSession: Cannot send, not connected");
			return;
		}
		
		// Expect [type, payload] tuple (no msgpack encoding)
		if (!Array.isArray(data) || data.length !== 2) {
			console.error("LocalSession: Invalid message format", data);
			return;
		}
		
		const [type, payload] = data;
		
		// Route to appropriate Game handler
		switch (type) {
			case MSG.PING:
				this.clientInterface.sendPacket(MSG.PONG, null);
				break;
			
			case MSG.HELLO: {
				const name = payload?.name;
				const result = this.game.addPlayer(this.clientInterface, name);
				if (!result.ok) {
					this.clientInterface.sendPacket(MSG.HELLO_ACK, { 
						ok: false, 
						error: result.error || "Unable to join." 
					});
					return;
				}
				this.player = result.player;
				this.clientInterface.sendPacket(MSG.HELLO_ACK, { ok: true });
				this.game.sendFullState(this.player);
				
				// Start simulation loops after player joins
				this._startSimulation();
				break;
			}
			
			case MSG.INPUT:
				if (this.player) {
					this.game.handleInput(this.player, payload);
				}
				break;
			
			case MSG.UPGRADE_PICK:
				if (this.player && payload?.upgradeId) {
					this.game.handleUpgradePick(this.player, payload.upgradeId);
				}
				break;
			
			case MSG.DRONE_PICK:
				if (this.player && payload?.droneTypeId) {
					this.game.handleDronePick(this.player, payload.droneTypeId);
				}
				break;
			
			case MSG.PAUSE:
				if (this.player && payload?.paused !== undefined) {
					this.game.handlePause(this.player, payload.paused);
				}
				break;
			
			case MSG.DEV_CMD:
				if (this.player && payload) {
					this.game.handleDevCommand(this.player, payload);
				}
				break;
			
			case MSG.REQUEST:
				if (this.player) {
					this.game.sendFullState(this.player);
				}
				break;
			
			default:
				console.warn("LocalSession: Unknown message type", type);
		}
	}
	
	/**
	 * Close the session
	 */
	close() {
		if (this.readyState === 3) return; // Already closed
		
		this.readyState = 3; // CLOSED
		this._stopSimulation();
		
		if (this.player) {
			this.game.handleDisconnect(this.player);
			this.player = null;
		}
		
		this._emit('close', {});
	}
	
	/**
	 * Add event listener (WebSocket-compatible API)
	 */
	addEventListener(event, callback) {
		if (this._listeners[event]) {
			this._listeners[event].push(callback);
		}
	}
	
	/**
	 * Remove event listener
	 */
	removeEventListener(event, callback) {
		if (this._listeners[event]) {
			const index = this._listeners[event].indexOf(callback);
			if (index !== -1) {
				this._listeners[event].splice(index, 1);
			}
		}
	}
	
	// Private methods
	
	_emit(event, data) {
		const listeners = this._listeners[event] || [];
		listeners.forEach(callback => {
			try {
				callback(data);
			} catch (err) {
				console.error(`LocalSession: Error in ${event} listener:`, err);
			}
		});
	}
	
	_emitMessage(type, payload) {
		// Send as plain object tuple (no encoding) for performance
		this._emit('message', {
			data: [type, payload]
		});
	}
	
	_startSimulation() {
		const simRate = config.serverTickRate || config.fps || 60;
		const netRate = config.netTickRate || simRate;
		const simIntervalMs = 1000 / simRate;
		const netIntervalMs = 1000 / netRate;
		const simDeltaSeconds = 1 / simRate;
		
		// Simulation tick
		this.simInterval = setInterval(() => {
			this.game.tickSim(simDeltaSeconds);
		}, simIntervalMs);
		
		// Network flush tick (sends updates to client)
		this.netInterval = setInterval(() => {
			this.game.flushFrame();
		}, netIntervalMs);
	}
	
	_stopSimulation() {
		if (this.simInterval) {
			clearInterval(this.simInterval);
			this.simInterval = null;
		}
		if (this.netInterval) {
			clearInterval(this.netInterval);
			this.netInterval = null;
		}
	}
}

/**
 * Create a new local session (factory function)
 */
export function createLocalSession() {
	const session = new LocalSession();
	session.connect();
	return session;
}
