import { resolve } from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@packrat/api': resolve(__dirname, 'src'),
    },
  },
  test: {
    globalSetup: './test/vitest.global-setup.ts',
    setupFiles: ['./test/setup.ts'],
    // Only include integration tests from /test directory
    include: [resolve(__dirname, 'test/**/*.test.ts')],
    // Run tests sequentially to avoid database deadlocks
    fileParallelism: false,
    // Also disable parallel execution within test files
    sequence: {
      concurrent: false,
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc', environment: 'dev' },
      },
    },
  },
});
