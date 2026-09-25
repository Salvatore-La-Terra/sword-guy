# Sword Guy

Simple Phaser browser game built with Phaser, Vite, and TypeScript.

## Requirements

- Node.js 20 or newer
- npm

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite to play the game.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build in `dist`.
- `npm run preview` serves the production build locally.

## Game controls

- `W`, `A`, `S`, `D` move the knight, including diagonals.
- Left mouse button performs a heavy sword attack toward the pointer.
- Right mouse button raises the shield toward the pointer.
- `Esc` pauses and un-pauses the game.

## Current gameplay loop

Fight armoured skeletons in a large castle arena. Skeletons spawn far enough away that they do not aggro immediately, patrol nearby positions, chase when close, and can attack or guard. Sword hits stagger targets away from the attacker. Skeletons die after two unblocked hits. The player loses after five unblocked hits. Clearing all skeletons waits for a left-click before starting a harder wave with more enemies.

## Suggested workflow

Create feature branches from `main`, open pull requests for review, and keep `main` stable.
