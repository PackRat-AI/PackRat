import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 65,
        lines: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@packrat/analytics': new URL('./src', import.meta.url).pathname,
    },
  },
});
