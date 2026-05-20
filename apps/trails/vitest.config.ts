import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      'trails-app': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'trails-og',
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
});
