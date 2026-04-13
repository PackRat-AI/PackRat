import { resolve } from 'node:path';
import { cloudflarePool } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@packrat/api': resolve(__dirname, 'src'),
    },
  },
  test: {
    globalSetup: './test/vitest.global-setup.ts',
    setupFiles: ['./test/setup.ts'],
    pool: cloudflarePool({
      wrangler: { configPath: './wrangler.jsonc', environment: 'dev' },
      remoteBindings: false,
    }),
    // Only include integration tests from /test directory
    include: [resolve(__dirname, 'test/**/*.test.ts')],
    // Run tests sequentially to avoid database deadlocks
    fileParallelism: false,
    // Also disable parallel execution within test files
    sequence: {
      concurrent: false,
    },
  },
});
