import { resolve } from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@packrat/api': resolve(__dirname, 'src'),
      // Redirect Elysia's internal env module to a stub that forces
      // ELYSIA_AOT=false.  This prevents new Function() / eval from being
      // called at module-init time inside the workerd/QuickJS sandbox, which
      // disallows code-generation outside a request handler.  See
      // src/__test-stubs__/elysia-env.ts for the full rationale.
      'elysia/universal/env': resolve(__dirname, 'src/__test-stubs__/elysia-env.ts'),
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
