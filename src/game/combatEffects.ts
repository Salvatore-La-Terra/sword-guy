import Phaser from 'phaser';

/**
 * Restrained, shape/tween-based combat feedback effects.
 *
 * No textures, atlases, or external assets are used - every effect is built from
 * primitive Phaser shape game objects (circles) and destroyed automatically once
 * its tween completes, so callers never need to manage cleanup.
 *
 * Intended usage from GameScene (not wired in automatically):
 *   import { spawnHitEffect, spawnDeathEffect, spawnBlockEffect, spawnHealEffect } from '../game/combatEffects';
 *   spawnHitEffect(this, this.positionOf(target));      // on a successful weapon hit
 *   spawnDeathEffect(this, this.positionOf(skeleton));  // when an enemy's hp reaches 0
 *   spawnBlockEffect(this, targetPos);                  // when a shield absorbs an attack
 *   spawnHealEffect(this, this.positionOf(this.player)); // when the player heals
 */

export interface EffectPoint {
  x: number;
  y: number;
}

interface BurstOptions {
  count: number;
  color: number;
  radius: number;
  distance: number;
  duration: number;
  depth?: number;
  startAngle?: number;
  spread?: number;
}

function burstShards(scene: Phaser.Scene, position: EffectPoint, options: BurstOptions) {
  const {
    count,
    color,
    radius,
    distance,
    duration,
    depth = 17,
    startAngle = 0,
    spread = Math.PI * 2
  } = options;

  for (let index = 0; index < count; index += 1) {
    const jitter = (Math.random() - 0.5) * 0.4;
    const angle = startAngle + (spread * index) / count + jitter;
    const shard = scene.add
      .circle(position.x, position.y, radius, color, 0.9)
      .setDepth(depth);

    scene.tweens.add({
      targets: shard,
      x: position.x + Math.cos(angle) * distance,
      y: position.y + Math.sin(angle) * distance,
      alpha: 0,
      scale: 0.2,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy()
    });
  }
}

function ringPulse(
  scene: Phaser.Scene,
  position: EffectPoint,
  color: number,
  duration: number,
  depth: number,
  strokeColor = color
) {
  const ring = scene.add
    .circle(position.x, position.y, 7, color, 0)
    .setStrokeStyle(2, strokeColor, 0.9)
    .setDepth(depth);

  scene.tweens.add({
    targets: ring,
    scale: 2.3,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });
}

/** Small spark burst for a weapon connecting with a target. Auto-destroys in ~220ms. */
export function spawnHitEffect(scene: Phaser.Scene, position: EffectPoint, directionRad = 0) {
  burstShards(scene, position, {
    count: 6,
    color: 0xf8fafc,
    radius: 3,
    distance: 26,
    duration: 220,
    startAngle: directionRad,
    spread: Math.PI * 0.9
  });
  ringPulse(scene, position, 0xf8fafc, 180, 17);
}

/** Brighter shield spark + ring for a successfully blocked attack. Auto-destroys in ~200ms. */
export function spawnBlockEffect(scene: Phaser.Scene, position: EffectPoint) {
  burstShards(scene, position, {
    count: 5,
    color: 0xfacc15,
    radius: 2.5,
    distance: 18,
    duration: 200,
    depth: 18
  });
  ringPulse(scene, position, 0xfacc15, 190, 18, 0xffffff);
}

/** Ash-toned burst + fading cloud for an enemy defeat. Auto-destroys in ~380ms. */
export function spawnDeathEffect(scene: Phaser.Scene, position: EffectPoint) {
  burstShards(scene, position, {
    count: 8,
    color: 0x94a3b8,
    radius: 3.5,
    distance: 34,
    duration: 380,
    depth: 16
  });

  const cloud = scene.add.circle(position.x, position.y, 10, 0x1f2937, 0.4).setDepth(15);
  scene.tweens.add({
    targets: cloud,
    scale: 2.6,
    alpha: 0,
    duration: 360,
    ease: 'Cubic.easeOut',
    onComplete: () => cloud.destroy()
  });
}

/** Rising green motes for restored health. Auto-destroys in ~600ms. */
export function spawnHealEffect(scene: Phaser.Scene, position: EffectPoint) {
  const count = 5;
  for (let index = 0; index < count; index += 1) {
    const offsetX = (Math.random() - 0.5) * 20;
    const mote = scene.add
      .circle(position.x + offsetX, position.y + 6, 2.5, 0x86efac, 0.9)
      .setDepth(18);

    scene.tweens.add({
      targets: mote,
      y: mote.y - 34 - Math.random() * 10,
      alpha: 0,
      duration: 500 + Math.random() * 120,
      ease: 'Sine.easeOut',
      onComplete: () => mote.destroy()
    });
  }
}

/** Convenience aggregate for call sites that prefer a single import. */
export const CombatEffects = {
  hit: spawnHitEffect,
  block: spawnBlockEffect,
  death: spawnDeathEffect,
  heal: spawnHealEffect
} as const;
