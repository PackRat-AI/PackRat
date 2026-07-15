import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'checks',
    environment: 'node',
    include: [resolve(__dirname, 'src/**/*.test.ts')],
  },
});
