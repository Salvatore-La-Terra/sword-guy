import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants';
import {
  hasReceivedUserGesture,
  isMedievalMusicPlaying,
  isSoundMuted,
  startMedievalMusic,
  toggleSoundMuted,
  unlockSound
} from '../game/sound';

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
  private musicButton?: Phaser.GameObjects.Rectangle;
  private musicLabel?: Phaser.GameObjects.Text;
  private musicStatusText?: Phaser.GameObjects.Text;
  private lastMusicStatus = '';

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
    this.buildKnightArt();
    this.buildStartControls();
    this.buildMusicControls();

    // Request the generated soundtrack as soon as the title scene opens so
    // that the very first trusted user gesture anywhere on the page (a
    // click, key press, or tap - including on the music button below)
    // activates it immediately, without requiring the player to start the
    // game first.
    startMedievalMusic();
    this.refreshMusicStatus(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', this.handleConfirmKey, this);
      this.input.keyboard?.off('keydown-SPACE', this.handleConfirmKey, this);
    });
  }

  update() {
    this.refreshMusicStatus(false);
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

  /**
   * Draws a stylised armoured knight entirely out of Phaser primitives
   * (graphics paths + basic shapes) so the title screen has a strong,
   * readable hero silhouette without any external image assets. It is
   * placed in the right-hand margin, clear of the briefing panel and the
   * start / music controls, with a few restrained looping tweens (chest
   * "breathing", a swaying cloak, and a metal glint) to keep it alive
   * without distracting from the readable UI.
   */
  private buildKnightArt() {
    const centerX = GAME_WIDTH - 105;
    const centerY = 460;

    this.add.ellipse(centerX, 606, 132, 24, 0x000000, 0.35);

    const knight = this.add.container(centerX, centerY);

    // Cloak, drawn first so the body renders on top of it.
    const cloak = this.add.graphics();
    cloak.fillStyle(0x7f1d1d, 0.92);
    cloak.beginPath();
    cloak.moveTo(-32, -80);
    cloak.lineTo(32, -80);
    cloak.lineTo(58, 108);
    cloak.lineTo(20, 94);
    cloak.lineTo(0, 116);
    cloak.lineTo(-20, 94);
    cloak.lineTo(-58, 108);
    cloak.closePath();
    cloak.fillPath();
    cloak.lineStyle(3, 0x450a0a, 0.9);
    cloak.strokePath();
    knight.add(cloak);

    // Legs, boots and belt (static lower body).
    const lowerBody = this.add.graphics();
    lowerBody.fillStyle(0x334155, 1);
    lowerBody.fillRoundedRect(-26, 60, 20, 68, 4);
    lowerBody.fillRoundedRect(6, 60, 20, 68, 4);
    lowerBody.fillStyle(0x1e293b, 1);
    lowerBody.fillRoundedRect(-30, 120, 28, 16, 4);
    lowerBody.fillRoundedRect(2, 120, 28, 16, 4);
    lowerBody.fillStyle(0x92400e, 1);
    lowerBody.fillRect(-34, 52, 68, 12);
    lowerBody.fillStyle(0xfbbf24, 1);
    lowerBody.fillCircle(0, 58, 5);
    knight.add(lowerBody);

    // Upper body (chest plate, pauldrons, helmet, plume) grouped so it can
    // "breathe" as one piece without disturbing the legs or cloak.
    const upperBody = this.add.container(0, 40);

    const chest = this.add.graphics();
    chest.fillStyle(0x64748b, 1);
    chest.beginPath();
    chest.moveTo(-30, 10);
    chest.lineTo(30, 10);
    chest.lineTo(24, -55);
    chest.lineTo(-24, -55);
    chest.closePath();
    chest.fillPath();
    chest.lineStyle(2, 0x334155, 1);
    chest.strokePath();
    chest.fillStyle(0xfbbf24, 0.9);
    chest.fillRect(-3, -40, 6, 24);
    chest.fillRect(-10, -32, 20, 6);
    upperBody.add(chest);

    const pauldronLeft = this.add.ellipse(-30, -48, 26, 22, 0x94a3b8, 1);
    pauldronLeft.setStrokeStyle(2, 0x475569, 1);
    const pauldronRight = this.add.ellipse(30, -48, 26, 22, 0x94a3b8, 1);
    pauldronRight.setStrokeStyle(2, 0x475569, 1);
    upperBody.add([pauldronLeft, pauldronRight]);

    const gorget = this.add.rectangle(0, -58, 16, 12, 0x475569, 1);
    upperBody.add(gorget);

    const helmet = this.add.graphics();
    helmet.fillStyle(0x94a3b8, 1);
    helmet.fillEllipse(0, -84, 46, 50);
    helmet.lineStyle(2, 0x334155, 1);
    helmet.strokeEllipse(0, -84, 46, 50);
    helmet.fillStyle(0x64748b, 1);
    helmet.fillRect(-23, -86, 46, 14);
    helmet.fillStyle(0x1e293b, 1);
    helmet.fillRect(-14, -82, 28, 8);
    upperBody.add(helmet);

    const plume = this.add.graphics();
    plume.fillStyle(0xb45309, 0.95);
    plume.beginPath();
    plume.moveTo(0, -108);
    plume.lineTo(-8, -140);
    plume.lineTo(0, -130);
    plume.lineTo(8, -140);
    plume.closePath();
    plume.fillPath();
    plume.fillStyle(0xfbbf24, 0.9);
    plume.fillTriangle(0, -108, -4, -126, 4, -126);
    upperBody.add(plume);

    knight.add(upperBody);

    // Shield, held out to the knight's viewer-left side.
    const shield = this.add.container(-52, 10);
    const shieldBody = this.add.graphics();
    shieldBody.fillStyle(0x475569, 1);
    shieldBody.fillRoundedRect(-20, -34, 40, 60, { tl: 8, tr: 8, bl: 8, br: 20 });
    shieldBody.lineStyle(3, 0xfbbf24, 0.9);
    shieldBody.strokeRoundedRect(-20, -34, 40, 60, { tl: 8, tr: 8, bl: 8, br: 20 });
    shieldBody.fillStyle(0x991b1b, 0.95);
    shieldBody.fillRect(-4, -28, 8, 48);
    shieldBody.fillRect(-16, -6, 32, 8);
    shield.add(shieldBody);
    const shieldGlint = this.add.rectangle(-6, -20, 8, 50, 0xffffff, 0.1);
    shieldGlint.setAngle(18);
    shield.add(shieldGlint);
    knight.add(shield);

    // Sword, raised on the viewer-right side.
    const sword = this.add.container(48, -10);
    sword.setAngle(-14);
    const blade = this.add.rectangle(0, -70, 10, 130, 0xcbd5e1, 1);
    blade.setStrokeStyle(1, 0x64748b, 1);
    const bladeTip = this.add.triangle(0, -140, -5, 6, 5, 6, 0, -6, 0xcbd5e1, 1);
    const crossguard = this.add.rectangle(0, 0, 34, 8, 0xb45309, 1);
    const grip = this.add.rectangle(0, 16, 8, 28, 0x78350f, 1);
    const pommel = this.add.circle(0, 32, 6, 0xfbbf24, 1);
    sword.add([blade, bladeTip, crossguard, grip, pommel]);
    const swordGlint = this.add.rectangle(0, -70, 4, 110, 0xffffff, 0.1);
    sword.add(swordGlint);
    knight.add(sword);

    // Restrained ambient animation: breathing, cloak sway and a metal glint.
    this.tweens.add({
      targets: upperBody,
      scaleY: { from: 1, to: 1.035 },
      y: { from: 40, to: 37 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: cloak,
      angle: { from: -3, to: 3 },
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: [shieldGlint, swordGlint],
      alpha: { from: 0.06, to: 0.5 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      delay: 500,
      ease: 'Sine.easeInOut'
    });
  }

  private buildMusicControls() {
    const panelX = 150;
    const panelY = 60;

    const button = this.add.rectangle(panelX, panelY, 220, 52, 0x1e293b, 1);
    button.setStrokeStyle(2, 0xfbbf24, 0.9);
    button.setInteractive({ useHandCursor: true });
    this.musicButton = button;

    const label = this.add.text(panelX, panelY, '\ud83c\udfb5 ENABLE MUSIC', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '17px',
      color: '#fde68a'
    });
    label.setOrigin(0.5, 0.5);
    this.musicLabel = label;

    const status = this.add.text(panelX, panelY + 34, 'Music: waiting for a click or key press...', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '13px',
      color: '#94a3b8'
    });
    status.setOrigin(0.5, 0.5);
    status.setWordWrapWidth(240, true);
    this.musicStatusText = status;

    button.on('pointerover', () => button.setFillStyle(0x334155, 1));
    button.on('pointerout', () => button.setFillStyle(0x1e293b, 1));
    // Separate, explicit gesture that only affects audio - it never starts
    // gameplay. Clicking it both counts as the trusted user gesture browsers
    // require before audio can play, and lets the player mute/unmute freely.
    button.on('pointerup', () => this.toggleMusic());
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

  /**
   * Explicit music enable/mute control, independent of the game-start gate.
   * The pointerup event itself is a trusted gesture, so this both satisfies
   * the browser's autoplay requirement and lets the player mute at will.
   */
  private toggleMusic() {
    unlockSound();
    toggleSoundMuted();
    this.refreshMusicStatus(true);
  }

  /** Keeps the music button/status text in sync with the real audio state. */
  private refreshMusicStatus(force: boolean) {
    if (!this.musicStatusText || !this.musicLabel || !this.musicButton) {
      return;
    }

    const muted = isSoundMuted();
    const playing = isMedievalMusicPlaying();
    const unlocked = hasReceivedUserGesture();

    let status: string;
    if (muted) {
      status = 'muted';
    } else if (playing) {
      status = 'playing';
    } else if (unlocked) {
      status = 'starting';
    } else {
      status = 'waiting';
    }

    if (!force && status === this.lastMusicStatus) {
      return;
    }
    this.lastMusicStatus = status;

    switch (status) {
      case 'muted':
        this.musicButton.setFillStyle(0x3f1d1d, 1);
        this.musicLabel.setText('\ud83c\udfb5 UNMUTE MUSIC');
        this.musicStatusText.setText('Music: muted - click to unmute.');
        break;
      case 'playing':
        this.musicButton.setFillStyle(0x14532d, 1);
        this.musicLabel.setText('\ud83c\udfb5 MUTE MUSIC');
        this.musicStatusText.setText('Music: playing.');
        break;
      case 'starting':
        this.musicButton.setFillStyle(0x1e293b, 1);
        this.musicLabel.setText('\ud83c\udfb5 MUTE MUSIC');
        this.musicStatusText.setText('Music: starting...');
        break;
      case 'waiting':
      default:
        this.musicButton.setFillStyle(0x1e293b, 1);
        this.musicLabel.setText('\ud83c\udfb5 ENABLE MUSIC');
        this.musicStatusText.setText('Music: click here (or anywhere) to enable.');
        break;
    }
  }
}

