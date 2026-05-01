/**
 * Playwright global setup — runs once before all tests.
 *
 * Navigates the login UI with TEST_EMAIL + TEST_PASSWORD (same credentials
 * used by the Maestro iOS/Android flows), then saves the resulting browser
 * storage state so every test can start pre-authenticated without re-logging in.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, type Response } from '@playwright/test';

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

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[page error] ${err.message}`));
  page.on('response', (res: Response) => {
    if (
      res.url().includes('/auth') ||
      res.url().includes('/login') ||
      res.url().includes('/session')
    ) {
      console.log(`[network] ${res.request().method()} ${res.url()} → ${res.status()}`);
    }
  });

  // Navigate directly to the login modal — skips the entry screen click
  // and ensures all form testIDs are immediately visible in the DOM.
  await page.goto(`${BASE_URL}/auth/(login)`, { waitUntil: 'load' });

  // Login form
  await page.getByTestId('email-input').waitFor({ timeout: 30_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('continue-button').click();

  // Give the login request a moment then snapshot the page state
  await page.waitForTimeout(5_000);
  console.log('[globalSetup] post-login URL:', page.url());
  await page.screenshot({
    path: path.join(REPORT_DIR, 'globalSetup-post-login.png'),
    fullPage: true,
  });

  // Wait for dashboard — tab bar confirms successful login
  await page.getByRole('tab', { name: DASHBOARD_TAB_RE }).waitFor({ timeout: 25_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[globalSetup] Logged in as ${email}`);

  await browser.close();
}
