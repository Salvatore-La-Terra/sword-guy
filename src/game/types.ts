import Phaser from 'phaser';

export type FighterState = 'idle' | 'windup' | 'active' | 'recovery' | 'shield' | 'stagger' | 'dead';

export interface Fighter {
  id: string;
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  sword: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image;
  texturePrefix: string;
  hp: number;
  facing: number;
  state: FighterState;
  stateEndsAt: number;
  attackDirection: number;
  attackHitIds: Set<string>;
}

export type Player = Fighter;

export interface Skeleton extends Fighter {
  home: Phaser.Math.Vector2;
  patrolTarget: Phaser.Math.Vector2;
  nextDecisionAt: number;
  attackCooldownUntil: number;
  guardUntil: number;
  healthPips: Phaser.GameObjects.Arc[];
}
