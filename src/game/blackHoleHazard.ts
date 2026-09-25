import Phaser from "phaser";

/**
 * Self-contained, periodic black-hole arena hazard.
 *
 * Fully isolated from GameScene: it only needs a Phaser.Scene (for
 * add/tweens/time-independent rendering) plus plain-data bounds/options and,
 * on each update() call, a lightweight array describing fighter positions
 * (and optionally velocities). It never imports or reaches into GameScene,
 * the Fighter/Skeleton types, or Arcade physics bodies, so it can be dropped
 * into any scene without edits to existing gameplay code.
 *
 * Lifecycle (auto-looping):
 *   inactive -> warning -> active -> cooldown -> inactive -> ...
 *
 * - inactive: waiting out `cycleIntervalMs` before the next warning.
 * - warning: telegraphs the danger zone (pulsing ring + growing marker) for
 *   `warningDurationMs` so players can react before it goes live.
 *   The ring pulses faster and grows more solid as the warning progresses.
 * - active: pulls fighters within `pullRadius` toward the center with a
 *   distance-based falloff and consumes anyone inside `consumeRadius`, while
 *   drawing a restrained swirling-particle/ring visual. Lasts `activeDurationMs`.
 * - cooldown: hazard is visually dormant/fading for `cooldownDurationMs`
 *   before returning to `inactive` and re-arming the cycle timer.
 *
 * Example wiring (not performed here, left for the integration step):
 *
 * ```ts
 * import { BlackHoleHazard } from '../game/blackHoleHazard';
 * import { ARENA } from '../game/constants';
 *
 * const hazard = new BlackHoleHazard(this, ARENA, {
 *   onConsume: (id) => this.handleFighterConsumed(id)
 * });
 *
 * // inside update(time, delta):
 * const fighterInputs = allFighters.map(f => ({
 *   id: f.id,
 *   x: f.sprite.x,
 *   y: f.sprite.y,
 *   vx: f.sprite.body.velocity.x,
 *   vy: f.sprite.body.velocity.y
 * }));
 * const consumedIds = hazard.update(time, delta, fighterInputs);
 * for (const input of fighterInputs) {
 *   // sync any pulled velocity back onto the real body:
 *   const fighter = fighterById.get(input.id);
 *   fighter?.sprite.body.setVelocity(input.vx ?? 0, input.vy ?? 0);
 * }
 * ```
 */

export type BlackHoleHazardState = "inactive" | "warning" | "active" | "cooldown";

/** Minimal, engine-agnostic view of a fighter the hazard can affect. */
export interface BlackHoleFighterInput {
  id: string;
  x: number;
  y: number;
  /** Optional current velocity; when present it is nudged in-place while pulled. */
  vx?: number;
  vy?: number;
  /** Optional collision radius used against consumeRadius; defaults to 0. */
  radius?: number;
}

export interface BlackHoleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BlackHoleExclusionZone {
  x: number;
  y: number;
  /** Minimum clearance (px) the hazard center must keep from this point. */
  radius: number;
}

export interface BlackHoleHazardOptions {
  /** How long the warning telegraph plays before the hazard goes active. */
  warningDurationMs?: number;
  /** How long the hazard actively pulls/consumes fighters. */
  activeDurationMs?: number;
  /** How long the hazard lingers dormant/fading after going active. */
  cooldownDurationMs?: number;
  /** How long the hazard waits (inactive) before arming the next cycle. */
  cycleIntervalMs?: number;
  /** Delay before the very first warning after construction. Defaults to cycleIntervalMs. */
  initialDelayMs?: number;
  /** Radius (px) within which fighters feel the pull while active. */
  pullRadius?: number;
  /** Pull acceleration (px/s^2) applied at the very center; falls off with distance. */
  pullForce?: number;
  /** Radius (px) within which a fighter is considered consumed. */
  consumeRadius?: number;
  /** Minimum distance the hazard center must keep from the arena edges. */
  edgeMargin?: number;
  /** Called each time a new placement is chosen to gather points to avoid (fighters, furniture, etc). */
  getExclusionZones?: () => BlackHoleExclusionZone[];
  /** Max random placement attempts before falling back to the bounds center. */
  maxPlacementAttempts?: number;
  /** Injectable RNG (0..1) for deterministic tests; defaults to Math.random. */
  randomFn?: () => number;
  /** Whether the hazard should re-arm itself automatically after cooldown. Defaults to true. */
  autoLoop?: boolean;
  /** Render depth for all hazard visuals. */
  depth?: number;
  onStateChange?: (state: BlackHoleHazardState, position: { x: number; y: number } | undefined) => void;
  onWarningStart?: (position: { x: number; y: number }) => void;
  onActiveStart?: (position: { x: number; y: number }) => void;
  onConsume?: (fighterId: string, position: { x: number; y: number }) => void;
  onDeactivate?: () => void;
}

type ResolvedOptions = Required<
  Omit<BlackHoleHazardOptions, "getExclusionZones" | "onStateChange" | "onWarningStart" | "onActiveStart" | "onConsume" | "onDeactivate">
> &
  Pick<BlackHoleHazardOptions, "getExclusionZones" | "onStateChange" | "onWarningStart" | "onActiveStart" | "onConsume" | "onDeactivate">;

const DEFAULT_OPTIONS: ResolvedOptions = {
  warningDurationMs: 1400,
  activeDurationMs: 3200,
  cooldownDurationMs: 900,
  cycleIntervalMs: 6000,
  initialDelayMs: 6000,
  pullRadius: 220,
  pullForce: 620,
  consumeRadius: 26,
  edgeMargin: 90,
  getExclusionZones: undefined,
  maxPlacementAttempts: 20,
  randomFn: Math.random,
  autoLoop: true,
  depth: 16,
  onStateChange: undefined,
  onWarningStart: undefined,
  onActiveStart: undefined,
  onConsume: undefined,
  onDeactivate: undefined
};

const SWIRL_DOT_COUNT = 6;
const SWIRL_BASE_RADIUS_RATIO = 0.55;

/**
 * Periodic hazard controller. Owns its own small set of Phaser display
 * objects (rings/dots/core) and tweens, all created from primitive shapes
 * so no external assets are required.
 */
export class BlackHoleHazard {
  private readonly scene: Phaser.Scene;
  private readonly bounds: BlackHoleBounds;
  private readonly options: ResolvedOptions;

  private state: BlackHoleHazardState = "inactive";
  private elapsedInState = 0;
  private paused = false;
  private destroyed = false;
  private center: { x: number; y: number } | undefined;
  private consumedThisActivation = new Set<string>();
  private swirlAngle = 0;
  private lastUpdateTime = 0;

  private container?: Phaser.GameObjects.Container;
  private warningRing?: Phaser.GameObjects.Arc;
  private warningMarker?: Phaser.GameObjects.Arc;
  private core?: Phaser.GameObjects.Arc;
  private eventHorizon?: Phaser.GameObjects.Arc;
  private swirlDots: Phaser.GameObjects.Arc[] = [];
  private ringPulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, bounds: BlackHoleBounds, options: BlackHoleHazardOptions = {}) {
    this.scene = scene;
    this.bounds = bounds;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.elapsedInState = -this.options.initialDelayMs;

    // Auto-clean if the owning scene shuts down/is destroyed mid-cycle.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Current lifecycle state. */
  getState(): BlackHoleHazardState {
    return this.state;
  }

  /** True while actively pulling/consuming fighters. */
  isActive(): boolean {
    return this.state === "active";
  }

  /** Current hazard center, if one has been placed (undefined while fully inactive/idle). */
  getPosition(): { x: number; y: number } | undefined {
    return this.center ? { ...this.center } : undefined;
  }

  /** Scene time (ms) from the most recent update() call, for correlating with external timing. */
  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  getPullRadius(): number {
    return this.options.pullRadius;
  }

  getConsumeRadius(): number {
    return this.options.consumeRadius;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Freezes lifecycle progression, pulling and visuals in place. */
  pause(): void {
    if (this.destroyed || this.paused) {
      return;
    }
    this.paused = true;
    this.ringPulseTween?.pause();
  }

  /** Resumes lifecycle progression after pause(). */
  resume(): void {
    if (this.destroyed || !this.paused) {
      return;
    }
    this.paused = false;
    this.ringPulseTween?.resume();
  }

  /**
   * Advances the hazard by `delta` milliseconds and applies pull/consume
   * effects against `fighters`. Fighters that carry numeric vx/vy are
   * nudged in-place while inside the pull radius (callers remain
   * responsible for syncing that back onto their own physics bodies).
   *
   * Returns the ids of fighters consumed on this call.
   */
  update(time: number, delta: number, fighters: readonly BlackHoleFighterInput[]): string[] {
    if (this.destroyed || this.paused || delta <= 0) {
      return [];
    }

    this.lastUpdateTime = time; // correlates future callbacks with the scene clock
    this.elapsedInState += delta;
    this.advanceState(fighters);

    const consumed: string[] = [];
    if (this.state === "warning" && this.center) {
      this.updateWarningVisual();
    } else if (this.state === "active" && this.center) {
      this.swirlAngle += delta * 0.0028;
      this.updateActiveVisual();
      consumed.push(...this.applyPullAndConsume(delta, fighters));
    } else if (this.state === "cooldown" && this.center) {
      this.updateCooldownVisual();
    }

    return consumed;
  }

  /** Skips any remaining wait and starts a warning cycle immediately. */
  forceTrigger(fighters?: readonly BlackHoleFighterInput[]): void {
    if (this.destroyed) {
      return;
    }
    this.enterState("warning", fighters ?? []);
  }

  /** Returns the hazard to a fully inactive, un-placed state and clears visuals. */
  reset(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyVisuals();
    this.state = "inactive";
    this.center = undefined;
    this.consumedThisActivation.clear();
    this.elapsedInState = -this.options.initialDelayMs;
    this.paused = false;
  }

  /** Permanently tears down all visuals/tweens/listeners. Safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.destroyVisuals();
    this.center = undefined;
    this.consumedThisActivation.clear();
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  private advanceState(fighters: readonly BlackHoleFighterInput[]): void {
    switch (this.state) {
      case "inactive":
        if (this.elapsedInState >= 0) {
          this.enterState("warning", fighters);
        }
        break;
      case "warning":
        if (this.elapsedInState >= this.options.warningDurationMs) {
          this.enterState("active", fighters);
        }
        break;
      case "active":
        if (this.elapsedInState >= this.options.activeDurationMs) {
          this.enterState("cooldown", fighters);
        }
        break;
      case "cooldown":
        if (this.elapsedInState >= this.options.cooldownDurationMs) {
          if (this.options.autoLoop) {
            this.enterState("inactive", fighters);
          } else {
            this.destroyVisuals();
            this.state = "inactive";
            this.center = undefined;
          }
        }
        break;
      default:
        break;
    }
  }

  private enterState(next: BlackHoleHazardState, fighters: readonly BlackHoleFighterInput[]): void {
    this.state = next;
    this.elapsedInState = 0;

    if (next === "warning") {
      this.center = this.pickPosition(fighters);
      this.consumedThisActivation.clear();
      this.buildVisuals();
      this.options.onWarningStart?.(this.getPosition()!);
    } else if (next === "active") {
      this.options.onActiveStart?.(this.getPosition()!);
    } else if (next === "cooldown") {
      this.options.onDeactivate?.();
    } else if (next === "inactive") {
      this.destroyVisuals();
      this.center = undefined;
      this.elapsedInState = -this.options.cycleIntervalMs;
    }

    this.options.onStateChange?.(next, this.getPosition());
  }

  // ---------------------------------------------------------------------
  // Placement
  // ---------------------------------------------------------------------

  private pickPosition(fighters: readonly BlackHoleFighterInput[]): { x: number; y: number } {
    const { left, right, top, bottom } = this.bounds;
    const margin = this.options.edgeMargin;
    const minX = Math.min(left + margin, (left + right) / 2);
    const maxX = Math.max(right - margin, (left + right) / 2);
    const minY = Math.min(top + margin, (top + bottom) / 2);
    const maxY = Math.max(bottom - margin, (top + bottom) / 2);

    const zones: BlackHoleExclusionZone[] = [
      ...(this.options.getExclusionZones?.() ?? []),
      ...fighters.map(f => ({ x: f.x, y: f.y, radius: (f.radius ?? 0) + 60 }))
    ];

    for (let attempt = 0; attempt < this.options.maxPlacementAttempts; attempt += 1) {
      const x = minX + this.options.randomFn() * (maxX - minX);
      const y = minY + this.options.randomFn() * (maxY - minY);
      const safe = zones.every(zone => Phaser.Math.Distance.Between(x, y, zone.x, zone.y) >= zone.radius);
      if (safe) {
        return { x, y };
      }
    }

    // Fallback: bounds center, which is always inside the arena even if
    // every random attempt landed inside an exclusion zone.
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }

  // ---------------------------------------------------------------------
  // Pull + consume
  // ---------------------------------------------------------------------

  private applyPullAndConsume(delta: number, fighters: readonly BlackHoleFighterInput[]): string[] {
    if (!this.center) {
      return [];
    }
    const { pullRadius, pullForce, consumeRadius } = this.options;
    const consumed: string[] = [];
    const dtSeconds = delta / 1000;

    for (const fighter of fighters) {
      if (this.consumedThisActivation.has(fighter.id)) {
        continue;
      }
      const dx = this.center.x - fighter.x;
      const dy = this.center.y - fighter.y;
      const distance = Math.hypot(dx, dy);
      const effectiveRadius = consumeRadius + (fighter.radius ?? 0);

      if (distance <= effectiveRadius) {
        this.consumedThisActivation.add(fighter.id);
        consumed.push(fighter.id);
        this.options.onConsume?.(fighter.id, this.getPosition()!);
        continue;
      }

      if (distance <= pullRadius && distance > 0) {
        // Stronger pull closer to the center; linear falloff kept gentle so
        // escape is possible near the outer edge of the pull radius.
        const falloff = 1 - distance / pullRadius;
        const magnitude = pullForce * falloff;
        const nx = dx / distance;
        const ny = dy / distance;
        if (typeof fighter.vx === "number" && typeof fighter.vy === "number") {
          fighter.vx += nx * magnitude * dtSeconds * 60;
          fighter.vy += ny * magnitude * dtSeconds * 60;
        }
      }
    }

    return consumed;
  }

  // ---------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------

  private buildVisuals(): void {
    this.destroyVisuals();
    if (!this.center) {
      return;
    }
    const { x, y } = this.center;
    const depth = this.options.depth;

    const container = this.scene.add.container(x, y).setDepth(depth);
    this.container = container;

    // Warning telegraph: a hollow ring that pulses and a small solid marker
    // at the true center so players can see exactly where danger will spawn.
    this.warningRing = this.scene.add
      .circle(0, 0, this.options.pullRadius, 0x7c3aed, 0)
      .setStrokeStyle(2, 0x7c3aed, 0.55);
    this.warningMarker = this.scene.add.circle(0, 0, 6, 0x7c3aed, 0.85);
    container.add([this.warningRing, this.warningMarker]);

    this.ringPulseTween = this.scene.tweens.add({
      targets: this.warningRing,
      scale: { from: 0.85, to: 1 },
      alpha: { from: 0.25, to: 0.6 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Active visuals: dark event horizon, a bright thin core, and a small
    // ring of swirling dots orbiting the center - restrained (few, small,
    // soft colors) rather than a dense particle storm.
    this.eventHorizon = this.scene.add.circle(0, 0, this.options.consumeRadius * 1.6, 0x0b0716, 0.85).setVisible(false);
    this.core = this.scene.add.circle(0, 0, this.options.consumeRadius * 0.6, 0xc4b5fd, 0.9).setVisible(false);
    container.add([this.eventHorizon, this.core]);

    const swirlRadius = this.options.consumeRadius + (this.options.pullRadius - this.options.consumeRadius) * SWIRL_BASE_RADIUS_RATIO;
    for (let i = 0; i < SWIRL_DOT_COUNT; i += 1) {
      const dot = this.scene.add.circle(swirlRadius, 0, 3.5, 0xa78bfa, 0.8).setVisible(false);
      this.swirlDots.push(dot);
      container.add(dot);
    }
  }

  private updateWarningVisual(): void {
    if (!this.warningRing || !this.warningMarker) {
      return;
    }
    const progress = Phaser.Math.Clamp(this.elapsedInState / this.options.warningDurationMs, 0, 1);
    // Ring shrinks from the full pull radius down toward the consume radius,
    // visually "closing in" as the warning nears its end.
    const startRadius = this.options.pullRadius;
    const endRadius = this.options.consumeRadius * 1.4;
    this.warningRing.setRadius(Phaser.Math.Linear(startRadius, endRadius, progress));
    this.warningMarker.setAlpha(0.6 + progress * 0.4);
  }

  private updateActiveVisual(): void {
    if (!this.eventHorizon || !this.core) {
      return;
    }
    this.warningRing?.setVisible(false);
    this.warningMarker?.setVisible(false);
    this.eventHorizon.setVisible(true);
    this.core.setVisible(true);

    const pulse = 1 + Math.sin(this.swirlAngle * 3) * 0.05;
    this.eventHorizon.setScale(pulse);
    this.core.setScale(1 + Math.sin(this.swirlAngle * 5) * 0.08);

    const swirlRadius = this.options.consumeRadius + (this.options.pullRadius - this.options.consumeRadius) * SWIRL_BASE_RADIUS_RATIO;
    this.swirlDots.forEach((dot, index) => {
      dot.setVisible(true);
      const angle = this.swirlAngle + (index / SWIRL_DOT_COUNT) * Math.PI * 2;
      const radius = swirlRadius * (0.85 + 0.15 * Math.sin(this.swirlAngle * 2 + index));
      dot.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius);
      dot.setAlpha(0.55 + 0.25 * Math.sin(this.swirlAngle * 4 + index));
    });
  }

  private updateCooldownVisual(): void {
    if (!this.container) {
      return;
    }
    const progress = Phaser.Math.Clamp(this.elapsedInState / this.options.cooldownDurationMs, 0, 1);
    this.container.setAlpha(1 - progress);
  }

  private destroyVisuals(): void {
    this.ringPulseTween?.stop();
    this.ringPulseTween = undefined;
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy(true);
    }
    this.container = undefined;
    this.warningRing = undefined;
    this.warningMarker = undefined;
    this.core = undefined;
    this.eventHorizon = undefined;
    this.swirlDots = [];
  }
}

/** Convenience factory mirroring the project's function-based helper style. */
export function createBlackHoleHazard(
  scene: Phaser.Scene,
  bounds: BlackHoleBounds,
  options?: BlackHoleHazardOptions
): BlackHoleHazard {
  return new BlackHoleHazard(scene, bounds, options);
}

