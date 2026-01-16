# SwarmBlitz.io

A multiplayer territory-capture game inspired by Paper.io 2, featuring free movement, drone combat, and mouse-based controls.

**Now powered by Cloudflare Workers + Durable Objects for extreme bandwidth optimization!**

## Features

- **Free Movement**: Smooth, continuous movement using mouse controls (not grid-based)
- **Territory Capture**: Claim territory by making loops back to your base
- **Drone Combat**: Level up to gain drones that auto-attack nearby enemies
- **Multiplayer**: Real-time multiplayer with WebSocket
- **Bandwidth Optimized**: Binary protocol, delta updates, AOI-based broadcasting

## Architecture

### v2.0 - Cloudflare Workers Edition

The game has been rebuilt from the ground up for minimal bandwidth usage:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │   Worker    │───▶│         Room Durable Object         │ │
│  │  (Router)   │    │  ┌─────────────────────────────────┐│ │
│  └─────────────┘    │  │      World Simulation           ││ │
│                     │  │  - Authoritative game state     ││ │
│                     │  │  - 60 Hz physics tick           ││ │
│                     │  │  - 20 Hz network broadcast      ││ │
│                     │  └─────────────────────────────────┘│ │
│                     │  ┌─────────────────────────────────┐│ │
│                     │  │      AOI Manager                ││ │
│                     │  │  - Spatial grid partitioning    ││ │
│                     │  │  - Per-player visibility        ││ │
│                     │  │  - Delta-only updates           ││ │
│                     │  └─────────────────────────────────┘│ │
│                     └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Binary Protocol)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Game Client                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Net Client    │  │  Interpolation  │  │   Renderer  │ │
│  │  - Binary codec │  │  - Smooth motion│  │  - Canvas   │ │
│  │  - Input batch  │  │  - Prediction   │  │  - Effects  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Bandwidth Optimizations

| Technique | Savings |
|-----------|---------|
| Binary protocol (vs JSON) | ~60% |
| Delta updates (only changed data) | ~40% |
| AOI filtering (only nearby entities) | ~70% |
| Quantized positions (16-bit) | ~50% |
| Batched network frames (20 Hz) | ~66% |

**Estimated per-player bandwidth: ~2-5 KB/s** (down from ~20-50 KB/s)

## Screenshots

![Gameplay](screenshot.png)

## Installation

```bash
# Clone this repository
git clone https://github.com/YOUR_USERNAME/swarmblitz-io.git

# Go into the repository
cd swarmblitz-io

# Install dependencies
npm install
```

## Development

```bash
# Start both Wrangler (Workers) and Vite (client) in dev mode
npm run dev
```

This runs:
- **Wrangler dev server** at `http://localhost:8787` (WebSocket backend)
- **Vite dev server** at `http://localhost:3000` (client with HMR)

Open `http://localhost:3000` to play.

## Deployment

### Deploy to Cloudflare Workers

```bash
# Login to Cloudflare
npx wrangler login

# Deploy to production
npm run deploy:production
```

### Build Static Assets

```bash
# Build client for production
npm run build
```

Output goes to `dist/` - deploy to Cloudflare Pages, R2, or any static host.

## Load Testing

```bash
# Run load test with 50 bots for 30 seconds
npm run load:test:50

# Run load test with 100 bots for 60 seconds
npm run load:test:100

# Custom: node tools/load-test.js [bots] [wsUrl] [durationMs]
node tools/load-test.js 200 ws://localhost:8787/room/default 120000
```

## How to Play

- Move your mouse to control direction
- Leave your territory to create a trail
- Return to your territory to capture the enclosed area
- Don't hit other players' trails or your own trail!
- Collect XP orbs to level up and gain drones
- Drones automatically attack nearby enemies
- Stay in your territory to regenerate HP

## Configuration

Edit `config.js` to customize:
- `GRID_COUNT`: Map size in cells
- `SPEED`: Player movement speed
- `MAX_PLAYERS`: Maximum players per room
- `DRONE_*`: Drone combat settings
- `AOI_*`: Area of Interest settings

## Project Structure

```
swarmblitz-io/
├── workers/           # Cloudflare Workers backend
│   ├── index.js       # Worker entry point (router)
│   └── room.js        # Room Durable Object (game logic)
├── src/
│   ├── net/           # Network layer
│   │   ├── protocol.js  # Binary protocol definition
│   │   ├── codec.js     # Encoder/decoder
│   │   └── client.js    # WebSocket client
│   ├── sim/           # Simulation
│   │   └── world.js     # Authoritative game state
│   ├── core/          # Shared utilities
│   │   └── color.js     # Color class
│   ├── game-client.js # Client game loop + rendering
│   └── index.js       # Client entry point
├── public/            # Static assets
├── tools/             # Development tools
│   └── load-test.js   # Bandwidth load testing
├── deprecated/        # Legacy code (v1.0)
├── config.js          # Game configuration
├── wrangler.toml      # Cloudflare Workers config
└── vite.config.js     # Vite bundler config
```

## Credits

Based on [Paper.io](https://github.com/stevenjoezhang/paper.io) by stevenjoezhang, originally forked from [BlocklyIO](https://github.com/theKidOfArcrania/BlocklyIO).

## License

MIT License
