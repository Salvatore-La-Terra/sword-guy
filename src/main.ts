import { startGame } from './game/main';

const gameContainer = document.querySelector<HTMLElement>('#game-container');

if (!gameContainer) {
  throw new Error('Game container was not found.');
}

startGame(gameContainer);
