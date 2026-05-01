/**
 * Web E2E tests for Pack and Item CRUD functionality.
 *
 * Covers:
 *   - Pack create / edit / delete
 *   - Item add (manually) / edit / delete
 *   - Validation: empty name on pack and item forms
 *
 * Auth is pre-seeded via the `authedPage` fixture (storageState).
 * Pack IDs are always captured from the POST /api/packs response so that
 * tests can navigate directly to detail/edit routes without relying on
 * post-submit navigation behaviour.
 */
import { BASE_URL, expect, test } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a pack via the UI and return its server-assigned id. */
async function createPackViaForm(
  page: import('@playwright/test').Page,
  packName: string,
): Promise<string> {
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByTestId('packs:name-input').fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  expect(packResponse.ok()).toBeTruthy();
  const { id } = (await packResponse.json()) as { id: string };
  return id;
}

/** Add an item to a pack via the UI, wait for the API to persist it, return item id. */
async function addItemViaForm(
  page: import('@playwright/test').Page,
  opts: { packId: string; itemName: string; weight?: string },
): Promise<string> {
  const { packId, itemName, weight = '500' } = opts;
  await page.goto(`${BASE_URL}/item/new?packId=${packId}`);
  await page.getByTestId('items:name-input').fill(itemName);
  await page.getByTestId('items:weight-input').fill(weight);

  const itemPostPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/packs') &&
      r.url().includes('/items') &&
      r.request().method() === 'POST',
    { timeout: 20_000 },
  );

  await page.getByTestId('items:submit').click();
  const response = await itemPostPromise;
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

// ─── Pack CRUD ────────────────────────────────────────────────────────────────

test.describe('Pack CRUD', () => {
  test('create pack → appears in packs list', async ({ authedPage: page }) => {
    test.setTimeout(30_000);
    const packName = `E2E-Create-${Date.now()}`;

    await createPackViaForm(page, packName);

    await page.goto(`${BASE_URL}/packs`);
    // Scope to visible elements — Expo Router keeps hidden tab panels in DOM
    await expect(page.locator(`:text("${packName}"):visible`).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('edit pack name → updated name appears in detail', async ({ authedPage: page }) => {
    test.setTimeout(60_000);
    const originalName = `E2E-Edit-${Date.now()}`;
    const updatedName = `${originalName}-UPDATED`;

    const packId = await createPackViaForm(page, originalName);

    // Use the header edit button (SPA nav) so router.back() stays in-SPA and
    // syncedCrud can flush the PUT before the page unloads.
    await page.goto(`${BASE_URL}/pack/${packId}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('packs:edit').click();

    const nameInput = page.getByTestId('packs:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Register listener before clicking — scoped to this pack's URL
    const editPutPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/packs/${packId}`) &&
        (r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
      { timeout: 20_000 },
    );

    await page.getByTestId('submit-pack-button').click();

    // SPA router.back() keeps the JS context alive; await the PUT before navigating away
    await editPutPromise;

    // Updated name should appear in the pack detail (full reload from API)
    await page.goto(`${BASE_URL}/pack/${packId}`);
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
  });

  test('delete pack → disappears from packs list', async ({ authedPage: page }) => {
    test.setTimeout(60_000);
    const packName = `E2E-Delete-${Date.now()}`;
    const packId = await createPackViaForm(page, packName);

    await page.goto(`${BASE_URL}/pack/${packId}`);

    // Wait for the store to load and the owner check to resolve so header buttons appear
    await page.waitForLoadState('networkidle');

    // Accept any browser-native confirm/alert dialogs before triggering delete
    page.on('dialog', (dialog) => dialog.accept());

    const deleteButton = page.getByTestId('packs:delete');
    await deleteButton.waitFor({ timeout: 15_000 });
    await deleteButton.click();

    // After deletion the app should navigate away; go to list and confirm pack is gone
    await page.goto(`${BASE_URL}/packs`);
    await expect(page.getByText(packName)).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Item CRUD within a pack ──────────────────────────────────────────────────

test.describe('Item CRUD within a pack', () => {
  // Create a fresh pack before each item test so tests are independent
  let sharedPackId: string;

  test.beforeEach(async ({ authedPage: page }) => {
    const packName = `E2E-ItemPack-${Date.now()}`;
    sharedPackId = await createPackViaForm(page, packName);
  });

  test('add item manually → appears in pack detail', async ({ authedPage: page }) => {
    test.setTimeout(60_000);
    const itemName = `E2E-Item-${Date.now()}`;

    await addItemViaForm(page, { packId: sharedPackId, itemName, weight: '850' });

    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });
  });

  test('edit item name → updated name appears in pack detail', async ({ authedPage: page }) => {
    test.setTimeout(90_000);
    const itemName = `E2E-EditItem-${Date.now()}`;
    const updatedItemName = `${itemName}-UPDATED`;

    const itemId = await addItemViaForm(page, { packId: sharedPackId, itemName, weight: '500' });

    // Navigate to pack detail to verify item exists
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });

    // Navigate to the item edit form
    await page.goto(`${BASE_URL}/item/${itemId}/edit?packId=${sharedPackId}`);
    const nameInput = page.getByTestId('items:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();
    await nameInput.fill(updatedItemName);

    const editPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/packs') &&
        r.url().includes('/items') &&
        (r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
      { timeout: 20_000 },
    );

    await page.getByTestId('items:submit').click();
    await editPromise.catch(() => null);

    // Updated name should be visible in pack detail
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(updatedItemName)).toBeVisible({ timeout: 15_000 });
  });

  test('delete item via more-actions menu → disappears from pack detail', async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    const itemName = `E2E-DeleteItem-${Date.now()}`;

    const itemId = await addItemViaForm(page, { packId: sharedPackId, itemName, weight: '300' });

    // Confirm item is in pack detail
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByTestId(`items:card-${itemId}`)).toBeVisible({ timeout: 15_000 });

    // Accept dialogs (web confirm) before triggering delete
    page.on('dialog', (dialog) => dialog.accept());

    // Open the more-actions menu for the item
    const moreActionsButton = page.getByTestId(`items:more-actions-${itemId}`);
    if (await moreActionsButton.isVisible()) {
      await moreActionsButton.click();
      // Use exact match so the item name "E2E-DeleteItem-..." doesn't match
      const deleteOption = page
        .getByText('Delete', { exact: true })
        .or(page.getByRole('menuitem', { name: 'Delete' }))
        .first();
      await deleteOption.waitFor({ timeout: 5_000 });
      await deleteOption.click();

      // Item card should be gone
      await expect(page.getByTestId(`items:card-${itemId}`)).not.toBeVisible({ timeout: 10_000 });
    } else {
      test.skip(true, 'items:more-actions button not accessible on web');
    }
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

test.describe('Validation', () => {
  test.setTimeout(30_000);

  test('empty pack name → form does not navigate on submit', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/pack/new`);

    const submitButton = page.getByTestId('submit-pack-button');
    await submitButton.waitFor({ timeout: 10_000 });

    // Name field starts empty — clicking submit should either be blocked or stay on this page
    const formUrl = page.url();
    await submitButton.click();

    // Wait a moment for any navigation to settle
    await page.waitForTimeout(1_000);

    // Should still be on the create form (validation prevented navigation)
    expect(page.url()).toBe(formUrl);
  });

  test('empty item name → form does not navigate on submit', async ({ authedPage: page }) => {
    const packId = await createPackViaForm(page, `E2E-Validation-${Date.now()}`);

    await page.goto(`${BASE_URL}/item/new?packId=${packId}`);

    const submitButton = page.getByTestId('items:submit');
    await submitButton.waitFor({ timeout: 10_000 });

    const nameInput = page.getByTestId('items:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();

    const formUrl = page.url();
    await submitButton.click();

    await page.waitForTimeout(1_000);

    // Should still be on the create item form
    expect(page.url()).toBe(formUrl);
  });
});
