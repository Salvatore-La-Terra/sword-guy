import Phaser from 'phaser';

function withGraphics(scene: Phaser.Scene, draw: (graphics: Phaser.GameObjects.Graphics) => void) {
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.destroy();
}

export function createGeneratedAssets(scene: Phaser.Scene) {
  if (scene.textures.exists('player-knight')) {
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

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x334155).fillRoundedRect(0, 0, 64, 64, 7);
    graphics.fillStyle(0x1e293b).fillRect(0, 48, 64, 16);
    graphics.lineStyle(2, 0x64748b);
    graphics.strokeRoundedRect(2, 2, 60, 60, 7);
    graphics.generateTexture('wall-block', 64, 64);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x1e3a8a).fillCircle(22, 24, 16);
    graphics.fillStyle(0xfacc15).fillCircle(22, 14, 9);
    graphics.fillStyle(0x0f172a).fillTriangle(22, 2, 14, 16, 30, 16);
    graphics.fillStyle(0x7f1d1d).fillRect(18, 25, 8, 24);
    graphics.fillStyle(0xeab308).fillRect(16, 49, 12, 6);
    graphics.generateTexture('player-knight', 44, 58);
  });

  withGraphics(scene, graphics => {
    graphics.fillStyle(0x9ca3af).fillCircle(21, 18, 10);
    graphics.fillStyle(0x4b5563).fillRoundedRect(8, 24, 26, 24, 6);
    graphics.fillStyle(0xe5e7eb).fillRect(15, 11, 4, 5).fillRect(24, 11, 4, 5);
    graphics.fillStyle(0x111827).fillRect(16, 12, 2, 2).fillRect(25, 12, 2, 2);
    graphics.fillStyle(0x9ca3af).fillRect(4, 28, 7, 19).fillRect(33, 28, 7, 19);
    graphics.fillStyle(0xd1d5db).fillRect(13, 48, 6, 10).fillRect(25, 48, 6, 10);
    graphics.generateTexture('armoured-skeleton', 44, 62);
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
