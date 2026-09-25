import { defineConfig } from 'vite';

// Base path for production builds so assets resolve correctly when the game
// is served from a GitHub Pages project site
// (https://<user>.github.io/sword-guy/). The dev server still serves from
// the root so local development URLs are unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sword-guy/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173
  }
}));
