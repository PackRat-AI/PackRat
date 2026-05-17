import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'trails-app': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'trails-og',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '__tests__/**/*.test.ts')],
  },
});
