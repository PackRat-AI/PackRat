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
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        // singleWorker: one workerd isolate shared across all test files.
        // Without this, each file gets a fresh isolate, which tears down at
        // file end without cleanly closing in-flight Neon Pool websockets →
        // postgres retains orphaned sessions/locks → next file's TRUNCATE
        // deadlocks and inserts see stale state. (#2180 follow-up)
        singleWorker: true,
        wrangler: { configPath: './wrangler.jsonc', environment: 'dev' },
      },
    },
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
