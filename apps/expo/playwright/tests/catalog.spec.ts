/**
 * Web E2E tests for catalog browsing and adding catalog gear to packs.
 *
 * These tests intentionally exercise the local API persistence path rather than
 * seeding catalog or pack-item state client-side.
 */

import { z } from 'zod';
import { testIds } from '../../lib/testIds';
import { BASE_URL, expect, signInViaUi, test } from './fixtures';

const PackCreateResponseSchema = z.object({ id: z.string() });

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
  const { id } = PackCreateResponseSchema.parse(await packResponse.json());
  return id;
}

async function openFirstCatalogItem(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/catalog`);

  const firstCard = page.getByTestId(/^catalog:item-/).first();
  await firstCard.waitFor({ timeout: 20_000 });

  const cardText = (await firstCard.innerText()).trim();
  const itemName = cardText.split('\n').find(Boolean);
  expect(itemName).toBeTruthy();

  await firstCard.click();
  await expect(page.getByTestId(testIds.catalog.addToPackBtn)).toBeVisible({ timeout: 15_000 });

  return itemName as string;
}

test.describe('Catalog', () => {
  test('opens a catalog item detail page', async ({ page, authCredentials }) => {
    test.setTimeout(45_000);

    await signInViaUi(page, authCredentials);
    const itemName = await openFirstCatalogItem(page);

    await expect(page.getByTestId(testIds.catalog.detailTitle)).toHaveText(itemName);
    await expect(page.getByTestId(testIds.catalog.viewRetailerBtn)).toBeVisible();
    await expect(page.getByTestId(testIds.catalog.detailWeight)).toBeVisible();
  });

  test('adds a catalog item to an existing pack through the catalog route', async ({
    page,
    authCredentials,
  }) => {
    test.setTimeout(90_000);
    await signInViaUi(page, authCredentials);

    const packName = `E2E-CatalogRoute-${Date.now()}`;
    const packId = await createPackViaForm(page, packName);
    const itemName = await openFirstCatalogItem(page);

    await page.getByTestId(testIds.catalog.addToPackBtn).click();
    const packSelectionItem = page.getByTestId(/^catalog:pack-selection-item-/).filter({
      hasText: packName,
    });
    await packSelectionItem.waitFor({ timeout: 20_000 });
    await packSelectionItem.click();

    await expect(page.getByTestId(testIds.catalog.selectedPackName)).toHaveText(packName, {
      timeout: 15_000,
    });
    await page.getByTestId(testIds.catalog.quantityInput).fill('2');
    await page.getByTestId(testIds.catalog.notesInput).fill('Added by catalog route E2E');
    await page.getByTestId(testIds.catalog.categoryInput).fill('shelter');

    const itemPostPromise = page.waitForResponse(
      (r) => /\/api\/packs\/[^/]+\/items/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30_000 },
    );

    await page.getByTestId(testIds.catalog.addDetailsSubmitBtn).click();
    const itemResponse = await itemPostPromise;
    expect(itemResponse.ok()).toBeTruthy();

    await page.goto(`${BASE_URL}/pack/${packId}`);
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('shelter').first()).toBeVisible({ timeout: 10_000 });
  });
});
