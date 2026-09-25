# Sword Guy

A browser game prototype built with Phaser, Vite, and TypeScript.

## Development

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Controls

- **WASD** or **arrow keys**: move
- **Space**: swing the sword in the last movement direction
- **R**: restart after game over

Enemies enter from the arena edges and pursue the player. Defeat them with the
sword, avoid contact damage, and survive as long as possible.

## Production build

```sh
npm run build
npm run preview
```

The game source is under `src/game`, and static assets belong in
`public/assets`.

## Collaboration

Create a feature branch from `main`, keep commits focused, and open a pull
request for review before merging. Do not commit generated `node_modules` or
`dist` directories.
