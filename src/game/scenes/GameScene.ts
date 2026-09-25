import Phaser from 'phaser';

type FacingDirection = 'up' | 'down' | 'left' | 'right';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private statusText!: Phaser.GameObjects.Text;

  private facing: FacingDirection = 'down';
  private readonly attackCooldownMs = 400;
  private readonly attackDurationMs = 150;
  private lastAttackTime = -Infinity;
  private isAttacking = false;
  private slashGraphic?: Phaser.GameObjects.Arc;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .grid(width / 2, height / 2, width, height, 48, 48, 0x1d2b36, 1, 0x2b3c49, 0.45)
      .setDepth(-1);

    this.player = this.add.rectangle(width / 2, height / 2, 34, 46, 0xc9d6df);
    this.add.rectangle(width / 2, height / 2 - 31, 28, 18, 0xe5b567);
    this.add.text(24, 20, 'SWORD GUY', {
      color: '#f5f7fa',
      fontFamily: 'monospace',
      fontSize: '24px'
    });
    this.statusText = this.add.text(24, 52, 'Move with arrows or WASD | Space to attack', {
      color: '#a8bac8',
      fontFamily: 'monospace',
      fontSize: '16px'
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'up' | 'down' | 'left' | 'right',
      Phaser.Input.Keyboard.Key
    >;
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update(): void {
    const speed = 220;
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) velocityX -= speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) velocityX += speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) velocityY -= speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) velocityY += speed;

    if (velocityX !== 0 || velocityY !== 0) {
      this.facing = this.resolveFacing(velocityX, velocityY);
    }

    const deltaSeconds = this.game.loop.delta / 1000;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + velocityX * deltaSeconds,
      this.player.width / 2,
      this.scale.width - this.player.width / 2
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + velocityY * deltaSeconds,
      this.player.height / 2,
      this.scale.height - this.player.height / 2
    );

    this.handleAttackInput();
    this.updateSlashEffect();

    if (this.isAttacking) {
      this.statusText.setText('Attacking!');
    } else if (velocityX === 0 && velocityY === 0) {
      this.statusText.setText('Move with arrows or WASD | Space to attack');
    } else {
      this.statusText.setText('Prototype movement active');
    }
  }

  private resolveFacing(velocityX: number, velocityY: number): FacingDirection {
    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      return velocityX > 0 ? 'right' : 'left';
    }
    return velocityY > 0 ? 'down' : 'up';
  }

  private handleAttackInput(): void {
    const now = this.time.now;
    const offCooldown = now - this.lastAttackTime >= this.attackCooldownMs;

    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && offCooldown) {
      this.lastAttackTime = now;
      this.performAttack();
    }
  }

  private performAttack(): void {
    this.isAttacking = true;
    this.time.delayedCall(this.attackDurationMs, () => {
      this.isAttacking = false;
    });
    this.spawnSlashEffect();
  }

  private spawnSlashEffect(): void {
    this.slashGraphic?.destroy();

    const offset = 34;
    const offsets: Record<FacingDirection, { x: number; y: number; angle: number }> = {
      up: { x: 0, y: -offset, angle: -90 },
      down: { x: 0, y: offset, angle: 90 },
      left: { x: -offset, y: 0, angle: 180 },
      right: { x: offset, y: 0, angle: 0 }
    };
    const { x, y, angle } = offsets[this.facing];

    const slash = this.add.arc(
      this.player.x + x,
      this.player.y + y,
      26,
      -50,
      50,
      false,
      0xfef3c7,
      0.9
    );
    slash.setStrokeStyle(3, 0xffffff, 1);
    slash.setAngle(angle);
    slash.setDepth(5);
    this.slashGraphic = slash;

    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: this.attackDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        slash.destroy();
        if (this.slashGraphic === slash) {
          this.slashGraphic = undefined;
        }
      }
    });
  }

  private updateSlashEffect(): void {
    if (!this.slashGraphic || !this.isAttacking) return;

    const offset = 34;
    const offsets: Record<FacingDirection, { x: number; y: number }> = {
      up: { x: 0, y: -offset },
      down: { x: 0, y: offset },
      left: { x: -offset, y: 0 },
      right: { x: offset, y: 0 }
    };
    const { x, y } = offsets[this.facing];
    this.slashGraphic.setPosition(this.player.x + x, this.player.y + y);
  }
}
