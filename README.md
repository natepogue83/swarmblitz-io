# SwarmBlitz.io

A multiplayer territory-capture game inspired by Paper.io 2, featuring free movement and mouse-based controls.

## Features

- **Free Movement**: Smooth, continuous movement using mouse controls (not grid-based)
- **Territory Capture**: Claim territory by making loops back to your base
- **Multiplayer**: Real-time multiplayer with Socket.io
- **Bots**: AI opponents to play against

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
# Build and start the server
npm start
```

Then open your browser to `http://localhost:8083`

## How to Play

- Move your mouse to control direction
- Leave your territory to create a trail
- Return to your territory to capture the enclosed area
- Don't hit other players' trails or your own trail!
- Capture as much territory as possible

## Configuration

Edit `config.js` to customize:
- `port`: Server port (default: 8083)
- `bots`: Number of AI bots
- `GRID_COUNT`: Map size
- `SPEED`: Player movement speed

**Note: Run `npm run build` after editing config.js**

## Development

```bash
# Build client bundle
npm run build

# Start server
node server.js
```

## Credits

Based on [Paper.io](https://github.com/stevenjoezhang/paper.io) by stevenjoezhang, originally forked from [BlocklyIO](https://github.com/theKidOfArcrania/BlocklyIO).

## License

MIT License
