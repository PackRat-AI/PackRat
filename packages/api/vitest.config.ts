import { resolve } from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Vitest 4 + @cloudflare/vitest-pool-workers 0.14 dropped `defineWorkersConfig`
// in favor of the `cloudflareTest()` Vite plugin. The plugin receives what
// used to be `test.poolOptions.workers`.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc', environment: 'dev' },
    }),
  ],
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
  },
});
