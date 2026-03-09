import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for unit tests.
 *
 * Unlike the main vitest.config.ts (which uses @cloudflare/vitest-pool-workers
 * and requires Docker + a live PostgreSQL database), this config runs unit tests
 * in a standard Node.js environment with all external dependencies mocked.
 *
 * Run with: bun test:unit
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@packrat/api': resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'unit',
    environment: 'node',
    globals: true,
    // Only include .test.ts files under src/ (unit tests live alongside source)
    include: [resolve(__dirname, 'src/**/*.test.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage/unit'),
      include: [resolve(__dirname, 'src/**/*.ts')],
      exclude: [
        resolve(__dirname, 'src/**/*.test.ts'),
        resolve(__dirname, 'src/**/*.spec.ts'),
        resolve(__dirname, 'src/index.ts'),
      ],
    },
  },
});
