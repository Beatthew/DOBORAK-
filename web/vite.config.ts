import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forrás: src/. A dalok hangsávjai a public/songs mappában (npm run import-song húzza be őket a Song Practice-ből).
// A kész oldal a dist/ mappába kerül (ezt deployolja a Netlify).
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [react()],
  base: './',
  envDir: '..',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5174, strictPort: true },
});
