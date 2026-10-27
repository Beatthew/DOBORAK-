import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forrás: src/. A Song Practice app (dalok) a public/dalok mappába másolódik (npm run sync-songs),
// onnan változatlanul szolgálja ki a build. A kész oldal a dist/ mappába kerül (ezt deployolja a Netlify).
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [react()],
  base: './',
  envDir: '..',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5174, strictPort: true },
});
