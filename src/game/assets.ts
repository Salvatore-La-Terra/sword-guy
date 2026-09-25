import Phaser from 'phaser';

function withGraphics(scene: Phaser.Scene, draw: (graphics: Phaser.GameObjects.Graphics) => void) {
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.destroy();
}

interface CharacterPalette {
  armor: number;
  armorDark: number;
  armorLight: number;
  cloth: number;
  clothDark: number;
  skin: number;
  trim: number;
  eye: number;
}

type FacingDirection = 'down' | 'up' | 'side';
type CharacterPose = 'idle' | 'walk' | 'attack' | 'shield' | 'hit' | 'die';

function drawOutlinedRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number
) {
  graphics.fillStyle(0x111827, 0.95).fillRect(x - 1, y - 1, width + 2, height + 2);
  graphics.fillStyle(color).fillRect(x, y, width, height);
}

function drawOutlinedCircle(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number
) {
  graphics.fillStyle(0x111827, 0.95).fillCircle(cx, cy, radius + 1);
  graphics.fillStyle(color).fillCircle(cx, cy, radius);
}

function drawOutlinedRoundRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: number
) {
  graphics.fillStyle(0x111827, 0.95).fillRoundedRect(x - 1, y - 1, width + 2, height + 2, radius + 1);
  graphics.fillStyle(color).fillRoundedRect(x, y, width, height, radius);
}

// Chibi-proportioned top-down frame: an oversized round head sits above a
// small stubby body, echoing the compact SNES-era action RPG look where the
// head reads clearly from a top-down camera instead of a realistic body.
function drawTopDownCharacterFrame(
  scene: Phaser.Scene,
  key: string,
  palette: CharacterPalette,
  direction: FacingDirection,
  pose: CharacterPose,
  frame: number
) {
  withGraphics(scene, graphics => {
    const centerX = 24;
    const attack = pose === 'attack';
    const shield = pose === 'shield';
    const hit = pose === 'hit';
    const dying = pose === 'die';
    const walking = pose === 'walk';
    const facingSide = direction === 'side';
    const facingUp = direction === 'up';

    if (dying) {
      const settle = frame;
      const collapseX = centerX + (settle === 0 ? 4 : 9);
      const collapseY = 33 + settle * 4;
      graphics.fillStyle(0x000000, 0.22).fillEllipse(centerX, 50, 30, 8);
      drawOutlinedRoundRect(graphics, centerX - 15, 35 + settle * 3, 30, 12, 4, palette.cloth);
      drawOutlinedCircle(graphics, collapseX, collapseY, 13, palette.armorDark);
      if (!facingUp) {
        graphics.fillStyle(palette.skin).fillEllipse(collapseX, collapseY + 2, 16, 13);
        graphics.fillStyle(settle === 0 ? palette.eye : 0x7f1d1d)
          .fillRect(collapseX - 4, collapseY, 2, 2)
          .fillRect(collapseX + 2, collapseY, 2, 2);
      }
      graphics.generateTexture(key, 48, 56);
      return;
    }

    const legLiftL = walking ? (frame === 0 ? -2 : frame === 2 ? 2 : 0) : 0;
    const legLiftR = walking ? (frame === 2 ? -2 : frame === 0 ? 2 : 0) : 0;
    const legY = 41;

    graphics.fillStyle(0x000000, 0.22).fillEllipse(centerX, 51, 22, 6);

    drawOutlinedRect(graphics, centerX - 9, legY + legLiftL, 6, 9, palette.clothDark);
    drawOutlinedRect(graphics, centerX + 3, legY + legLiftR, 6, 9, palette.clothDark);

    const bodyLean = attack ? (frame === 0 ? -1 : frame === 1 ? 2 : 1) : hit ? -2 : 0;
    const bodyX = centerX + bodyLean;
    const bodyY = 29;

    drawOutlinedRoundRect(graphics, bodyX - 11, bodyY, 22, 13, 5, hit ? 0xfb7185 : palette.cloth);
    graphics.fillStyle(palette.trim).fillRect(bodyX - 9, bodyY + 4, 18, 3);

    drawOutlinedCircle(graphics, bodyX - 12, bodyY + 2, 5, palette.armor);
    drawOutlinedCircle(graphics, bodyX + 12, bodyY + 2, 5, palette.armor);

    if (shield) {
      const armX = facingSide ? bodyX + 9 : bodyX + (facingUp ? -11 : 10);
      drawOutlinedRect(graphics, armX - 2, bodyY + 3, 7, 11, palette.armor);
    } else if (attack && !facingUp) {
      const armX = facingSide ? bodyX + 11 : bodyX + (frame === 0 ? 9 : 12);
      drawOutlinedRect(graphics, armX, bodyY + 1 + frame, 6, 11, palette.armor);
    }

    const headCx = bodyX + (facingSide ? 2 : 0);
    const headCy = 16 + (walking ? Math.round(Math.abs(legLiftL) * 0.3) : 0);
    const headRadius = 15;

    drawOutlinedCircle(graphics, headCx, headCy, headRadius, palette.armorDark);

    if (facingUp) {
      graphics.fillStyle(palette.armor).fillRect(headCx - 2, headCy - headRadius + 4, 4, headRadius * 2 - 8);
    } else if (facingSide) {
      const faceX = headCx + 5;
      graphics.fillStyle(palette.skin).fillEllipse(faceX, headCy + 2, 12, 14);
      graphics.fillStyle(palette.armorLight).fillCircle(faceX + 3, headCy - 1, 3);
      graphics.fillStyle(hit ? 0x7f1d1d : palette.eye).fillCircle(faceX + 3, headCy - 1, 1.4);
    } else {
      graphics.fillStyle(palette.skin).fillEllipse(headCx, headCy + 3, 20, 16);
      graphics.fillStyle(palette.armorLight).fillCircle(headCx - 5, headCy, 4);
      graphics.fillStyle(palette.armorLight).fillCircle(headCx + 5, headCy, 4);
      graphics.fillStyle(hit ? 0x7f1d1d : palette.eye).fillCircle(headCx - 5, headCy + 1, 1.6);
      graphics.fillStyle(hit ? 0x7f1d1d : palette.eye).fillCircle(headCx + 5, headCy + 1, 1.6);
    }

    graphics.fillStyle(palette.armor).fillRect(headCx - headRadius + 2, headCy - 7, headRadius * 2 - 4, 4);

    if (shield) {
      const shieldX = facingSide ? bodyX + 15 : bodyX + (facingUp ? 13 : -20);
      const shieldY = facingUp ? bodyY + 1 : bodyY + 4;
      graphics.fillStyle(0x111827, 0.95).fillRoundedRect(shieldX - 1, shieldY - 1, 13, 20, 4);
      graphics.fillStyle(0x0f766e).fillRoundedRect(shieldX, shieldY, 11, 18, 4);
      graphics.lineStyle(1, 0x99f6e4).lineBetween(shieldX + 5, shieldY + 2, shieldX + 5, shieldY + 16);
    }

    graphics.generateTexture(key, 48, 56);
  });
}

function createCharacterFrames(scene: Phaser.Scene, prefix: string, palette: CharacterPalette) {
  for (const direction of ['down', 'up', 'side'] as const) {
    drawTopDownCharacterFrame(scene, `${prefix}-${direction}-idle-0`, palette, direction, 'idle', 0);
    for (let frame = 0; frame < 4; frame += 1) {
      drawTopDownCharacterFrame(scene, `${prefix}-${direction}-walk-${frame}`, palette, direction, 'walk', frame);
    }
    for (let frame = 0; frame < 3; frame += 1) {
      drawTopDownCharacterFrame(scene, `${prefix}-${direction}-attack-${frame}`, palette, direction, 'attack', frame);
    }
    drawTopDownCharacterFrame(scene, `${prefix}-${direction}-shield-0`, palette, direction, 'shield', 0);
    drawTopDownCharacterFrame(scene, `${prefix}-${direction}-hit-0`, palette, direction, 'hit', 0);
    for (let frame = 0; frame < 2; frame += 1) {
      drawTopDownCharacterFrame(scene, `${prefix}-${direction}-die-${frame}`, palette, direction, 'die', frame);
    }
  }
}

// Floor cracks, blood puddles, and skulls are drawn as small transparent
// decal textures so they can be scattered on top of the tiled floor without
// altering the base tile itself.
function createFloorDecals(scene: Phaser.Scene) {
  withGraphics(scene, graphics => {
    graphics.lineStyle(2, 0x1e293b, 0.65);
    graphics.beginPath();
    graphics.moveTo(4, 6);
    graphics.lineTo(16, 18);
    graphics.lineTo(12, 30);
    graphics.lineTo(22, 40);
    graphics.strokePath();
    graphics.lineStyle(1, 0x1e293b, 0.4);
    graphics.lineBetween(16, 18, 26, 14);
    graphics.generateTexture('floor-crack-a', 40, 44);
  });

  withGraphics(scene, graphics => {
    graphics.lineStyle(2, 0x1e293b, 0.6);
    graphics.beginPath();
    graphics.moveTo(30, 4);
    graphics.lineTo(20, 14);
    graphics.lineTo(24, 26);
    graphics.lineTo(10, 32);
    graphics.strokePath();
    graphics.lineStyle(1, 0x1e293b, 0.35);
    graphics.lineBetween(24, 26, 32, 30);
    graphics.generateTexture('floor-crack-b', 40, 40);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x450a0a, 0.55).fillEllipse(20, 20, 34, 22);
    graphics.fillStyle(0x7f1d1d, 0.45).fillEllipse(14, 16, 14, 10);
    graphics.fillStyle(0x7f1d1d, 0.4).fillEllipse(28, 24, 12, 8);
    graphics.fillStyle(0x991b1b, 0.3).fillEllipse(20, 20, 20, 12);
    graphics.generateTexture('floor-blood-a', 40, 40);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x450a0a, 0.5).fillEllipse(14, 14, 22, 16);
    graphics.fillStyle(0x7f1d1d, 0.4).fillEllipse(18, 12, 10, 7);
    graphics.generateTexture('floor-blood-b', 28, 28);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x000000, 0.25).fillEllipse(14, 22, 16, 6);
    graphics.fillStyle(0xe5e7eb, 0.92).fillEllipse(14, 14, 15, 12);
    graphics.fillStyle(0xd1d5db).fillRoundedRect(8, 18, 12, 7, 2);
    graphics.fillStyle(0x1f2937).fillEllipse(9, 13, 4, 5).fillEllipse(19, 13, 4, 5);
    graphics.fillStyle(0x1f2937).fillTriangle(14, 15, 12, 19, 16, 19);
    graphics.generateTexture('floor-skull', 28, 28);
  });
}

function createWallVariants(scene: Phaser.Scene) {
  withGraphics(scene, graphics => {
    graphics.fillStyle(0x334155).fillRoundedRect(0, 0, 64, 64, 7);
    graphics.fillStyle(0x1e293b).fillRect(0, 48, 64, 16);
    graphics.lineStyle(2, 0x64748b);
    graphics.strokeRoundedRect(2, 2, 60, 60, 7);
    graphics.generateTexture('wall-block', 64, 64);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x334155).fillRoundedRect(0, 0, 64, 64, 7);
    graphics.fillStyle(0x1e293b).fillRect(0, 48, 64, 16);
    graphics.lineStyle(2, 0x64748b);
    graphics.strokeRoundedRect(2, 2, 60, 60, 7);
    graphics.lineStyle(1, 0x0f172a, 0.7);
    graphics.lineBetween(10, 6, 22, 30);
    graphics.lineBetween(22, 30, 16, 48);
    graphics.lineBetween(40, 4, 34, 24);
    graphics.fillStyle(0x365314, 0.55).fillEllipse(48, 44, 18, 12);
    graphics.fillStyle(0x3f6212, 0.4).fillEllipse(52, 50, 12, 8);
    graphics.generateTexture('wall-block-worn', 64, 64);
  });
}

function createFurniture(scene: Phaser.Scene) {
  withGraphics(scene, graphics => {
    graphics.fillStyle(0x000000, 0.28).fillEllipse(36, 36, 64, 20);
    drawOutlinedRoundRect(graphics, 2, 6, 68, 28, 4, 0x92400e);
    graphics.fillStyle(0x78350f).fillRect(6, 10, 60, 3);
    graphics.fillStyle(0x78350f).fillRect(6, 27, 60, 3);
    graphics.fillStyle(0x451a03).fillRect(6, 8, 3, 24).fillRect(63, 8, 3, 24);
    graphics.generateTexture('furniture-table', 72, 40);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x000000, 0.28).fillEllipse(17, 30, 28, 10);
    drawOutlinedRoundRect(graphics, 1, 1, 32, 30, 3, 0x92400e);
    graphics.lineStyle(1, 0x451a03, 0.8);
    graphics.lineBetween(1, 10, 33, 10);
    graphics.lineBetween(1, 16, 33, 16);
    graphics.lineBetween(1, 22, 33, 22);
    graphics.lineBetween(11, 1, 11, 31);
    graphics.lineBetween(23, 1, 23, 31);
    graphics.generateTexture('furniture-crate', 34, 34);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x000000, 0.28).fillEllipse(15, 30, 24, 8);
    drawOutlinedCircle(graphics, 15, 15, 14, 0x854d0e);
    graphics.fillStyle(0x451a03).fillRect(1, 8, 28, 3).fillRect(1, 20, 28, 3);
    graphics.fillStyle(0x92400e, 0.6).fillEllipse(15, 12, 16, 5);
    graphics.generateTexture('furniture-barrel', 30, 34);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x000000, 0.26).fillEllipse(20, 34, 36, 12);
    graphics.fillStyle(0x57534e).fillEllipse(20, 18, 30, 24);
    graphics.fillStyle(0x78716c).fillEllipse(16, 12, 16, 12);
    graphics.fillStyle(0x44403c).fillEllipse(26, 24, 14, 10);
    graphics.lineStyle(1, 0x1c1917, 0.6);
    graphics.lineBetween(10, 12, 20, 24);
    graphics.lineBetween(24, 8, 18, 20);
    graphics.generateTexture('furniture-pillar', 40, 40);
  });
}

export function createGeneratedAssets(scene: Phaser.Scene) {
  if (scene.textures.exists('player-knight-down-idle-0')) {
    return;
  }

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x475569).fillRect(0, 0, 32, 32);
    graphics.lineStyle(1, 0x64748b, 0.5);
    for (let y = 0; y < 32; y += 8) {
      graphics.lineBetween(0, y, 32, y);
    }
    for (let x = 0; x < 32; x += 8) {
      graphics.lineBetween(x, 0, x, 32);
    }
    graphics.generateTexture('floor-tile', 32, 32);
  });

  createFloorDecals(scene);
  createWallVariants(scene);
  createFurniture(scene);

  createCharacterFrames(scene, 'player-knight', {
    armor: 0x1d4ed8,
    armorDark: 0x1e3a8a,
    armorLight: 0x93c5fd,
    cloth: 0x991b1b,
    clothDark: 0x7f1d1d,
    skin: 0xfacc15,
    trim: 0xeab308,
    eye: 0x0f172a
  });

  createCharacterFrames(scene, 'armoured-skeleton', {
    armor: 0x6b7280,
    armorDark: 0x374151,
    armorLight: 0xd1d5db,
    cloth: 0x4b5563,
    clothDark: 0x1f2937,
    skin: 0xd1d5db,
    trim: 0x9ca3af,
    eye: 0x111827
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0xd1d5db).fillRoundedRect(0, 7, 70, 8, 4);
    graphics.fillStyle(0xf8fafc).fillTriangle(66, 3, 86, 11, 66, 19);
    graphics.fillStyle(0x78350f).fillRect(0, 5, 14, 12);
    graphics.generateTexture('sword-heavy', 88, 22);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x0f766e).fillRoundedRect(2, 2, 24, 34, 9);
    graphics.lineStyle(3, 0x99f6e4).strokeRoundedRect(2, 2, 24, 34, 9);
    graphics.lineStyle(2, 0x134e4a).lineBetween(14, 3, 14, 35);
    graphics.generateTexture('shield-kite', 28, 38);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0xef4444).fillCircle(8, 8, 8).fillCircle(20, 8, 8);
    graphics.fillTriangle(0, 11, 28, 11, 14, 28);
    graphics.generateTexture('heart', 28, 28);
  });

  withGraphics(scene, graphics => {
    graphics.lineStyle(4, 0xfbbf24, 0.95);
    graphics.strokeCircle(18, 18, 14);
    graphics.lineStyle(2, 0xffffff, 0.8);
    graphics.lineBetween(8, 18, 28, 18);
    graphics.generateTexture('block-flash', 36, 36);
  });
}
