import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Root vitest config for the MCP package.
 *
 * Projects are declared in `./vitest.workspace.ts`; this file holds the
 * single-source coverage config that applies across both projects when
 * `vitest run --coverage` is invoked from this directory.
 *
 * U17 split — see `./vitest.workspace.ts` for the unit vs integration
 * project split and the rationale for each.
 *
 * Coverage thresholds were lowered (and the exclusion list shrunk) as
 * part of U17 so the threshold applies to the broader risk surface
 * (`src/index.ts`, `src/tools/**`, `src/resources.ts`, `src/prompts.ts`,
 * `src/auth.ts`) that the per-unit + integration tests now exercise.
 * `src/types.ts` stays excluded (no runtime).
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // Type definitions — no runtime logic.
        'src/types.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
