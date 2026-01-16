# Server Cost Optimization Notes

## Plan accuracy audit (current code vs target)

- AOI filtering and spatial grid are already implemented in `src/game-server.js` and should be treated as completed.
- Tick rate is still hard-coded at 60 in `server.js` and `src/core/index.js`, so tick reduction is not implemented.
- Socket.IO compression is not enabled; there is no per-message deflate configuration.
- JSON payloads are still used; MessagePack/binary snapshots are not implemented yet.
- Drone updates are sent every frame (`economyDeltas.droneUpdates`), so throttling is not implemented.
- Bots are enabled by default (`config.bots = 30`), which should be disabled in production to avoid skewed cost metrics.
