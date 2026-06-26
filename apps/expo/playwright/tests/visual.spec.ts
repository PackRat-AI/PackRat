import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.resolve(REPO_ROOT, 'artifacts/screenshots/web-playwright');
const SHOULD_CAPTURE = process.env.PACKRAT_VISUAL_SCREENSHOTS === '1';
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';

const routes = {
  unauth: [
    ['00-unauth-welcome', '/auth?showSkipLoginBtn=true'],
    ['01-unauth-login', '/auth/(login)'],
    ['02-unauth-register-name', '/auth/(create-account)'],
    ['03-unauth-register-credentials', '/auth/(create-account)/credentials'],
    ['04-unauth-forgot-password', '/auth/(login)/forgot-password'],
  ],
  guest: [
    ['10-guest-home', '/'],
    ['11-guest-packs', '/packs'],
    ['12-guest-trips', '/trips'],
    ['13-guest-catalog', '/catalog'],
    ['14-guest-feed', '/feed'],
    ['15-guest-profile', '/profile'],
  ],
  authenticated: [
    ['20-auth-home', '/'],
    ['21-auth-packs', '/packs'],
    ['22-auth-new-pack', '/pack/new'],
    ['23-auth-trips', '/trips'],
    ['24-auth-new-trip', '/trip/new'],
    ['25-auth-catalog', '/catalog'],
    ['26-auth-feed', '/feed'],
    ['27-auth-compose-post', '/feed/create'],
    ['28-auth-profile', '/profile'],
    ['29-auth-settings', '/settings'],
    ['30-auth-assistant', '/ai-chat'],
    ['31-auth-weather', '/weather'],
    ['32-auth-gear-inventory', '/gear-inventory'],
    ['33-auth-pack-templates', '/pack-templates'],
    ['34-auth-trail-conditions', '/trail-conditions'],
    ['35-auth-guides', '/guides'],
    ['36-auth-wildlife', '/wildlife'],
    ['37-auth-season-suggestions', '/season-suggestions'],
  ],
} as const;

test.describe('Web visual screenshot matrix', () => {
  test.skip(!SHOULD_CAPTURE, 'Set PACKRAT_VISUAL_SCREENSHOTS=1 to capture web screenshots.');

  test.beforeAll(() => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('captures unauthenticated screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    for (const [name, route] of routes.unauth) {
      await captureRoute(page, { name, route });
    }
  });

  test('captures guest screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem('skipped_login', 'true');
    });

    for (const [name, route] of routes.guest) {
      await captureRoute(page, { name, route });
    }
  });

  test('captures authenticated screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem('access_token', 'packrat-e2e-session');
      window.localStorage.setItem('refresh_token', 'packrat-e2e-refresh');
      window.localStorage.setItem(
        'user',
        JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          email: 'e2e@packrat.test',
          name: 'E2E User',
          firstName: 'E2E',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        }),
      );
    });

    for (const [name, route] of routes.authenticated) {
      await captureRoute(page, { name, route });
    }
  });
});

async function captureRoute(
  page: import('@playwright/test').Page,
  { name, route }: { name: string; route: string },
) {
  await page.goto(`${BASE_URL}${route}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('body')).toBeVisible();
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}
