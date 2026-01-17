# SwarmBlitz.io

A single-player territory-capture game inspired by Paper.io 2, featuring free movement, mouse-based controls, and PvE combat with drones and upgrades.

## Features

- **Free Movement**: Smooth, continuous movement using mouse controls (not grid-based)
- **Territory Capture**: Claim territory by making loops back to your base
- **Client-Only Gameplay**: Runs entirely in the browser with local simulation for maximum performance
- **PvE Combat**: Fight waves of enemies with your drone swarm
- **Progression System**: Level up, unlock upgrades, and build your perfect drone loadout

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

## Running the Game

```bash
# Build and start the local server (for hosting files only)
npm start
```

Then open your browser to `http://localhost:8083`

The game runs entirely client-side in your browser - the server only hosts static files. All gameplay simulation happens locally for optimal performance.

## How to Play

- Move your mouse to control direction
- Leave your territory to create a trail
- Return to your territory to capture the enclosed area
- Don't hit other players' trails or your own trail!
- Capture as much territory as possible

## Configuration

Edit `config.js` to customize:
- `port`: Static file server port (default: 8083)
- `GRID_COUNT`: Map size
- `SPEED`: Player movement speed
- `serverTickRate`: Simulation tick rate (default: 60 fps)
- Enemy spawn rates, drone stats, and more

**Note: Run `npm run build` after editing config.js**

## Development

```bash
# Build client bundle
npm run build

# Start local file server
node server.js

# Or use dev mode with auto-rebuild
npm run dev
```

The game logic runs entirely in the browser via `src/local-session.js`, which creates an in-memory game instance without any network communication.

## Credits

Based on [Paper.io](https://github.com/stevenjoezhang/paper.io) by stevenjoezhang, originally forked from [BlocklyIO](https://github.com/theKidOfArcrania/BlocklyIO).

## License

MIT License
