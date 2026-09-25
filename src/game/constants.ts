export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;

/** Number of waves to clear before the player wins the whole game. */
export const TOTAL_WAVES = 4;

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

export interface FurniturePlacement {
  key: 'furniture-table' | 'furniture-crate' | 'furniture-barrel' | 'furniture-pillar';
  x: number;
  y: number;
  width: number;
  height: number;
}

// Static obstacles scattered across the arena. Positions are chosen to stay
// clear of the player start point and every skeleton spawn anchor used in
// GameScene so nothing spawns stuck inside a solid object.
export const FURNITURE: FurniturePlacement[] = [
  { key: 'furniture-table', x: 420, y: 300, width: 60, height: 26 },
  { key: 'furniture-table', x: 780, y: 540, width: 60, height: 26 },
  { key: 'furniture-crate', x: 300, y: 590, width: 28, height: 28 },
  { key: 'furniture-crate', x: 900, y: 250, width: 28, height: 28 },
  { key: 'furniture-barrel', x: 250, y: 250, width: 24, height: 26 },
  { key: 'furniture-barrel', x: 950, y: 590, width: 24, height: 26 },
  { key: 'furniture-pillar', x: 600, y: 560, width: 30, height: 30 }
];
