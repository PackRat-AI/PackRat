import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';

const DASHBOARD_TAB_RE = /Dashboard/i;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/state.json');

export default async function setup() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set');
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  // Headless by default; opt into a visible browser with PWHEADED=1.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: process.env.PWHEADED !== '1',
    args: ['--incognito', '--no-default-browser-check', '--no-first-run', '--password-store=basic'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Start from the auth entry screen, then click through to login
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'load' });

  // Click the "Sign In" button to open the login modal
  await page.getByTestId('sign-in-email-button').waitFor({ timeout: 15_000 });
  await page.getByTestId('sign-in-email-button').click();

  // testID on TextField spreads via {...props} → TextInput → <input>, so
  // getByTestId() resolves to the <input> element directly. fill() on it
  // properly triggers onChangeText; page.keyboard.press('Enter') then fires
  // the password field's onSubmitEditing → form.handleSubmit().
  await page.getByTestId('email-input').waitFor({ timeout: 15_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  // Wait for the sign-in API response so we know auth cookies are set before
  // navigating away. router.dismissTo('/') from a stack screen is unreliable
  // on web, so we drive navigation explicitly after the API call succeeds.
  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/sign-in/email') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.keyboard.press('Enter'),
  ]);

  if (!signInResponse.ok()) {
    const body = await signInResponse.text().catch(() => '');
    throw new Error(`Sign-in failed (${signInResponse.status()}): ${body}`);
  }

  // Auth cookies are now set; navigate to the main app explicitly
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.getByRole('tab', { name: DASHBOARD_TAB_RE }).waitFor({ timeout: 15_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[globalSetup] Logged in as ${email}`);

  await browser.close();
}
