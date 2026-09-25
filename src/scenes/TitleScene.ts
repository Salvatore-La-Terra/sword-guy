import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants';
import { startMedievalMusic, unlockSound } from '../game/sound';

/**
 * Standalone medieval title screen for Sword Guy.
 *
 * The scene is fully self-contained: it only uses generated Phaser shapes and
 * text (no external assets) and it never starts gameplay on its own. The player
 * must explicitly choose to begin by clicking the START GAME button or pressing
 * Enter / Space, which then calls `this.scene.start('GameScene')`.
 */
export class TitleScene extends Phaser.Scene {
  private started = false;
  private startButton?: Phaser.GameObjects.Rectangle;
  private startLabel?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('TitleScene');
  }

  create() {
    this.started = false;

    this.buildBackdrop();
    this.buildCastle();
    this.buildAmbientMotes();
    this.buildTitle();
    this.buildBriefing();
    this.buildStartControls();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', this.handleConfirmKey, this);
      this.input.keyboard?.off('keydown-SPACE', this.handleConfirmKey, this);
    });
  }

  private buildBackdrop() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0b1020, 0x0b1020, 0x1f2937, 0x111827, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const moon = this.add.circle(GAME_WIDTH - 180, 130, 46, 0xfef3c7, 0.92);
    const moonGlow = this.add.circle(GAME_WIDTH - 180, 130, 74, 0xfef3c7, 0.12);
    this.tweens.add({
      targets: moonGlow,
      scale: { from: 1, to: 1.12 },
      alpha: { from: 0.12, to: 0.2 },
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    moon.setDepth(0);
    moonGlow.setDepth(0);

    for (let index = 0; index < 46; index += 1) {
      const star = this.add.rectangle(
        Phaser.Math.Between(20, GAME_WIDTH - 20),
        Phaser.Math.Between(20, 360),
        2,
        2,
        0xe2e8f0,
        Phaser.Math.FloatBetween(0.35, 0.9)
      );
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: 0.15 },
        duration: Phaser.Math.Between(1600, 3800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        ease: 'Sine.easeInOut'
      });
    }

    const ground = this.add.graphics();
    ground.fillStyle(0x0f172a, 1);
    ground.fillRect(0, GAME_HEIGHT - 120, GAME_WIDTH, 120);
    ground.fillStyle(0x1e293b, 1);
    ground.fillRect(0, GAME_HEIGHT - 124, GAME_WIDTH, 6);
  }

  private buildCastle() {
    const baseY = GAME_HEIGHT - 120;
    const castle = this.add.graphics();
    castle.fillStyle(0x111c2e, 1);

    const towers: Array<{ x: number; width: number; height: number }> = [
      { x: 120, width: 96, height: 300 },
      { x: 300, width: 72, height: 230 },
      { x: 470, width: 120, height: 360 },
      { x: 700, width: 72, height: 230 },
      { x: 880, width: 96, height: 300 }
    ];

    castle.fillRect(90, baseY - 190, GAME_WIDTH - 180, 190);

    towers.forEach(tower => {
      castle.fillRect(tower.x, baseY - tower.height, tower.width, tower.height);
      const merlons = Math.max(2, Math.floor(tower.width / 24));
      for (let index = 0; index < merlons; index += 1) {
        castle.fillRect(tower.x + index * 24, baseY - tower.height - 16, 14, 16);
      }
    });

    const wallMerlons = Math.floor((GAME_WIDTH - 180) / 28);
    for (let index = 0; index < wallMerlons; index += 1) {
      castle.fillRect(90 + index * 28, baseY - 206, 16, 16);
    }

    castle.fillStyle(0x060a14, 1);
    castle.fillRect(560, baseY - 130, 80, 130);
    castle.fillStyle(0x0b1020, 1);
    castle.fillEllipse(600, baseY - 130, 80, 70);

    this.buildTorch(210, baseY - 240);
    this.buildTorch(990, baseY - 240);
    this.buildTorch(430, baseY - 150);
    this.buildTorch(770, baseY - 150);
    this.buildBanner(530, baseY - 290);
  }

  private buildTorch(x: number, y: number) {
    this.add.rectangle(x, y + 22, 6, 28, 0x3f2d1d);
    const flame = this.add.ellipse(x, y, 14, 22, 0xfbbf24, 0.95);
    const glow = this.add.circle(x, y, 34, 0xf59e0b, 0.14);

    this.tweens.add({
      targets: flame,
      scaleX: { from: 0.86, to: 1.12 },
      scaleY: { from: 1.08, to: 0.9 },
      duration: Phaser.Math.Between(420, 680),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.24 },
      scale: { from: 0.94, to: 1.14 },
      duration: Phaser.Math.Between(700, 1100),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private buildBanner(x: number, y: number) {
    this.add.rectangle(x, y + 40, 4, 80, 0x475569);
    const banner = this.add.triangle(x + 34, y + 26, 0, -22, 64, 0, 0, 22, 0x991b1b, 0.9);
    banner.setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: banner,
      scaleX: { from: 1, to: 0.82 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private buildAmbientMotes() {
    for (let index = 0; index < 18; index += 1) {
      const mote = this.add.circle(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(240, GAME_HEIGHT - 60),
        Phaser.Math.Between(1, 3),
        0xfcd34d,
        Phaser.Math.FloatBetween(0.12, 0.35)
      );
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(60, 160),
        alpha: 0,
        duration: Phaser.Math.Between(5200, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3500),
        ease: 'Sine.easeOut',
        onRepeat: () => {
          mote.y = Phaser.Math.Between(GAME_HEIGHT - 200, GAME_HEIGHT - 60);
          mote.x = Phaser.Math.Between(40, GAME_WIDTH - 40);
          mote.setAlpha(Phaser.Math.FloatBetween(0.12, 0.35));
        }
      });
    }
  }

  private buildTitle() {
    const title = this.add.text(GAME_WIDTH / 2, 118, 'SWORD GUY', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '88px',
      color: '#fde68a',
      stroke: '#7c2d12',
      strokeThickness: 10
    });
    title.setOrigin(0.5, 0.5);
    title.setShadow(0, 6, '#000000', 12, true, true);

    this.tweens.add({
      targets: title,
      y: { from: 114, to: 124 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const subtitle = this.add.text(
      GAME_WIDTH / 2,
      182,
      '~ A lone blade against the restless dead ~',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '24px',
        color: '#e2e8f0'
      }
    );
    subtitle.setOrigin(0.5, 0.5);

    this.add.rectangle(GAME_WIDTH / 2, 210, 520, 2, 0xb45309, 0.8).setOrigin(0.5, 0.5);
  }

  private buildBriefing() {
    const panel = this.add.rectangle(GAME_WIDTH / 2, 430, 880, 360, 0x0b1224, 0.82);
    panel.setStrokeStyle(3, 0xb45309, 0.9);

    const premise = this.add.text(
      GAME_WIDTH / 2,
      284,
      'The castle gates have failed and skeleton warriors pour into the courtyard.\nYou are Sword Guy, the last defender still standing.',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '20px',
        color: '#fef3c7',
        align: 'center',
        lineSpacing: 6
      }
    );
    premise.setOrigin(0.5, 0.5);

    const columnLeft = GAME_WIDTH / 2 - 400;
    const columnRight = GAME_WIDTH / 2 + 24;

    this.addSection(columnLeft, 350, 'OBJECTIVE', [
      'Survive every wave of skeletons.',
      'Each wave sends more foes than the last.',
      'Clear a wave, then choose when to advance.'
    ]);

    this.addSection(columnLeft, 476, 'CONTROLS', [
      'W A S D  -  move through the courtyard',
      'Left mouse  -  swing your sword',
      'Right mouse  -  raise your shield',
      'ESC  -  pause   |   M  -  mute sound'
    ]);

    this.addSection(columnRight, 350, 'HEALING', [
      'SPACE  -  bind a wound for +1 health.',
      'Five second cooldown between uses.',
      'Cannot be used while at full health.',
      'Health is restored between waves.'
    ]);

    this.addSection(columnRight, 476, 'SCORING & WAVES', [
      'Score rises for every skeleton felled.',
      'Clearing a whole wave grants a bonus.',
      'Waves escalate until you fall.',
      'Fall in battle and the run ends.'
    ]);
  }

  private addSection(x: number, y: number, heading: string, lines: string[]) {
    const title = this.add.text(x, y, heading, {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '20px',
      color: '#fbbf24'
    });
    title.setOrigin(0, 0.5);

    const body = this.add.text(x, y + 22, lines.join('\n'), {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '15px',
      color: '#cbd5f5',
      lineSpacing: 5
    });
    body.setOrigin(0, 0);
  }

  private buildStartControls() {
    const buttonY = GAME_HEIGHT - 158;

    const button = this.add.rectangle(GAME_WIDTH / 2, buttonY, 300, 66, 0x7f1d1d, 1);
    button.setStrokeStyle(3, 0xfbbf24, 1);
    button.setInteractive({ useHandCursor: true });
    this.startButton = button;

    const label = this.add.text(GAME_WIDTH / 2, buttonY, 'START GAME', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '30px',
      color: '#fde68a'
    });
    label.setOrigin(0.5, 0.5);
    this.startLabel = label;

    this.tweens.add({
      targets: button,
      scaleX: { from: 1, to: 1.035 },
      scaleY: { from: 1, to: 1.035 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    button.on('pointerover', () => {
      button.setFillStyle(0xb91c1c, 1);
      label.setColor('#fffbeb');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x7f1d1d, 1);
      label.setColor('#fde68a');
    });
    button.on('pointerup', () => this.beginGame());

    const hint = this.add.text(
      GAME_WIDTH / 2,
      buttonY + 60,
      'Click START GAME, or press ENTER / SPACE to take up the blade.',
      {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '17px',
        color: '#94a3b8'
      }
    );
    hint.setOrigin(0.5, 0.5);
    this.hintText = hint;

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.55, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.input.keyboard?.on('keydown-ENTER', this.handleConfirmKey, this);
    this.input.keyboard?.on('keydown-SPACE', this.handleConfirmKey, this);
  }

  private handleConfirmKey() {
    this.beginGame();
  }

  /** Starts gameplay once, only in response to an explicit player choice. */
  private beginGame() {
    if (this.started) {
      return;
    }
    this.started = true;
    unlockSound();
    startMedievalMusic();

    this.startButton?.disableInteractive();
    this.startButton?.setFillStyle(0xb91c1c, 1);
    this.startLabel?.setColor('#fffbeb');
    this.hintText?.setText('To arms!');

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GameScene');
    });
  }
}

