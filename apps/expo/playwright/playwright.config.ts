import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/globalSetup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Tests create their own data (timestamped names) and otherwise read shared
  // catalog/profile data, so parallel runs are safe. Override with
  // PW_WORKERS=1 if you suspect a flake is contention-related.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.PW_WORKERS ?? (process.env.CI ? 2 : 4)),
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    // Headless by default in CI; headed locally so you can watch the run.
    // Override with PWHEADLESS=1 to force headless locally.
    headless: !!process.env.CI || process.env.PWHEADLESS === '1',
  },

  projects: [
    {
      name: 'chromium',
      // `channel: 'chrome'` uses the locally installed Google Chrome —
      // Playwright's bundled chromium has no Ubuntu 26.04 build yet.
      // Playwright already isolates each context with an ephemeral user-data
      // dir, but `--incognito` makes that explicit.
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            '--incognito',
            '--no-default-browser-check',
            '--no-first-run',
            '--password-store=basic',
          ],
        },
      },
    },
  ],
});
