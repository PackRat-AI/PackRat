import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the repo-level scripts in `scripts/`.
 *
 * Run with: bun test:scripts
 *
 * Custom lint scripts (`scripts/lint/*.ts`) and the coverage ratchet
 * (`scripts/lint/coverage-ratchet.ts`) get their own test coverage via
 * files under `scripts/lint/__tests__/`.
 */
export default defineConfig({
  test: {
    name: 'scripts-unit',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '**/__tests__/**/*.test.ts')],
  },
});
