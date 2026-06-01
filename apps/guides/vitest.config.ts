import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'guides-app': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'guides-og',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '__tests__/**/*.test.ts')],
    hookTimeout: 60_000,
    testTimeout: 15_000,
  },
});
