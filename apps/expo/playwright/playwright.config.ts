import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/globalSetup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  maxFailures: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      // PW_CHANNEL=chrome uses the system browser where no Playwright-bundled
      // Chromium is available (e.g. Ubuntu 26.04 dev boxes). Unset in CI, which
      // installs Chromium via `playwright install`.
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined },
    },
  ],
});
