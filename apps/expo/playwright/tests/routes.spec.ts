import { testIds } from '../../lib/testIds';
import { BASE_URL, expect, test } from './fixtures';

async function createPackViaForm(page: import('@playwright/test').Page, packName: string) {
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByTestId(testIds.packs.nameInput).fill(packName);
      await page.getByTestId(testIds.packs.submitBtn).click();
    })(),
  ]);

  expect(packResponse.ok()).toBeTruthy();
  const { id } = (await packResponse.json()) as { id: string };
  return id;
}

async function addItemViaForm(
  page: import('@playwright/test').Page,
  opts: { packId: string; itemName: string; weight?: string },
) {
  const { packId, itemName, weight = '500' } = opts;

  await page.goto(`${BASE_URL}/item/new?packId=${packId}`);
  await page.getByTestId(testIds.items.nameInput).fill(itemName);
  await page.getByTestId(testIds.items.weightInput).fill(weight);

  const itemPostPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/packs') &&
      r.url().includes('/items') &&
      r.request().method() === 'POST',
    { timeout: 20_000 },
  );

  await page.getByTestId(testIds.items.submitBtn).click();
  const response = await itemPostPromise;
  expect(response.ok()).toBeTruthy();
}

test.describe('Route smoke', () => {
  test('current pack, recent packs, and gear inventory reflect created pack state', async ({
    signedInPage: page,
  }) => {
    test.setTimeout(90_000);
    const packName = `E2E-RoutePack-${Date.now()}`;
    const itemName = `E2E-RouteItem-${Date.now()}`;

    const packId = await createPackViaForm(page, packName);
    await addItemViaForm(page, { packId, itemName, weight: '750' });

    await page.goto(`${BASE_URL}/pack/${packId}`);
    await page.waitForLoadState('networkidle');

    await page.goto(`${BASE_URL}/current-pack/${packId}`);
    await expect(page.getByText(packName).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('750 g').first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`${BASE_URL}/recent-packs`);
    await expect(page.getByText(packName).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`${BASE_URL}/gear-inventory`);
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(/By Category/i).click();
    await expect(page.getByText(/general \(\d+\)/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shared packs, weather alerts, and alert preferences load cleanly', async ({
    signedInPage: page,
  }) => {
    await page.goto(`${BASE_URL}/shared-packs`);
    await expect(page.getByText('Colorado Trail 2024')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Grand Canyon Trip')).toBeVisible({ timeout: 10_000 });

    await page.goto(`${BASE_URL}/weather-alerts`);
    await expect(
      page.getByText(/No active alerts|Loading alerts|Weather Alerts/i).first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    await page.getByText('Manage Alert Preferences', { exact: true }).click();
    await page.waitForURL(/\/weather-alert-preferences/, { timeout: 10_000 });
    await expect(page.getByText(/Weather Notifications/i)).toBeVisible({ timeout: 10_000 });

    const toggles = page.getByRole('switch');
    await expect(toggles.first()).toBeVisible({ timeout: 10_000 });
    await toggles.first().click();
    await expect(toggles.first()).not.toBeChecked({ timeout: 10_000 });
  });

  test('pack templates list loads with the main shell visible', async ({ signedInPage: page }) => {
    await page.goto(`${BASE_URL}/pack-templates`);
    await expect(page.getByText(/Pack Templates/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/All|App|Yours/).first()).toBeVisible({ timeout: 10_000 });
  });
});
