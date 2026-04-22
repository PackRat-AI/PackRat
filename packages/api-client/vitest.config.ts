import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@packrat/api': resolve(__dirname, '../api/src/index.ts'),
      '@packrat/api-client': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    name: 'api-client-types',
    environment: 'node',
    typecheck: {
      enabled: true,
    },
    include: [resolve(__dirname, 'test/**/*.test.ts')],
  },
});
