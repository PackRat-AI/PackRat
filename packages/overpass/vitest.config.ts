import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'overpass-unit',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, 'src/**/*.test.ts')],
  },
});
