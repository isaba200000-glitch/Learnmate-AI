import path from 'path';
import { defineConfig } from 'vitest/config';

// Standalone Vitest config: the app's vite.config.ts requires PORT/BASE_PATH
// env vars (dev-server concerns) that tests should not depend on.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
