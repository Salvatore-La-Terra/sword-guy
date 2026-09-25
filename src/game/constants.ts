export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;

export const ARENA = {
  left: 54,
  right: 1146,
  top: 84,
  bottom: 756
} as const;

export const PLAYER = {
  maxHealth: 5,
  speed: 190,
  staggerSpeed: 320,
  radius: 18
} as const;

export const SKELETON = {
  health: 2,
  patrolRange: 78,
  patrolSpeed: 58,
  chaseSpeed: 118,
  aggroRange: 360,
  attackCooldown: 1150,
  guardChance: 0.34,
  guardDuration: 520
} as const;

export const COMBAT = {
  attackRange: 78,
  attackArc: Math.PI * 0.72,
  shieldArc: Math.PI * 0.86,
  windupMs: 280,
  activeMs: 150,
  recoveryMs: 360,
  staggerMs: 220,
  blockStaggerMs: 120,
  blockPushSpeed: 120
} as const;
