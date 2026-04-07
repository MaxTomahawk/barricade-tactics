# Barricade Tactics

Barricade Tactics is a web-based, multiplayer recreation of the classic Barricade board game, powered by Next.js and WebRTC.

## Features

- **Dynamic Game Board & Responsive UI**: A fully responsive game board featuring smooth pawn movement animations and sleek dark-mode aesthetics.
- **WebRTC Multiplayer**: Real-time game state synchronization across clients using PeerJS, enabling robust player-to-player matchmaking and gameplay.
- **Heuristic Computer Opponents**: Built-in computer opponents that evaluate multiple moves, prioritizing aggressive advancement and strategic blocking.
- **Customizable Lobbies**: Players can tune their lobby settings, adjusting the number of players, computer opponents, and specialized rules like "Capture Bonus".
- **Local Settings & Ease of Access**: Quick-start matchmaking modes and easy rejoining to active game rooms directly from the browser's local storage memory.

## Tech Stack

- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS & Radix UI
- **Networking**: PeerJS (WebRTC)
- **Deployment**: Standard static export or Vercel

## Running Locally

To get started with local development:

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000` to play the game!
