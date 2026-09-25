import Phaser from 'phaser';

/**
 * Self-contained, drop-in scene transition helper.
 *
 * Designed to be instantiated once per Phaser.Scene (e.g. inside `create()`)
 * and then invoked at the relevant gameplay moments. It only relies on the
 * Phaser camera fade/flash/shake APIs plus lightweight, auto-destroying
 * overlay rectangles and tweens - no external dependencies, no scene state
 * mutation, and no blocking of player input (overlays are never interactive
 * and never capture pointer/keyboard events).
 *
 * Expected integration from a scene (not wired up here on purpose):
 *
 * ```ts
 * import { SceneTransitions } from '../game/sceneTransitions';
 *
 * class GameScene extends Phaser.Scene {
 *   private transitions?: SceneTransitions;
 *
 *   create() {
 *     this.transitions = new SceneTransitions(this);
 *     this.transitions.playStart();
 *     // ...
 *   }
 *
 *   private startWave() {
 *     // ... existing wave setup ...
 *     this.transitions?.playWaveStart(this.wave);
 *   }
 *
 *   private winWave() {
 *     // ... existing win-wave logic ...
 *     this.transitions?.playWaveClear(this.wave);
 *   }
 *
 *   private loseGame() {
 *     // ... existing defeat logic ...
 *     this.transitions?.playDefeat();
 *   }
 *
 *   private startGame() {
 *     // ... existing restart/reset logic ...
 *     this.transitions?.playRestart();
 *   }
 * }
 * ```
 */

export interface SceneTransitionOptions {
  /** Milliseconds for flash/overlay animations. Kept short to stay subtle. */
  flashDurationMs?: number;
  /** Milliseconds for the camera fade used on start/restart. */
  fadeDurationMs?: number;
}

const DEFAULT_OPTIONS: Required<SceneTransitionOptions> = {
  flashDurationMs: 220,
  fadeDurationMs: 320
};

/** Colors kept close to the existing UI palette in GameScene for consistency. */
const COLOR = {
  waveStart: { r: 226, g: 232, b: 240 }, // slate-200 - neutral readiness pulse
  waveClear: { r: 134, g: 239, b: 172 }, // matches healText green (#86efac)
  defeat: { r: 248, g: 113, b: 113 }, // matches stagger tint (#fb7185-ish)
  defeatOverlay: 0x020617 // near-black vignette, matches promptText stroke
};

export class SceneTransitions {
  private readonly scene: Phaser.Scene;
  private readonly options: Required<SceneTransitionOptions>;
  private defeatOverlay?: Phaser.GameObjects.Rectangle;
  private pulseObjects = new Set<Phaser.GameObjects.GameObject>();
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: SceneTransitionOptions = {}) {
    this.scene = scene;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Auto-clean everything if the scene shuts down or is destroyed while
    // a transition is mid-flight, so nothing leaks across scene restarts.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Subtle readiness pulse for the start of a new wave. Non-blocking. */
  playWaveStart(wave: number): void {
    if (this.destroyed) {
      return;
    }
    const { r, g, b } = COLOR.waveStart;
    // Slightly stronger pulse on later waves so escalation still reads as subtle, not jarring.
    const intensity = Phaser.Math.Clamp(0.12 + wave * 0.01, 0.12, 0.2);
    this.scene.cameras.main.flash(this.options.flashDurationMs, r, g, b, false);
    this.spawnRingPulse(0xe2e8f0, intensity);
  }

  /** Restrained celebratory flash + glow when the player clears a wave. */
  playWaveClear(wave: number): void {
    if (this.destroyed) {
      return;
    }
    const { r, g, b } = COLOR.waveClear;
    // Longer, brighter glow rewards clearing higher waves, still capped to stay unobtrusive.
    const duration = this.options.flashDurationMs + 40 + Math.min(wave, 5) * 10;
    const intensity = Phaser.Math.Clamp(0.18 + wave * 0.01, 0.18, 0.28);
    this.scene.cameras.main.flash(duration, r, g, b, false);
    this.spawnRingPulse(0x86efac, intensity);
  }

  /** Somber flash, small shake and a persistent-but-light vignette on defeat. */
  playDefeat(): void {
    if (this.destroyed) {
      return;
    }
    const { r, g, b } = COLOR.defeat;
    const cam = this.scene.cameras.main;
    cam.flash(this.options.flashDurationMs + 60, r, g, b, false);
    cam.shake(200, 0.006);
    this.ensureDefeatOverlay();
  }

  /** Camera fade-in used on initial start and on restart after defeat. */
  playRestart(onReady?: () => void): void {
    if (this.destroyed) {
      return;
    }
    const cam = this.scene.cameras.main;
    this.clearDefeatOverlay();
    cam.fadeIn(this.options.fadeDurationMs, 0, 0, 0);
    if (onReady) {
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, onReady);
    }
  }

  /** Alias of playRestart, useful when calling from the very first `create()`. */
  playStart(onReady?: () => void): void {
    this.playRestart(onReady);
  }

  /** Tears down any in-flight overlays/tweens. Safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.clearDefeatOverlay();
    for (const obj of this.pulseObjects) {
      obj.destroy();
    }
    this.pulseObjects.clear();
  }

  private ensureDefeatOverlay(): void {
    if (this.defeatOverlay) {
      return;
    }
    const cam = this.scene.cameras.main;
    const overlay = this.scene.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, COLOR.defeatOverlay, 0)
      .setScrollFactor(0)
      .setDepth(25)
      .setAlpha(0);
    overlay.disableInteractive();
    this.defeatOverlay = overlay;
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0.32,
      duration: 420,
      ease: 'Sine.easeOut'
    });
  }

  private clearDefeatOverlay(): void {
    if (!this.defeatOverlay) {
      return;
    }
    const overlay = this.defeatOverlay;
    this.defeatOverlay = undefined;
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeIn',
      onComplete: () => overlay.destroy()
    });
  }

  /** Brief, self-destroying radial pulse centered on the camera viewport. */
  private spawnRingPulse(color: number, peakAlpha: number): void {
    const cam = this.scene.cameras.main;
    const ring = this.scene.add
      .circle(cam.width / 2, cam.height / 2, Math.max(cam.width, cam.height) * 0.05, color, peakAlpha)
      .setScrollFactor(0)
      .setDepth(24)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.disableInteractive();
    this.pulseObjects.add(ring);

    this.scene.tweens.add({
      targets: ring,
      alpha: { from: 0, to: peakAlpha },
      scale: { from: 1, to: 6 },
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.pulseObjects.delete(ring);
        ring.destroy();
      }
    });
  }
}

