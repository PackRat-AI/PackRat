import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Expo app unit tests.
 *
 * Runs pure utility and logic tests in a Node.js environment.
 * Does not require React Native, Expo, or any native modules.
 *
 * Run with: bun run test (from apps/expo) or bun test:expo (from monorepo root)
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig.json paths for the expo app
      'expo-app': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'expo-unit',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '{utils,lib/utils,features/**/utils}/**/*.test.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'lcov', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage/unit'),
      include: ['utils/**/*.ts', 'lib/utils/**/*.ts', 'features/**/utils/**/*.ts'],
      exclude: [
        'utils/**/*.test.ts',
        'lib/utils/**/*.test.ts',
        'features/**/utils/**/*.test.ts',
        'utils/polyfills.ts', // Infrastructure/setup file - no business logic to test
      ],
      thresholds: {
        statements: 75,
      },
    },
  },
});
