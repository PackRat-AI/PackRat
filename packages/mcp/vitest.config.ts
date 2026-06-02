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
 * (`src/tools/**`, `src/resources.ts`, `src/prompts.ts`, `src/auth.ts`)
 * that the per-unit + integration tests now exercise. All pure logic that
 * used to live in `src/index.ts` (bearer parsing, correlation headers,
 * CORS) has been extracted into Node-importable modules (`request-helpers.ts`,
 * `cors.ts`) and is unit-covered directly.
 *
 * `src/index.ts` itself stays excluded: it imports `agents/mcp` (the
 * `cloudflare:workers` scheme), so it cannot be loaded by the Node-native
 * unit runner at all, and V8 coverage is unsupported under the Workers pool
 * the integration project uses — the same constraint that keeps the API
 * worker entrypoint out of coverage. Its residual surface is the
 * `McpAgent` DO shell + handler wiring, exercised by the integration tests.
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
        // Test-support files (harness, accessors) live under __tests__ but
        // aren't *.test.ts — they're test infrastructure, not product code,
        // so they don't belong in the coverage denominator.
        'src/__tests__/**',
        // Worker DO entrypoint: imports `agents/mcp` (cloudflare:workers
        // scheme) so it can't load in Node-native vitest; V8 coverage is
        // unsupported under the Workers pool. Pure logic was extracted to
        // request-helpers.ts / cors.ts (both unit-covered); the residual
        // McpAgent shell is integration-tested.
        'src/index.ts',
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
