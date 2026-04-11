import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@packrat/analytics': new URL('./src', import.meta.url).pathname,
    },
  },
});
