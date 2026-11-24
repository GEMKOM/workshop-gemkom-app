import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const srcRoot = fileURLToPath(new URL('./src', import.meta.url));
// Kept per checkout so worktrees don't share (and delete) each other's
// pre-bundled dependency chunks.
const cacheDir = fileURLToPath(new URL('./.vite', import.meta.url));

export default defineConfig(({ command }) => ({
  // Built files are published under /app-assets/ with hashed names; the pages
  // live at the routes (under /beta/ during the pilot, see src/lib/basename.ts).
  base: command === 'build' ? '/app-assets/' : '/',
  cacheDir,
  // static/: the manifest and icons, copied as they are.
  publicDir: 'static',
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  server: {
    port: 5190,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Libraries change far less often than pages: separate chunks stay
        // cached on the phones across deploys.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'mantine', test: /node_modules[\\/]@mantine[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
}));
