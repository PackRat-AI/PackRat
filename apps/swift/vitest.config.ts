import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Swift app build/test scripts.
 *
 * Covers TypeScript helpers under `apps/swift/scripts/` that drive xcodebuild,
 * simctl, and xcresulttool. Runs in a Node environment — no Xcode invocation
 * happens during the test run; the wrappers' shell-out is exercised via
 * synthetic JSON fixtures.
 *
 * Run with: bun test:swift:scripts (from monorepo root).
 */
export default defineConfig({
  test: {
    name: 'swift-scripts',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, 'scripts/__tests__/**/*.test.ts')],
  },
});
