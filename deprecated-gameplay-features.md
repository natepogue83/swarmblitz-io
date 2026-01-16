# Deprecated Gameplay Features Still Missing

This list is derived from `deprecated/` and compares against the current `src/` and `workers/` code. Items below exist in the deprecated codebase but are not implemented (or not fully wired) in the current runtime.

## Core Gameplay Systems
-[done] Territory overlap resolution when capturing land (subtract captured territory from other players and kill trapped players) from `deprecated/core/index.js`.
-[done] Spawn safety logic that avoids existing territories/trails and uses multi‑phase fallback searches from `deprecated/game-server.js`.
-[done] Killer XP reward transfer on kills (percent + minimum) from `deprecated/game-server.js` and `config.js`.

## Modes, Spectating, and Bots
-[done] Spectator/God mode with full‑map zoomed view from `deprecated/mode/god.js` and `deprecated/server.js`.
-[done] Bot support (AI clients + server bot spawner) from `deprecated/bot.js`, `deprecated/paper-io-bot.js`, and `deprecated/server.js`.

## Input & Controls
-[done] WASD movement with smooth turning (alongside mouse control) from `deprecated/game-client.js` and `deprecated/mode/player.js`.

## Combat, Speed, and Territory Feedback
-[done] Snip fuse visual along the trail (burning fuse spark) from `deprecated/core/player.js`.
-[done] Snip fuse audio (player + enemy) from `deprecated/sound-manager.js`.
- In‑territory safety glow aura around the player from `deprecated/core/player.js`.
-[done] Trail speed‑buff visual spikes + speed‑rush audio from `deprecated/mode/player.js` and `deprecated/sound-manager.js`.
-[done] Capture feedback effects (pulse ring, particles, +XP text, outline thickening) from `deprecated/mode/player.js`.
-[wip] Level‑up VFX (burst/ring + floating text) from `deprecated/mode/player.js`.
-[done] Death VFX (particles, shard burst, dissolve, screen shake) from `deprecated/mode/player.js`.
- [wip]Loot coin burst animation on death (coins with origin + bounce) from `deprecated/mode/player.js` and `deprecated/game-client.js`.

## Drones & Hitscan Visuals
- Drone target updates from server so targeting indicators reflect real targets (deprecated sends `targetId`) from `deprecated/game-server.js` and `deprecated/game-client.js`.
-[wip] Drone range indicator circle for the local player from `deprecated/mode/player.js`.

## UI/UX Gameplay HUD
- Top‑bar score (territory %) and kill counter from `deprecated/mode/player.js`.
- [wip]Leaderboard ranked by territory % (not just level/XP) from `deprecated/mode/player.js`.
- [wip]Death screen stats using real territory % score and killer name from `deprecated/mode/player.js` and `deprecated/index.html` (legacy).

## Audio & Settings Integration
-[done] Full SoundManager system (SFX + background/music playlist + menu music) from `deprecated/sound-manager.js`.
-[done] Settings panel wiring for audio volume sliders from `deprecated/mode/player.js`.
-[done] `/api/playlist` endpoint for music playback from `deprecated/server.js`.

