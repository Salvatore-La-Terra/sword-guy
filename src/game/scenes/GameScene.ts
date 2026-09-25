import Phaser from 'phaser';

type FacingDirection = 'up' | 'down' | 'left' | 'right';
type EnemyShape = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private statusText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  private facing: FacingDirection = 'down';
  private readonly attackCooldownMs = 400;
  private readonly attackDurationMs = 150;
  private lastAttackTime = -Infinity;
  private isAttacking = false;
  private slashGraphic?: Phaser.GameObjects.Arc;
  private enemies: EnemyShape[] = [];

  private readonly enemySpawnIntervalMs = 1400;
  private readonly enemySpawnMargin = 28;
  private readonly maxEnemies = 8;
  private readonly enemySpeed = 85;
  private enemySpawnEvent?: Phaser.Time.TimerEvent;

  // Sword hit-detection tuning: a short-range cone in front of the player,
  // active only while a slash is in progress.
  private readonly attackRange = 64;
  private readonly attackHalfAngleDeg = 55;
  private enemiesHitThisSwing = new Set<EnemyShape>();
  private killCount = 0;

  // Health / defeat state
  private readonly maxHealth = 100;
  private health = this.maxHealth;
  private readonly contactDamage = 15;
  private readonly contactRadius = 24;
  private readonly playerInvulnerabilityMs = 700;
  private lastHitTime = -Infinity;
  private readonly playerBaseColor = 0xc9d6df;
  private readonly playerHitColor = 0xff5c5c;
  private isDefeated = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // Reset all mutable round state so a restart begins a fresh round.
    this.facing = 'down';
    this.lastAttackTime = -Infinity;
    this.isAttacking = false;
    this.slashGraphic = undefined;
    this.enemies = [];
    this.health = this.maxHealth;
    this.lastHitTime = -Infinity;
    this.isDefeated = false;
    this.gameOverText = undefined;
    this.killCount = 0;
    this.enemiesHitThisSwing.clear();

    this.add
      .grid(width / 2, height / 2, width, height, 48, 48, 0x1d2b36, 1, 0x2b3c49, 0.45)
      .setDepth(-1);

    this.player = this.add.rectangle(width / 2, height / 2, 34, 46, this.playerBaseColor);
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
    this.healthText = this.add.text(24, 78, '', {
      color: '#f5f7fa',
      fontFamily: 'monospace',
      fontSize: '16px'
    });
    this.killText = this.add.text(24, 104, '', {
      color: '#f5f7fa',
      fontFamily: 'monospace',
      fontSize: '16px'
    });
    this.updateHealthText();
    this.updateKillText();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'up' | 'down' | 'left' | 'right',
      Phaser.Input.Keyboard.Key
    >;
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.enemySpawnEvent = this.time.addEvent({
      delay: this.enemySpawnIntervalMs,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true
    });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
      return;
    }

    if (this.isDefeated) {
      return;
    }

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
    this.checkAttackHits();
    this.updateEnemies(deltaSeconds);
    this.handleEnemyContactDamage();

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

  private spawnEnemy(): void {
    if (this.isDefeated) return;
    if (this.enemies.length >= this.maxEnemies) return;

    const { x, y } = this.getRandomEdgeSpawnPoint();
    const enemy =
      this.enemies.length % 2 === 0
        ? this.add.rectangle(x, y, 30, 30, 0xd94f4f)
        : this.add.ellipse(x, y, 30, 24, 0x8f5fd7);

    enemy.setStrokeStyle(2, 0x2b1d2b, 1);
    enemy.setDepth(2);
    this.enemies.push(enemy);
  }

  private getRandomEdgeSpawnPoint(): { x: number; y: number } {
    const { width, height } = this.scale;
    const margin = this.enemySpawnMargin;
    const side = Phaser.Math.Between(0, 3);

    if (side === 0) {
      return { x: -margin, y: Phaser.Math.Between(margin, height - margin) };
    }
    if (side === 1) {
      return { x: width + margin, y: Phaser.Math.Between(margin, height - margin) };
    }
    if (side === 2) {
      return { x: Phaser.Math.Between(margin, width - margin), y: -margin };
    }
    return { x: Phaser.Math.Between(margin, width - margin), y: height + margin };
  }

  private updateEnemies(deltaSeconds: number): void {
    for (const enemy of this.enemies) {
      const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.x += Math.cos(angleToPlayer) * this.enemySpeed * deltaSeconds;
      enemy.y += Math.sin(angleToPlayer) * this.enemySpeed * deltaSeconds;
    }
  }

  private handleEnemyContactDamage(): void {
    const now = this.time.now;
    if (now - this.lastHitTime < this.playerInvulnerabilityMs) {
      return;
    }

    const touchingEnemy = this.enemies.some(
      (enemy) => Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < this.contactRadius
    );

    if (touchingEnemy) {
      this.applyDamageToPlayer(this.contactDamage, now);
    }
  }

  private applyDamageToPlayer(amount: number, hitTime: number): void {
    this.lastHitTime = hitTime;
    this.health = Phaser.Math.Clamp(this.health - amount, 0, this.maxHealth);
    this.updateHealthText();
    this.showPlayerHitFeedback();

    if (this.health <= 0) {
      this.triggerGameOver();
    }
  }

  private showPlayerHitFeedback(): void {
    this.player.setFillStyle(this.playerHitColor);
    this.cameras.main.shake(120, 0.006);
    this.time.delayedCall(150, () => {
      this.player.setFillStyle(this.playerBaseColor);
    });
  }

  private updateHealthText(): void {
    this.healthText.setText(`HP: ${this.health}/${this.maxHealth}`);
  }

  private triggerGameOver(): void {
    if (this.isDefeated) return;

    this.isDefeated = true;
    this.isAttacking = false;
    this.slashGraphic?.destroy();
    this.slashGraphic = undefined;
    this.enemySpawnEvent?.remove();
    this.enemySpawnEvent = undefined;

    this.statusText.setText('You have fallen.');
    this.gameOverText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'GAME OVER\nPress R to restart',
      {
        color: '#ff5c5c',
        fontFamily: 'monospace',
        fontSize: '32px',
        align: 'center'
      }
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setDepth(10);
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
    this.enemiesHitThisSwing.clear();
    this.time.delayedCall(this.attackDurationMs, () => {
      this.isAttacking = false;
    });
    this.spawnSlashEffect();
  }

  /**
   * While a slash is active, checks enemies within a short range and
   * narrow cone in front of the player and removes any that are hit.
   * Each enemy can only be hit once per swing.
   */
  private checkAttackHits(): void {
    if (!this.isAttacking || this.isDefeated || this.enemies.length === 0) return;

    const facingAngleDeg: Record<FacingDirection, number> = {
      right: 0,
      down: 90,
      left: 180,
      up: -90
    };
    const attackAngleDeg = facingAngleDeg[this.facing];

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (this.enemiesHitThisSwing.has(enemy)) continue;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      );
      if (distance > this.attackRange) continue;

      const angleToEnemyDeg = Phaser.Math.RadToDeg(
        Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y)
      );
      const angleDiff = Math.abs(Phaser.Math.Angle.WrapDegrees(angleToEnemyDeg - attackAngleDeg));
      if (angleDiff > this.attackHalfAngleDeg) continue;

      this.enemiesHitThisSwing.add(enemy);
      this.defeatEnemy(enemy, i);
    }
  }

  private defeatEnemy(enemy: EnemyShape, index: number): void {
    this.enemies.splice(index, 1);
    enemy.destroy();
    this.killCount += 1;
    this.updateKillText();
  }

  private updateKillText(): void {
    this.killText.setText(`Kills: ${this.killCount}`);
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
