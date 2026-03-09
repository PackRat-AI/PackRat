import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Expo app unit tests.
 *
 * Runs pure utility and logic tests in a Node.js environment.
 * Does not require React Native, Expo, or any native modules.
 *
 * Run with: bun test (from apps/expo) or bun test:expo (from monorepo root)
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
    include: [
      resolve(__dirname, 'utils/**/*.test.ts'),
      resolve(__dirname, 'lib/utils/**/*.test.ts'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage/unit'),
      include: [resolve(__dirname, 'utils/**/*.ts'), resolve(__dirname, 'lib/utils/**/*.ts')],
      exclude: [
        resolve(__dirname, 'utils/**/*.test.ts'),
        resolve(__dirname, 'lib/utils/**/*.test.ts'),
      ],
    },
  },
});
