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

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Start from the auth entry screen, then click through to login
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'load' });

  // Click the "Sign In" button to open the login modal
  await page.getByTestId('sign-in-email-button').waitFor({ timeout: 15_000 });
  await page.getByTestId('sign-in-email-button').click();

  // Fill login form inside the modal
  await page.getByTestId('email-input').waitFor({ timeout: 15_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  // Wait for the sign-in API response so we know auth cookies are set before
  // navigating away. router.dismissTo('/') from a stack screen is unreliable
  // on web, so we drive navigation explicitly after the API call succeeds.
  //
  // Submit via Enter on the password field (onSubmitEditing → form.handleSubmit)
  // rather than clicking the button, because the button's onPress has an early
  // return when focusedTextField === 'email' — which can happen on web if the
  // password TextField's onFocus doesn't propagate through Playwright's fill().
  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/sign-in/email') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByTestId('password-input').press('Enter'),
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
