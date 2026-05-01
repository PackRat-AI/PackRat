/**
 * Playwright global setup — runs once before all tests.
 *
 * Navigates the login UI with TEST_EMAIL + TEST_PASSWORD (same credentials
 * used by the Maestro iOS/Android flows), then saves the resulting browser
 * storage state so every test can start pre-authenticated without re-logging in.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';

const DASHBOARD_TAB_RE = /Dashboard/i;
const REPORT_DIR = path.join(__dirname, '../../playwright-report');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/state.json');

export default async function setup() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set');
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors to help debug failures
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[page error] ${err.message}`));

  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });

  // Snapshot the page so CI artifacts show what actually rendered
  await page.screenshot({ path: path.join(REPORT_DIR, 'globalSetup-auth.png'), fullPage: true });
  console.log('[globalSetup] page URL:', page.url());
  console.log(
    '[globalSetup] visible text:',
    await page
      .locator('body')
      .innerText()
      .catch(() => ''),
  );

  // Entry screen — choose email sign-in
  await page.getByTestId('sign-in-email-button').waitFor({ timeout: 30_000 });
  await page.getByTestId('sign-in-email-button').click();

  // Login form
  await page.getByTestId('email-input').waitFor({ timeout: 10_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('continue-button').click();

  // Wait for dashboard — tab bar confirms successful login
  await page.getByRole('tab', { name: DASHBOARD_TAB_RE }).waitFor({ timeout: 30_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[globalSetup] Logged in as ${email}`);

  await browser.close();
}
