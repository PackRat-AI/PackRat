import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for MCP package unit tests.
 *
 * Runs in standard Node.js environment with Cloudflare/Workers APIs mocked.
 */
export default defineConfig({
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
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/index.ts'],
    },
  },
});
