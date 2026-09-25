# GitHub Copilot instructions

## Project overview

Sword Guy is a browser-based, top-down medieval action game built with Phaser
3, TypeScript, and Vite. Preserve the current gameplay identity: readable
melee combat, escalating skeleton waves, generated retro-medieval visuals,
restrained effects, and no mandatory external media assets.

## Architecture

- `src/main.ts` configures Phaser and registers scenes.
- `src/scenes/TitleScene.ts` owns the briefing screen and explicit game-start
  choice.
- `src/scenes/GameScene.ts` coordinates the arena, fighters, combat, waves,
  hazards, UI, pause, defeat, and restart behavior.
- `src/game/constants.ts` contains gameplay tuning and arena configuration.
- `src/game/types.ts` contains shared fighter and game-domain types.
- `src/game/assets.ts` generates textures at runtime.
- Reusable effects and systems belong in focused modules under `src/game`,
  rather than adding more unrelated responsibilities to `GameScene`.

Reuse existing helpers for math, sound, particles, score feedback, and scene
transitions. Do not duplicate their behavior inside scenes.

## TypeScript and Phaser conventions

- Keep strict TypeScript compatibility; do not use `any` or unsafe casts to
  bypass type errors.
- Follow existing Phaser 3 APIs and the established scene lifecycle.
- Declare mutable scene state explicitly and reset it in the appropriate
  new-game, new-wave, shutdown, or restart path.
- Destroy temporary game objects, timers, tweens, colliders, and audio nodes
  when their lifecycle ends.
- Prefer generated Phaser shapes/textures and Web Audio cues over new binary
  assets unless an issue explicitly requests supplied artwork or audio.
- Keep visual feedback restrained and gameplay-readable. Effects must be
  short-lived, non-blocking, and use sensible depth ordering.

## Gameplay requirements

- Preserve the existing controls:
  - WASD movement
  - left-click attack
  - right-click shield
  - Space healing
  - M audio mute
  - Escape pause
- The title screen must not start gameplay automatically. Start requires the
  visible button or documented keyboard choice.
- Browser audio must begin only after a trusted user interaction and must never
  break gameplay if Web Audio is unavailable.
- New hazards and enemies require a visible warning and a fair opportunity to
  react.
- Pause must freeze gameplay deadlines consistently. Prefer absolute scene-time
  deadlines shifted by the existing pause-duration logic over independent
  timers that continue while paused.
- Route enemy removal through complete cleanup and wave-clear handling; do not
  leave swords, shields, health pips, colliders, or invisible actors behind.
- Ensure player defeat updates health/UI state and uses the existing defeat
  flow.

## Collaboration and Git

- Work from the latest `main`; teammates may update the repository concurrently.
- Pull or fetch before integration, preserve both contributors' intentional
  changes, and resolve conflicts based on behavior rather than choosing one
  entire file blindly.
- Use focused commits and do not force-push `main`.
- Never commit `node_modules`, `dist`, credentials, generated temporary files,
  or local tooling archives.
- Avoid unrelated formatting or refactors in feature changes.

## Validation

Before considering a code change complete:

1. Run `npm run build`.
2. Fix all TypeScript errors; do not suppress them.
3. For runtime-facing changes, run `npm run preview` or `npm run dev` and verify
   the served page responds.
4. Exercise the affected flow, including pause, restart, wave transitions,
   defeat, and cleanup where relevant.
5. Run `git diff --check` before committing.

The Phaser bundle-size warning is currently expected; do not treat it as a
build failure unless the task specifically addresses bundle optimization.
