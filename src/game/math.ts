import Phaser from 'phaser';

export function angleBetween(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2) {
  return Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
}

export function angleDifference(a: number, b: number) {
  return Math.abs(Phaser.Math.Angle.Wrap(a - b));
}

export function directionFromAngle(angle: number) {
  return new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
}
