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

  // testID on TextField spreads via {...props} → TextInput → <input> on web,
  // so getByTestId() resolves to the <input> directly. Playwright's fill()
  // uses CDP to dispatch real keyboard/input events, which properly trigger
  // React Native Web's onChangeText and update tanstack-form field state.
  // The manual native-setter + dispatchEvent approach does NOT fire the CDP
  // path and leaves form state empty, so canSubmit stays false.
  await page.getByTestId('email-input').waitFor({ timeout: 15_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  // page.keyboard.press('Enter') fires the password field's onSubmitEditing
  // → form.handleSubmit(). Auth storage on web uses localStorage (not
  // expo-secure-store, which ships an empty stub on web and would throw).
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

  // Auth cookies/localStorage tokens are now set; navigate to the main app
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.getByRole('tab', { name: DASHBOARD_TAB_RE }).waitFor({ timeout: 15_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[globalSetup] Logged in as ${email}`);

  await browser.close();
}
