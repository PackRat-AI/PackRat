import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: resolve(__dirname, 'coverage'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Barrel files (just re-exports)
        'src/index.ts',
        'src/types/index.ts',
        // DuckDB-dependent files — require a live DuckDB/S3 connection;
        // unit-testable only via integration tests
        'src/core/connection.ts',
        'src/core/catalog-cache.ts',
        'src/core/local-cache.ts',
        'src/core/data-export.ts',
        'src/core/enrichment.ts',
        'src/core/entity-resolver.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 85,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@packrat/analytics': new URL('./src', import.meta.url).pathname,
    },
  },
});
