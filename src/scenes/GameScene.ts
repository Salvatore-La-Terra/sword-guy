import Phaser from 'phaser';
import { createGeneratedAssets } from '../game/assets';
import {
  spawnBlockEffect,
  spawnDeathEffect,
  spawnHealEffect,
  spawnHitEffect
} from '../game/combatEffects';
import { ARENA, COMBAT, FURNITURE, GAME_HEIGHT, GAME_WIDTH, PLAYER, SKELETON, TOTAL_WAVES } from '../game/constants';
import { angleBetween, angleDifference, directionFromAngle } from '../game/math';
import { SceneTransitions } from '../game/sceneTransitions';
import { createScoreFeedback, type ScoreFeedback } from '../game/scoreFeedback';
import { playSound, toggleSoundMuted, unlockSound } from '../game/sound';
import type { Fighter, Player, Skeleton } from '../game/types';

type Keys = Record<'w' | 'a' | 's' | 'd' | 'esc' | 'space' | 'enter' | 'm', Phaser.Input.Keyboard.Key>;
type VisualDirection = 'down' | 'up' | 'side';

const HEAL_AMOUNT = 1;
const HEAL_COOLDOWN_MS = 5000;

export class GameScene extends Phaser.Scene {
  private keys?: Keys;
  private player?: Player;
  private skeletons: Skeleton[] = [];
  private wave = 1;
  private leftMouseWasDown = false;
  private waveText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private scoreFeedback?: ScoreFeedback;
  private transitions?: SceneTransitions;
  private hearts: Phaser.GameObjects.Image[] = [];
  private characterColliders: Phaser.Physics.Arcade.Collider[] = [];
  private obstacleGroup?: Phaser.Physics.Arcade.StaticGroup;
  private obstacles: { center: Phaser.Math.Vector2; radius: number }[] = [];
  private playerObstacleCollider?: Phaser.Physics.Arcade.Collider;
  private awaitingNextWave = false;
  private defeat = false;
  private victory = false;
  private paused = false;
  private pausedAt = 0;
  private healCooldownUntil = 0;

  constructor() {
    super('GameScene');
  }

  create() {
    createGeneratedAssets(this);
    this.input.mouse?.disableContextMenu();
    this.physics.world.setBounds(
      ARENA.left,
      ARENA.top,
      ARENA.right - ARENA.left,
      ARENA.bottom - ARENA.top
    );

    this.createArena();
    this.createUi();
    this.transitions = new SceneTransitions(this);
    this.keys = this.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      m: Phaser.Input.Keyboard.KeyCodes.M
    }) as Keys;
    this.startGame();
  }

  update(time: number) {
    if (!this.player || !this.keys) {
      return;
    }

    const pointer = this.input.activePointer;
    const playerPos = this.positionOf(this.player);
    const pointerPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    const pointerDirection = angleBetween(playerPos, pointerPos);
    const leftMouseDown = pointer.leftButtonDown();
    const rightMouseDown = pointer.rightButtonDown();

    if (Phaser.Input.Keyboard.JustDown(this.keys.m)) {
      toggleSoundMuted();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
      this.setPaused(!this.paused, time);
      this.leftMouseWasDown = leftMouseDown;
      return;
    }

    if (this.paused) {
      this.leftMouseWasDown = leftMouseDown;
      return;
    }

    if (this.defeat) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
        this.startGame();
      }
      this.leftMouseWasDown = leftMouseDown;
      return;
    }

    if (this.victory) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
        this.startGame();
      }
      this.leftMouseWasDown = leftMouseDown;
      return;
    }

    if (this.awaitingNextWave) {
      if (leftMouseDown && !this.leftMouseWasDown) {
        this.awaitingNextWave = false;
        this.promptText?.setText('');
        this.player.sprite.clearTint();
        this.player.sword.setVisible(false);
        this.player.shield.setVisible(false);
        this.player.sprite.setVelocity(0);
        this.player.state = 'idle';
        this.wave += 1;
        this.startWave();
      }
      this.leftMouseWasDown = leftMouseDown;
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.tryHeal(time);
    }

    this.advanceFighterState(this.player, time, rightMouseDown);
    for (const skeleton of this.skeletons) {
      this.advanceFighterState(skeleton, time, false);
    }

    if (rightMouseDown && this.canShield(this.player)) {
      this.beginShield(this.player, pointerDirection);
    }

    if (leftMouseDown && !this.leftMouseWasDown && this.canAttack(this.player)) {
      this.beginAttack(this.player, pointerDirection, time);
    }

    this.updatePlayerMovement(pointerDirection);
    for (const skeleton of this.skeletons) {
      this.updateSkeleton(skeleton, time);
    }

    this.resolveActiveAttacks(time);
    this.updateVisuals(time);
    this.updateUi();
    this.leftMouseWasDown = leftMouseDown;
  }

  private createArena() {
    this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      'floor-tile'
    );

    this.scatterFloorDecals();

    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0x111827);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 60, 0x111827);
    this.add.rectangle(22, GAME_HEIGHT / 2, 44, GAME_HEIGHT, 0x111827);
    this.add.rectangle(GAME_WIDTH - 22, GAME_HEIGHT / 2, 44, GAME_HEIGHT, 0x111827);

    const wallTexture = () => (Phaser.Math.Between(1, 5) === 1 ? 'wall-block-worn' : 'wall-block');
    for (let x = 48; x <= GAME_WIDTH - 48; x += 64) {
      this.add.image(x, 42, wallTexture());
      this.add.image(x, GAME_HEIGHT - 22, wallTexture());
    }
    for (let y = 112; y <= GAME_HEIGHT - 108; y += 64) {
      this.add.image(24, y, wallTexture());
      this.add.image(GAME_WIDTH - 24, y, wallTexture());
    }

    this.add.rectangle(GAME_WIDTH / 2, ARENA.top, 520, 8, 0x94a3b8, 0.55);
    this.add.rectangle(GAME_WIDTH / 2, ARENA.bottom, 520, 8, 0x94a3b8, 0.55);

    this.createFurniture();
  }

  private scatterFloorDecals() {
    const rng = new Phaser.Math.RandomDataGenerator(['arena-decor']);
    const cracks = ['floor-crack-a', 'floor-crack-b'];
    const bloods = ['floor-blood-a', 'floor-blood-b'];
    const decalCount = 22;

    for (let index = 0; index < decalCount; index += 1) {
      const x = rng.between(ARENA.left + 40, ARENA.right - 40);
      const y = rng.between(ARENA.top + 40, ARENA.bottom - 40);
      const roll = rng.frac();

      if (roll < 0.5) {
        const texture = rng.pick(cracks);
        this.add.image(x, y, texture).setAlpha(0.8).setRotation(rng.rotation());
      } else if (roll < 0.82) {
        const texture = rng.pick(bloods);
        this.add.image(x, y, texture).setRotation(rng.rotation());
      } else {
        this.add.image(x, y, 'floor-skull').setRotation(rng.between(-20, 20) * 0.02);
      }
    }
  }

  private createFurniture() {
    this.obstacleGroup = this.physics.add.staticGroup();
    this.obstacles = [];

    for (const item of FURNITURE) {
      const sprite = this.obstacleGroup.create(item.x, item.y, item.key) as Phaser.Physics.Arcade.Sprite;
      sprite.setSize(item.width, item.height);
      sprite.refreshBody();

      this.obstacles.push({
        center: new Phaser.Math.Vector2(item.x, item.y),
        radius: Math.hypot(item.width, item.height) / 2
      });
    }
  }

  private createUi() {
    this.waveText = this.add.text(24, 18, '', {
      color: '#f8fafc',
      fontFamily: 'Arial',
      fontSize: '20px'
    }).setDepth(20);
    this.scoreText = this.add.text(GAME_WIDTH - 190, 18, '', {
      color: '#facc15',
      fontFamily: 'Arial',
      fontSize: '20px'
    }).setDepth(20);
    this.scoreFeedback = createScoreFeedback(this, this.scoreText);
    this.promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      align: 'center',
      color: '#f8fafc',
      fontFamily: 'Arial',
      fontSize: '28px',
      stroke: '#020617',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(30);

    this.hearts = [];
    for (let index = 0; index < PLAYER.maxHealth; index += 1) {
      this.hearts.push(this.add.image(150 + index * 31, 29, 'heart').setDepth(20));
    }
  }

  private startGame() {
    this.wave = 1;
    this.defeat = false;
    this.victory = false;
    this.awaitingNextWave = false;
    this.healCooldownUntil = 0;
    this.scoreFeedback?.reset();
    this.setPaused(false, this.time.now);
    this.promptText?.setText('');
    this.createPlayer();
    this.startWave();
    this.transitions?.playRestart();
  }

  private createPlayer() {
    this.player?.sprite.destroy();
    this.player?.sword.destroy();
    this.player?.shield.destroy();

    const start = this.playerStart();
    const sprite = this.physics.add.sprite(start.x, start.y, 'player-knight-down-idle-0');
    sprite.setCircle(18, 6, 17);
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.05);
    sprite.setDepth(10);

    this.player = {
      id: 'player',
      sprite,
      sword: this.add.image(start.x, start.y, 'sword-heavy').setVisible(false).setDepth(13),
      shield: this.add.image(start.x, start.y, 'shield-kite').setVisible(false).setDepth(14),
      texturePrefix: 'player-knight',
      hp: PLAYER.maxHealth,
      facing: -Math.PI / 2,
      state: 'idle',
      stateEndsAt: 0,
      attackDirection: -Math.PI / 2,
      attackHitIds: new Set<string>()
    };

    this.playerObstacleCollider?.destroy();
    if (this.obstacleGroup) {
      this.playerObstacleCollider = this.physics.add.collider(sprite, this.obstacleGroup);
    }
  }

  private startWave() {
    this.clearCharacterColliders();
    for (const skeleton of this.skeletons) {
      this.destroySkeleton(skeleton);
    }
    this.skeletons = [];
    const start = this.playerStart();
    this.player?.sprite.setPosition(start.x, start.y);
    this.player?.sprite.setVelocity(0);
    if (this.player) {
      this.player.state = 'idle';
      this.player.hp = PLAYER.maxHealth;
    }

    const count = this.wave + 2;

    for (let index = 0; index < count; index += 1) {
      const point = this.spawnPointFor(index, start);
      this.skeletons.push(this.createSkeleton(index, point));
    }
    this.setupCharacterCollisions();
    this.transitions?.playWaveStart(this.wave);
    playSound('waveStart');
  }

  private createSkeleton(index: number, point: Phaser.Math.Vector2): Skeleton {
    const sprite = this.physics.add.sprite(point.x, point.y, 'armoured-skeleton-down-idle-0');
    sprite.setCircle(18, 6, 18);
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.05);
    sprite.setDepth(9);

    const healthPips: Phaser.GameObjects.Arc[] = [];
    for (let pip = 0; pip < SKELETON.health; pip += 1) {
      healthPips.push(this.add.circle(point.x, point.y, 3, 0xf87171).setDepth(9));
    }

    return {
      id: `skeleton-${this.wave}-${index}`,
      sprite,
      sword: this.add.image(point.x, point.y, 'sword-heavy').setVisible(false).setDepth(12),
      shield: this.add.image(point.x, point.y, 'shield-kite').setVisible(false).setDepth(11),
      texturePrefix: 'armoured-skeleton',
      hp: SKELETON.health,
      facing: Math.PI / 2,
      state: 'idle',
      stateEndsAt: 0,
      attackDirection: Math.PI / 2,
      attackHitIds: new Set<string>(),
      home: point.clone(),
      patrolTarget: this.randomPatrolPoint(point),
      nextDecisionAt: 0,
      attackCooldownUntil: 0,
      guardUntil: 0,
      healthPips
    };
  }

  private updatePlayerMovement(pointerDirection: number) {
    if (!this.player || !this.keys) {
      return;
    }

    const player = this.player;
    const canMove = player.state === 'idle' || player.state === 'shield';
    if (!canMove) {
      if (player.state !== 'stagger') {
        player.sprite.setVelocity(0);
      }
      return;
    }

    const movement = new Phaser.Math.Vector2(0, 0);
    if (this.keys.a.isDown) {
      movement.x -= 1;
    }
    if (this.keys.d.isDown) {
      movement.x += 1;
    }
    if (this.keys.w.isDown) {
      movement.y -= 1;
    }
    if (this.keys.s.isDown) {
      movement.y += 1;
    }

    if (movement.lengthSq() > 0) {
      movement.normalize();
      const speed = player.state === 'shield' ? PLAYER.speed * 0.46 : PLAYER.speed;
      player.sprite.setVelocity(movement.x * speed, movement.y * speed);
      if (player.state === 'idle') {
        player.facing = movement.angle();
      }
    } else {
      player.sprite.setVelocity(0);
    }

    if (player.state === 'shield') {
      player.facing = pointerDirection;
      player.attackDirection = pointerDirection;
    }
  }

  private updateSkeleton(skeleton: Skeleton, time: number) {
    if (!this.player || skeleton.state === 'dead') {
      return;
    }

    if (skeleton.state !== 'idle' && skeleton.state !== 'shield') {
      if (skeleton.state !== 'stagger') {
        skeleton.sprite.setVelocity(0);
      }
      return;
    }

    const skeletonPos = this.positionOf(skeleton);
    const playerPos = this.positionOf(this.player);
    const distanceToPlayer = skeletonPos.distance(playerPos);
    const directionToPlayer = angleBetween(skeletonPos, playerPos);
    skeleton.facing = directionToPlayer;

    if (skeleton.state === 'shield') {
      skeleton.sprite.setVelocity(0);
      return;
    }

    if (
      distanceToPlayer < COMBAT.attackRange - 6 &&
      time >= skeleton.attackCooldownUntil
    ) {
      if (Math.random() < SKELETON.guardChance && this.player.state === 'windup') {
        this.beginShield(skeleton, directionToPlayer, time + SKELETON.guardDuration);
        return;
      }
      this.beginAttack(skeleton, directionToPlayer, time);
      skeleton.attackCooldownUntil = time + SKELETON.attackCooldown;
      return;
    }

    if (distanceToPlayer <= SKELETON.aggroRange) {
      this.moveToward(skeleton, playerPos, SKELETON.chaseSpeed);
      return;
    }

    if (
      skeletonPos.distance(skeleton.patrolTarget) < 10 ||
      time >= skeleton.nextDecisionAt
    ) {
      skeleton.patrolTarget = this.randomPatrolPoint(skeleton.home);
      skeleton.nextDecisionAt = time + Phaser.Math.Between(1400, 2600);
    }
    this.moveToward(skeleton, skeleton.patrolTarget, SKELETON.patrolSpeed);
  }

  private moveToward(fighter: Fighter, target: Phaser.Math.Vector2, speed: number) {
    const position = this.positionOf(fighter);
    const direction = target.clone().subtract(position);
    if (direction.lengthSq() === 0) {
      fighter.sprite.setVelocity(0);
      return;
    }
    direction.normalize();

    const avoidance = this.obstacleAvoidance(position, direction);
    if (avoidance) {
      direction.add(avoidance).normalize();
    }

    fighter.sprite.setVelocity(direction.x * speed, direction.y * speed);
  }

  // Simple lookahead steering: skeletons walk straight toward their target
  // but veer sideways around any obstacle that sits close to their path, so
  // patrol and chase routes flow around furniture instead of getting stuck
  // pressed against it.
  private obstacleAvoidance(position: Phaser.Math.Vector2, direction: Phaser.Math.Vector2) {
    const lookAhead = 90;
    const fighterRadius = 20;
    let steer: Phaser.Math.Vector2 | null = null;

    for (const obstacle of this.obstacles) {
      const toObstacle = obstacle.center.clone().subtract(position);
      const along = toObstacle.dot(direction);
      if (along <= 0 || along > lookAhead + obstacle.radius) {
        continue;
      }

      const closest = position.clone().add(direction.clone().scale(along));
      const perpDistance = closest.distance(obstacle.center);
      const safeDistance = obstacle.radius + fighterRadius;
      if (perpDistance >= safeDistance) {
        continue;
      }

      const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);
      const side = perpendicular.dot(toObstacle) > 0 ? -1 : 1;
      const strength = (safeDistance - perpDistance) / safeDistance;
      const contribution = perpendicular.scale(side * strength * 1.6);
      steer = steer ? steer.add(contribution) : contribution;
    }

    return steer;
  }

  private canAttack(fighter: Fighter) {
    return fighter.state === 'idle' || fighter.state === 'shield';
  }

  private canShield(fighter: Fighter) {
    return fighter.state === 'idle' || fighter.state === 'shield';
  }

  private beginAttack(fighter: Fighter, direction: number, time: number) {
    fighter.sprite.setVelocity(0);
    fighter.facing = direction;
    fighter.attackDirection = direction;
    fighter.attackHitIds.clear();
    fighter.state = 'windup';
    fighter.stateEndsAt = time + COMBAT.windupMs;
    if (fighter.id === 'player') {
      unlockSound();
      playSound('attack');
    }
  }

  private beginShield(fighter: Fighter, direction: number, until = Number.POSITIVE_INFINITY) {
    fighter.state = 'shield';
    fighter.facing = direction;
    fighter.attackDirection = direction;
    fighter.stateEndsAt = until;
    if ('guardUntil' in fighter) {
      fighter.guardUntil = until;
    }
  }

  private advanceFighterState(fighter: Fighter, time: number, playerHoldingShield: boolean) {
    if (fighter.state === 'dead') {
      return;
    }

    if (fighter.state === 'shield') {
      const keepShield = fighter.id === 'player' ? playerHoldingShield : time < fighter.stateEndsAt;
      if (!keepShield) {
        fighter.state = 'idle';
      }
      return;
    }

    if (time < fighter.stateEndsAt) {
      return;
    }

    if (fighter.state === 'windup') {
      fighter.state = 'active';
      fighter.stateEndsAt = time + COMBAT.activeMs;
      fighter.attackHitIds.clear();
      return;
    }

    if (fighter.state === 'active') {
      fighter.state = 'recovery';
      fighter.stateEndsAt = time + COMBAT.recoveryMs;
      return;
    }

    if (fighter.state === 'recovery' || fighter.state === 'stagger') {
      fighter.state = 'idle';
      fighter.sprite.setVelocity(0);
    }
  }

  private resolveActiveAttacks(time: number) {
    if (!this.player || this.awaitingNextWave || this.defeat || this.victory) {
      return;
    }

    if (this.player.state === 'active') {
      for (const skeleton of this.skeletons) {
        this.tryHit(this.player, skeleton, time);
      }
    }

    for (const skeleton of this.skeletons) {
      if (skeleton.state === 'active') {
        this.tryHit(skeleton, this.player, time);
      }
    }
  }

  private tryHit(attacker: Fighter, target: Fighter, time: number) {
    if (target.state === 'dead' || attacker.attackHitIds.has(target.id)) {
      return;
    }

    const attackerPos = this.positionOf(attacker);
    const targetPos = this.positionOf(target);
    const targetDirection = angleBetween(attackerPos, targetPos);
    const distance = attackerPos.distance(targetPos);
    const inRange = distance <= COMBAT.attackRange;
    const inArc = angleDifference(attacker.attackDirection, targetDirection) <= COMBAT.attackArc / 2;

    if (!inRange || !inArc) {
      return;
    }

    attacker.attackHitIds.add(target.id);

    if (this.isBlocking(target, attackerPos)) {
      this.showBlock(targetPos);
      spawnBlockEffect(this, targetPos);
      playSound('block');
      this.applyPush(attacker, target, COMBAT.blockPushSpeed, COMBAT.blockStaggerMs, time);
      return;
    }

    target.hp -= 1;
    spawnHitEffect(this, targetPos, targetDirection);
    playSound('hit');
    this.cameras.main.shake(80, target.id === 'player' ? 0.007 : 0.004);
    this.applyPush(target, attacker, PLAYER.staggerSpeed, COMBAT.staggerMs, time);

    if (target.id === 'player') {
      if (target.hp <= 0) {
        this.loseGame();
      }
      return;
    }

    if (target.hp <= 0) {
      this.killSkeleton(target as Skeleton);
    }
  }

  private tryHeal(time: number) {
    if (!this.player || this.player.state === 'dead') {
      return;
    }

    if (this.player.hp >= PLAYER.maxHealth) {
      return;
    }

    if (time < this.healCooldownUntil) {
      return;
    }

    const previousHealth = this.player.hp;
    this.player.hp = Math.min(PLAYER.maxHealth, this.player.hp + HEAL_AMOUNT);
    this.healCooldownUntil = time + HEAL_COOLDOWN_MS;
    if (this.player.hp > previousHealth) {
      this.showHeal(this.positionOf(this.player));
      spawnHealEffect(this, this.positionOf(this.player));
      playSound('heal');
    }
  }

  private isBlocking(target: Fighter, attackerPosition: Phaser.Math.Vector2) {
    if (target.state !== 'shield') {
      return false;
    }

    const targetPos = this.positionOf(target);
    const directionToAttacker = angleBetween(targetPos, attackerPosition);
    return angleDifference(target.attackDirection, directionToAttacker) <= COMBAT.shieldArc / 2;
  }

  private applyPush(
    target: Fighter,
    source: Fighter,
    speed: number,
    duration: number,
    time: number
  ) {
    const direction = this.positionOf(target).subtract(this.positionOf(source));
    if (direction.lengthSq() === 0) {
      direction.setTo(1, 0);
    }
    direction.normalize();
    target.sprite.setVelocity(direction.x * speed, direction.y * speed);
    target.state = 'stagger';
    target.stateEndsAt = time + duration;
  }

  private showBlock(position: Phaser.Math.Vector2) {
    const flash = this.add.image(position.x, position.y, 'block-flash').setDepth(18);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 180,
      onComplete: () => flash.destroy()
    });
  }

  private showHeal(position: Phaser.Math.Vector2) {
    const pulse = this.add.circle(position.x, position.y, 22, 0x22c55e, 0.28)
      .setStrokeStyle(3, 0x86efac)
      .setDepth(18);
    const label = this.add.text(position.x, position.y - 30, `+${HEAL_AMOUNT}`, {
      color: '#bbf7d0',
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      stroke: '#052e16',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(19);

    this.cameras.main.flash(120, 34, 197, 94, false);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 2.2,
      duration: 420,
      onComplete: () => pulse.destroy()
    });
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: label.y - 24,
      duration: 650,
      onComplete: () => label.destroy()
    });
  }

  private killSkeleton(skeleton: Skeleton) {
    const deathPosition = this.positionOf(skeleton);
    skeleton.state = 'dead';
    skeleton.sprite.setTexture(`${skeleton.texturePrefix}-down-die-0`);
    skeleton.sprite.setTint(0x7f1d1d);
    skeleton.sprite.setVelocity(0);
    skeleton.sprite.body.enable = false;
    skeleton.sword.setVisible(false);
    skeleton.shield.setVisible(false);
    for (const pip of skeleton.healthPips) {
      pip.setVisible(false);
    }
    this.time.delayedCall(180, () => {
      if (skeleton.sprite.active) {
        skeleton.sprite.setTexture(`${skeleton.texturePrefix}-down-die-1`);
      }
    });
    spawnDeathEffect(this, deathPosition);
    this.scoreFeedback?.add(100, deathPosition);
    playSound('kill');
    this.tweens.add({
      targets: skeleton.sprite,
      alpha: 0,
      scale: 0.72,
      duration: 620,
      onComplete: () => this.destroySkeleton(skeleton)
    });

    this.skeletons = this.skeletons.filter(current => current !== skeleton);
    if (this.skeletons.length === 0) {
      this.winWave();
    }
  }

  private destroySkeleton(skeleton: Skeleton) {
    skeleton.sprite.destroy();
    skeleton.sword.destroy();
    skeleton.shield.destroy();
    for (const pip of skeleton.healthPips) {
      pip.destroy();
    }
  }

  private winWave() {
    if (this.wave >= TOTAL_WAVES) {
      this.winGame();
      return;
    }
    this.awaitingNextWave = true;
    this.scoreFeedback?.add(this.wave * 250, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 - 70
    });
    this.promptText?.setText(`Wave ${this.wave} cleared!\nLeft-click for the next level.`);
    this.transitions?.playWaveClear(this.wave);
    playSound('waveClear');
  }

  private winGame() {
    this.victory = true;
    this.scoreFeedback?.add(this.wave * 500, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 - 70
    });
    this.promptText?.setText(`You win! All ${TOTAL_WAVES} waves cleared.\nPress ENTER to play again.`);
    this.transitions?.playWaveClear(this.wave);
    playSound('waveClear');
  }

  private loseGame() {
    if (!this.player) {
      return;
    }
    this.defeat = true;
    this.player.state = 'dead';
    this.player.sprite.setVelocity(0);
    this.player.sprite.setTint(0x7f1d1d);
    this.promptText?.setText('You died.\nPress ENTER to restart.');
    this.transitions?.playDefeat();
    playSound('defeat');
  }

  private updateVisuals(time: number) {
    if (this.player) {
      this.updateFighterVisuals(this.player, time);
    }
    for (const skeleton of this.skeletons) {
      this.updateFighterVisuals(skeleton, time);
      this.updateHealthPips(skeleton);
    }
  }

  private updateHealthPips(skeleton: Skeleton) {
    const count = skeleton.healthPips.length;
    if (count === 0) {
      return;
    }
    const spacing = 8;
    const startX = skeleton.sprite.x - ((count - 1) * spacing) / 2;
    const y = skeleton.sprite.y + 24;
    for (let index = 0; index < count; index += 1) {
      const pip = skeleton.healthPips[index];
      pip.setPosition(startX + index * spacing, y);
      const filled = index < skeleton.hp;
      pip.setFillStyle(filled ? 0xf87171 : 0x1f2937, filled ? 1 : 0.5);
      pip.setStrokeStyle(1, 0x111827, 0.8);
    }
  }

  private updateFighterVisuals(fighter: Fighter, time: number) {
    const facingAngle = this.visualFacingAngle(fighter);
    const visualDirection = this.visualDirectionFor(facingAngle);
    const direction = directionFromAngle(fighter.attackDirection);
    fighter.sprite.setTexture(this.textureFor(fighter, time, visualDirection));
    fighter.sprite.setFlipX(visualDirection === 'side' && Math.cos(facingAngle) < 0);
    fighter.sprite.setRotation(0);

    const swordVisible = fighter.state === 'windup' || fighter.state === 'active' || fighter.state === 'recovery';
    fighter.sword.setVisible(swordVisible);
    if (swordVisible) {
      const distance = fighter.state === 'windup' ? 20 : 33;
      const sideLift = visualDirection === 'up' ? -6 : visualDirection === 'down' ? 6 : 0;
      fighter.sword.setPosition(
        fighter.sprite.x + direction.x * distance,
        fighter.sprite.y + direction.y * distance + sideLift
      );
      fighter.sword.setRotation(
        fighter.attackDirection + (fighter.state === 'windup' ? -0.72 : 0.18)
      );
      fighter.sword.setAlpha(fighter.state === 'active' ? 1 : 0.45);
      fighter.sword.setScale(fighter.state === 'active' ? 0.95 : 0.78);
    }

    const shieldVisible = fighter.state === 'shield';
    fighter.shield.setVisible(shieldVisible);
    if (shieldVisible) {
      const shieldOffset = this.shieldOffsetFor(visualDirection, Math.cos(facingAngle) < 0);
      fighter.shield.setPosition(
        fighter.sprite.x + shieldOffset.x,
        fighter.sprite.y + shieldOffset.y
      );
      fighter.shield.setRotation(fighter.attackDirection + Math.PI / 2);
    }

    if (fighter.state === 'windup') {
      fighter.sprite.setTint(0xfacc15);
    } else if (fighter.state === 'active') {
      fighter.sprite.setTint(0xf8fafc);
    } else if (fighter.state === 'stagger') {
      fighter.sprite.setTint(0xfb7185);
    } else if (fighter.state === 'shield') {
      fighter.sprite.setTint(0x99f6e4);
    } else if (fighter.state !== 'dead') {
      fighter.sprite.clearTint();
    }
  }

  private textureFor(fighter: Fighter, time: number, direction: VisualDirection) {
    if (fighter.state === 'dead') {
      return `${fighter.texturePrefix}-${direction}-die-1`;
    }
    if (fighter.state === 'stagger') {
      return `${fighter.texturePrefix}-${direction}-hit-0`;
    }
    if (fighter.state === 'shield') {
      return `${fighter.texturePrefix}-${direction}-shield-0`;
    }
    if (fighter.state === 'windup') {
      return `${fighter.texturePrefix}-${direction}-attack-0`;
    }
    if (fighter.state === 'active') {
      return `${fighter.texturePrefix}-${direction}-attack-1`;
    }
    if (fighter.state === 'recovery') {
      return `${fighter.texturePrefix}-${direction}-attack-2`;
    }

    const moving = fighter.sprite.body.velocity.lengthSq() > 4;
    if (moving) {
      return `${fighter.texturePrefix}-${direction}-walk-${Math.floor(time / 130) % 4}`;
    }
    return `${fighter.texturePrefix}-${direction}-idle-0`;
  }

  private visualFacingAngle(fighter: Fighter) {
    if (
      fighter.state === 'windup' ||
      fighter.state === 'active' ||
      fighter.state === 'recovery' ||
      fighter.state === 'shield'
    ) {
      return fighter.attackDirection;
    }
    return fighter.facing;
  }

  private visualDirectionFor(angle: number): VisualDirection {
    const normalized = Phaser.Math.Angle.Wrap(angle);
    if (normalized > Math.PI / 4 && normalized < Math.PI * 3 / 4) {
      return 'down';
    }
    if (normalized < -Math.PI / 4 && normalized > -Math.PI * 3 / 4) {
      return 'up';
    }
    return 'side';
  }

  private shieldOffsetFor(direction: VisualDirection, facingLeft: boolean) {
    if (direction === 'up') {
      return new Phaser.Math.Vector2(13, -6);
    }
    if (direction === 'down') {
      return new Phaser.Math.Vector2(-17, 8);
    }
    return new Phaser.Math.Vector2(facingLeft ? -20 : 20, 5);
  }

  private updateUi() {
    if (!this.player) {
      return;
    }

    this.waveText?.setText(`Wave ${this.wave}`);
    for (let index = 0; index < this.hearts.length; index += 1) {
      this.hearts[index].setAlpha(index < this.player.hp ? 1 : 0.25);
    }

    if (!this.awaitingNextWave && !this.defeat && !this.victory && !this.paused) {
      this.promptText?.setText('');
    }
  }

  private setPaused(paused: boolean, time: number) {
    if (paused === this.paused) {
      return;
    }

    this.paused = paused;
    if (paused) {
      this.pausedAt = time;
      this.physics.pause();
      this.tweens.pauseAll();
      this.promptText?.setText('Paused\nPress ESC to resume.');
      return;
    }

    const pausedFor = this.pausedAt > 0 ? time - this.pausedAt : 0;
    this.physics.resume();
    this.tweens.resumeAll();
    this.shiftTimers(pausedFor);
    this.healCooldownUntil += pausedFor;
    this.promptText?.setText('');
    this.pausedAt = 0;
  }

  private shiftTimers(duration: number) {
    if (duration <= 0) {
      return;
    }

    const fighters: Fighter[] = this.player ? [this.player, ...this.skeletons] : [...this.skeletons];
    for (const fighter of fighters) {
      if (Number.isFinite(fighter.stateEndsAt)) {
        fighter.stateEndsAt += duration;
      }
      if (this.isSkeleton(fighter)) {
        fighter.nextDecisionAt += duration;
        fighter.attackCooldownUntil += duration;
        if (Number.isFinite(fighter.guardUntil)) {
          fighter.guardUntil += duration;
        }
      }
    }
  }

  private setupCharacterCollisions() {
    if (!this.player) {
      return;
    }

    for (const skeleton of this.skeletons) {
      this.characterColliders.push(this.physics.add.collider(this.player.sprite, skeleton.sprite));
    }

    for (let outer = 0; outer < this.skeletons.length; outer += 1) {
      for (let inner = outer + 1; inner < this.skeletons.length; inner += 1) {
        this.characterColliders.push(
          this.physics.add.collider(this.skeletons[outer].sprite, this.skeletons[inner].sprite)
        );
      }
    }

    if (this.obstacleGroup) {
      for (const skeleton of this.skeletons) {
        this.characterColliders.push(this.physics.add.collider(skeleton.sprite, this.obstacleGroup));
      }
    }
  }

  private clearCharacterColliders() {
    for (const collider of this.characterColliders) {
      collider.destroy();
    }
    this.characterColliders = [];
  }

  private playerStart() {
    return new Phaser.Math.Vector2(GAME_WIDTH / 2, ARENA.top + (ARENA.bottom - ARENA.top) / 2);
  }

  private spawnPointFor(index: number, playerStart: Phaser.Math.Vector2) {
    const spawnPoints = [
      new Phaser.Math.Vector2(ARENA.left + 120, ARENA.top + 110),
      new Phaser.Math.Vector2(ARENA.right - 120, ARENA.top + 110),
      new Phaser.Math.Vector2(ARENA.left + 120, ARENA.bottom - 110),
      new Phaser.Math.Vector2(ARENA.right - 120, ARENA.bottom - 110),
      new Phaser.Math.Vector2(GAME_WIDTH / 2, ARENA.top + 105),
      new Phaser.Math.Vector2(GAME_WIDTH / 2, ARENA.bottom - 105),
      new Phaser.Math.Vector2(ARENA.left + 105, GAME_HEIGHT / 2),
      new Phaser.Math.Vector2(ARENA.right - 105, GAME_HEIGHT / 2)
    ];
    const point = spawnPoints[index % spawnPoints.length].clone();
    if (index >= spawnPoints.length) {
      point.x += Phaser.Math.Between(-46, 46);
      point.y += Phaser.Math.Between(-46, 46);
    }

    const safeDistance = SKELETON.aggroRange + 80;
    if (point.distance(playerStart) < safeDistance) {
      return this.farthestSpawnPoint(playerStart, spawnPoints);
    }
    return point;
  }

  private farthestSpawnPoint(playerStart: Phaser.Math.Vector2, spawnPoints: Phaser.Math.Vector2[]) {
    return spawnPoints.reduce((farthest, point) => (
      point.distance(playerStart) > farthest.distance(playerStart) ? point : farthest
    ), spawnPoints[0]).clone();
  }

  private isSkeleton(fighter: Fighter): fighter is Skeleton {
    return fighter.id.startsWith('skeleton-');
  }

  private randomPatrolPoint(home: Phaser.Math.Vector2) {
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(
        home.x + Phaser.Math.Between(-SKELETON.patrolRange, SKELETON.patrolRange),
        ARENA.left + 36,
        ARENA.right - 36
      ),
      Phaser.Math.Clamp(
        home.y + Phaser.Math.Between(-SKELETON.patrolRange, SKELETON.patrolRange),
        ARENA.top + 36,
        ARENA.bottom - 36
      )
    );
  }

  private positionOf(fighter: Fighter) {
    return new Phaser.Math.Vector2(fighter.sprite.x, fighter.sprite.y);
  }
}
