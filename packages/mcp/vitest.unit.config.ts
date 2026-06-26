import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit-test project for the MCP package (U17).
 *
 * Runs in the standard Node environment with Cloudflare/Workers APIs
 * mocked. Excludes `src/__tests__/integration/**` — those run under
 * `@cloudflare/vitest-pool-workers` against a real workerd isolate
 * (see `./vitest.integration.config.ts`).
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
    exclude: [resolve(__dirname, 'src/__tests__/integration/**/*.test.ts')],
  },
});
