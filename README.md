# Sword Guy

A browser game built with Phaser, Vite, and TypeScript.

## Development

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite to play the game.

## Controls

- **WASD**: move the knight, including diagonally
- **Left mouse button**: perform a heavy sword attack toward the pointer
- **Right mouse button**: raise the shield toward the pointer
- **Esc**: pause or resume the game

Fight armoured skeletons in a castle arena. Skeletons patrol, pursue the player
when nearby, and can attack or guard. Unblocked sword hits stagger opponents;
the player and skeletons lose health until they are defeated. Clear a wave and
left-click to start a harder one.

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
