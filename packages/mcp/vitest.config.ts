import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for MCP package unit tests.
 *
 * Runs in standard Node.js environment with Cloudflare/Workers APIs mocked.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@packrat/api-client': resolve(__dirname, '../api-client/src/index.ts'),
    },
  },
  test: {
    name: 'mcp-unit',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, 'src/**/__tests__/**/*.test.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // Barrel file (just re-exports)
        'src/index.ts',
        // Type definitions — no runtime logic
        'src/types.ts',
        // MCP tool/resource/prompt wrappers — API-client-only code, better
        // covered by integration tests against a live server
        'src/tools/**',
        'src/resources.ts',
        'src/prompts.ts',
        // Auth wrapper (requires live auth token flow)
        'src/auth.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
