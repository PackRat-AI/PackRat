import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'config',
    environment: 'node',
    include: [resolve(__dirname, 'src/**/*.test.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      // Only the resolver carries runtime logic worth covering; the rest of the
      // package is static config tables and re-exports.
      include: ['src/featureAccess.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
