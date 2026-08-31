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
  resolve: {
    alias: {
      // detect-access-decisions.ts imports the flag → feature_access naming
      // rule from @packrat/config so the convention has one definition rather
      // than a copy in the lint. Bun resolves the workspace package at
      // runtime; vitest needs the alias spelled out.
      '@packrat/config': resolve(__dirname, '../packages/config/src/index.ts'),
      '@packrat/guards': resolve(__dirname, '../packages/guards/src/index.ts'),
    },
  },
  test: {
    name: 'scripts-unit',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, '**/__tests__/**/*.test.ts')],
  },
});
