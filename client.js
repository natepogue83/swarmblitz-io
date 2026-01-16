import jquery from "jquery";
import * as client from "./src/game-client";
import godRenderer from "./src/mode/god";
import * as playerRenderer from "./src/mode/player";
import * as SoundManager from "./src/sound-manager.js";
import { MSG, encodePacket, decodePacket } from "./src/net/packet.js";

const $ = jquery;

// Track if sound has been initialized (requires user interaction)
let menuSoundInitialized = false;

function initMenuSound() {
	if (!menuSoundInitialized) {
		SoundManager.init();
		SoundManager.resume();
		menuSoundInitialized = true;
		// Start menu music after initialization
		SoundManager.startMenuMusic();
	}
}

function run(flag) {
	// Stop menu music when starting the game
	SoundManager.stopMenuMusic();
	
	client.setRenderer(flag ? godRenderer : playerRenderer);
	const wsUrl = getWsUrl();
	client.connectGame(wsUrl, $("#name").val(), (success, msg) => {
		if (success) {
			$("#main-ui").fadeIn(1000);
			$("#begin, #wasted").fadeOut(1000);
		}
		else {
			$("#error").text(msg);
			// Restart menu music if game failed to start
			if (menuSoundInitialized) {
				SoundManager.startMenuMusic();
			}
		}
	}, flag);
}

function getWsUrl() {
	const protocol = location.protocol === "https:" ? "wss" : "ws";
	return `${protocol}://${location.host}/ws`;
}

$(() => {
	const err = $("#error");
	if (!window.WebSocket) {
		err.text("Your browser does not support WebSockets!");
		return;
	}
	err.text("Loading... Please wait");
	
	// Initialize menu sound on first user interaction
	const initOnInteraction = () => {
		initMenuSound();
		// Remove listeners after first interaction
		document.removeEventListener("click", initOnInteraction);
		document.removeEventListener("keydown", initOnInteraction);
	};
	document.addEventListener("click", initOnInteraction);
	document.addEventListener("keydown", initOnInteraction);
	
	(() => {
		const wsUrl = getWsUrl();
		const socket = new WebSocket(wsUrl);
		socket.binaryType = "arraybuffer";
		
		socket.addEventListener("open", () => {
			socket.send(encodePacket(MSG.PING));
		});
		
		socket.addEventListener("message", (event) => {
			const [type] = decodePacket(event.data);
			if (type === MSG.PONG) {
				socket.close();
				err.text("All done, have fun!");
				$("#name").on("keypress", evt => {
					if (evt.key === "Enter") run();
				});
				$(".start").removeAttr("disabled").on("click", evt => {
					run();
				});
				$(".spectate").removeAttr("disabled").click(evt => {
					run(true);
				});
			}
		});
		
		socket.addEventListener("error", () => {
			err.text("Cannot connect with server. This probably is due to misconfigured proxy server. (Try using a different browser)");
		});
	})();
});

// Mouse-based controls are now handled in src/mode/player.js
// No keyboard controls needed for free movement

$(".menu").on("click", () => {
	client.disconnect();
	$("#main-ui, #wasted").fadeOut(1000);
	$("#begin").fadeIn(1000);
	// Restart menu music when returning to main menu
	if (menuSoundInitialized) {
		SoundManager.startMenuMusic();
	}
});

$(".toggle").on("click", () => {
	$("#settings").slideToggle();
});
