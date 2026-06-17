import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'landing-app': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'landing-og',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '__tests__/**/*.test.ts')],
  },
});
