import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for unit tests.
 *
 * Unlike the main vitest.config.ts (which uses @cloudflare/vitest-pool-workers
 * and requires Docker + a live PostgreSQL database), this config runs unit tests
 * in a standard Node.js environment with all external dependencies mocked.
 *
 * Run with: bun test:unit
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@packrat/api': resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'unit',
    environment: 'node',
    globals: true,
    // Restrict to __tests__ directories to avoid accidentally running integration
    // tests that target the Cloudflare Workers pool runner.
    include: [resolve(__dirname, 'src/**/__tests__/**/*.test.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage/unit'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/db/migrations/**',
        // Pure type/schema definitions (no runtime logic to test)
        'src/schemas/**',
        'src/types/**',
        'src/db/**',
        // Route handlers (covered by integration tests in /test directory)
        'src/routes/**',
        // Infrastructure (no business logic)
        'src/containers/**',
        // ETL and AI utilities (defer to integration tests)
        'src/services/etl/**',
        'src/utils/ai/**',
        // Complex orchestration services (defer to integration tests)
        'src/services/aiService.ts',
        'src/services/executeSqlAiTool.ts',
      ],
      // Set realistic thresholds for business logic files
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
