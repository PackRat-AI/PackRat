import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const CHROMIUM_EXECUTABLE_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/snap/bin/chromium';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/globalSetup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    headless: true,
  },

  projects: [
    {
      name: 'vanilla-chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: {
          executablePath: CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
});
