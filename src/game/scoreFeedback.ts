import Phaser from 'phaser';

/**
 * Options controlling score feedback visuals. All are optional and have
 * sensible defaults tuned for the game's HUD look.
 */
export interface ScoreFeedbackOptions {
  /** Multiplier applied to the HUD text scale during the pulse animation. */
  pulseScale?: number;
  /** Total duration (ms) of the HUD pulse (grow + shrink). */
  pulseDurationMs?: number;
  /** Vertical distance (px) a floating label rises before disappearing. */
  floatDistance?: number;
  /** Total lifetime (ms) of a floating label. */
  floatDurationMs?: number;
  /** Fill color used for floating labels. */
  floatColor?: string;
  /** Formats the score value into the HUD text string. */
  formatText?: (score: number) => string;
}

type ResolvedOptions = Required<ScoreFeedbackOptions>;

const DEFAULT_OPTIONS: ResolvedOptions = {
  pulseScale: 1.25,
  pulseDurationMs: 180,
  floatDistance: 46,
  floatDurationMs: 650,
  floatColor: '#facc15',
  formatText: score => `Score: ${score}`
};

/**
 * Standalone helper that tracks a numeric score, keeps an attached Phaser
 * Text HUD in sync, and provides short-lived visual feedback (a HUD pulse
 * and floating "+N" labels) whenever score is added.
 *
 * This class has no dependency on any scene internals beyond the Phaser
 * APIs on the scene/text objects passed to it, so it can be wired into
 * GameScene (or any other scene) without modifying its source.
 */
export class ScoreFeedback {
  private readonly scene: Phaser.Scene;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly options: ResolvedOptions;
  private readonly baseHudScale: number;
  private score = 0;

  constructor(scene: Phaser.Scene, hud: Phaser.GameObjects.Text, options: ScoreFeedbackOptions = {}) {
    this.scene = scene;
    this.hud = hud;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.baseHudScale = hud.scale;
    this.updateHud();
  }

  /** Current score value. */
  get value(): number {
    return this.score;
  }

  /** Resets score to zero and refreshes the HUD text (no pulse/label). */
  reset(): void {
    this.score = 0;
    this.updateHud();
  }

  /**
   * Adds `amount` to the score, refreshes the HUD, pulses the HUD text,
   * and (if `position` is provided) spawns a short-lived floating label
   * at that world position. Returns the new score total.
   */
  add(amount: number, position?: { x: number; y: number }): number {
    if (amount === 0) {
      return this.score;
    }
    this.score += amount;
    this.updateHud();
    this.pulseHud();
    if (position) {
      this.showFloatingLabel(amount, position);
    }
    return this.score;
  }

  private updateHud(): void {
    this.hud.setText(this.options.formatText(this.score));
  }

  private pulseHud(): void {
    this.scene.tweens.killTweensOf(this.hud);
    this.hud.setScale(this.baseHudScale);
    this.scene.tweens.add({
      targets: this.hud,
      scale: this.baseHudScale * this.options.pulseScale,
      duration: this.options.pulseDurationMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  private showFloatingLabel(amount: number, position: { x: number; y: number }): void {
    const sign = amount > 0 ? '+' : '';
    const label = this.scene.add.text(position.x, position.y, `${sign}${amount}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: this.options.floatColor,
      stroke: '#000000',
      strokeThickness: 3
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(1000);
    this.scene.tweens.add({
      targets: label,
      y: position.y - this.options.floatDistance,
      alpha: 0,
      duration: this.options.floatDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }
}

/** Convenience factory mirroring the project's function-based helper style. */
export function createScoreFeedback(
  scene: Phaser.Scene,
  hud: Phaser.GameObjects.Text,
  options?: ScoreFeedbackOptions
): ScoreFeedback {
  return new ScoreFeedback(scene, hud, options);
}
