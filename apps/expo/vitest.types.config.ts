import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'expo-app': resolve(__dirname, '.'),
      '@packrat/api': resolve(__dirname, '../../packages/api/src/index.ts'),
      '@packrat/api-client': resolve(__dirname, '../../packages/api-client/src/index.ts'),
    },
  },
  test: {
    name: 'expo-rpc-types',
    environment: 'node',
    typecheck: {
      enabled: true,
    },
    include: [resolve(__dirname, 'test/**/*.test.ts')],
  },
});
