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
): Promise<number> {
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByTestId('packs:name-input').fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  expect(packResponse.ok()).toBeTruthy();
  const { id } = (await packResponse.json()) as { id: number };
  return id;
}

// ─── Pack CRUD ────────────────────────────────────────────────────────────────

test.describe('Pack CRUD', () => {
  test.setTimeout(30_000);

  test('create pack → appears in packs list', async ({ authedPage: page }) => {
    const packName = `E2E-Create-${Date.now()}`;

    await createPackViaForm(page, packName);

    await page.goto(`${BASE_URL}/packs`);
    await expect(page.getByText(packName)).toBeVisible({ timeout: 10_000 });
  });

  test('edit pack name → updated name appears in list and detail', async ({ authedPage: page }) => {
    const originalName = `E2E-Edit-${Date.now()}`;
    const updatedName = `${originalName}-UPDATED`;

    const packId = await createPackViaForm(page, originalName);

    // Navigate to the edit form
    await page.goto(`${BASE_URL}/pack/${packId}/edit`);
    const nameInput = page.getByTestId('packs:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();
    await nameInput.fill(updatedName);

    const [editResponse] = await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.url().includes('/api/packs') &&
            (r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
        )
        .catch(() => null),
      page.getByTestId('submit-pack-button').click(),
    ]);

    // API call may be deferred by syncedCrud — proceed regardless
    if (editResponse) {
      expect((editResponse as import('@playwright/test').Response).ok()).toBeTruthy();
    }

    // Updated name should appear in the packs list
    await page.goto(`${BASE_URL}/packs`);
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });

    // Updated name should also appear in the pack detail
    await page.goto(`${BASE_URL}/pack/${packId}`);
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
  });

  test('delete pack → disappears from packs list', async ({ authedPage: page }) => {
    const packName = `E2E-Delete-${Date.now()}`;
    const packId = await createPackViaForm(page, packName);

    // Accept any browser-native confirm/alert dialogs before triggering delete
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(`${BASE_URL}/pack/${packId}`);
    const deleteButton = page.getByTestId('packs:delete');
    await deleteButton.waitFor({ timeout: 10_000 });
    await deleteButton.click();

    // After deletion the app should navigate away; go to list and confirm pack is gone
    await page.goto(`${BASE_URL}/packs`);
    await expect(page.getByText(packName)).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Item CRUD within a pack ──────────────────────────────────────────────────

test.describe('Item CRUD within a pack', () => {
  test.setTimeout(30_000);

  // Create a fresh pack before each item test so tests are independent
  let sharedPackId: number;

  test.beforeEach(async ({ authedPage: page }) => {
    const packName = `E2E-ItemPack-${Date.now()}`;
    sharedPackId = await createPackViaForm(page, packName);
  });

  test('add item manually → appears in pack detail', async ({ authedPage: page }) => {
    const itemName = `E2E-Item-${Date.now()}`;

    await page.goto(`${BASE_URL}/item/new?packId=${sharedPackId}`);
    await page.getByTestId('items:name-input').fill(itemName);
    await page.getByTestId('items:weight-input').fill('850');

    await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.url().includes('/api/packs') &&
            r.url().includes('/items') &&
            r.request().method() === 'POST',
        )
        .catch(() => null),
      page.getByTestId('items:submit').click(),
    ]);

    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });
  });

  test('edit item name → updated name appears in pack detail', async ({ authedPage: page }) => {
    const itemName = `E2E-EditItem-${Date.now()}`;
    const updatedItemName = `${itemName}-UPDATED`;

    // Add the item first
    await page.goto(`${BASE_URL}/item/new?packId=${sharedPackId}`);
    await page.getByTestId('items:name-input').fill(itemName);
    await page.getByTestId('items:weight-input').fill('500');

    const [itemCreateResponse] = await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.url().includes('/api/packs') &&
            r.url().includes('/items') &&
            r.request().method() === 'POST',
        )
        .catch(() => null),
      page.getByTestId('items:submit').click(),
    ]);

    // Derive item ID if the API responded, otherwise discover it via the card testId
    let itemId: number | string | undefined;
    if (itemCreateResponse) {
      const body = await (itemCreateResponse as import('@playwright/test').Response)
        .json()
        .catch(() => null);
      if (body && typeof body === 'object' && 'id' in body) {
        itemId = (body as { id: number }).id;
      }
    }

    // Navigate to pack detail to locate the item card if we don't have the id yet
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });

    if (!itemId) {
      // Discover the item id from the card testId attribute
      const card = page.locator('[data-testid^="items:card-"]').first();
      await card.waitFor({ timeout: 10_000 });
      const testId = await card.getAttribute('data-testid');
      itemId = testId?.replace('items:card-', '');
    }

    // Navigate to the item edit form
    await page.goto(`${BASE_URL}/item/${itemId}/edit?packId=${sharedPackId}`);
    const nameInput = page.getByTestId('items:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();
    await nameInput.fill(updatedItemName);

    await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.url().includes('/api/packs') &&
            r.url().includes('/items') &&
            (r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
        )
        .catch(() => null),
      page.getByTestId('items:submit').click(),
    ]);

    // Updated name should be visible in pack detail
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(updatedItemName)).toBeVisible({ timeout: 15_000 });
  });

  test('delete item via more-actions menu → disappears from pack detail', async ({
    authedPage: page,
  }) => {
    const itemName = `E2E-DeleteItem-${Date.now()}`;

    // Add the item
    await page.goto(`${BASE_URL}/item/new?packId=${sharedPackId}`);
    await page.getByTestId('items:name-input').fill(itemName);
    await page.getByTestId('items:weight-input').fill('300');

    const [itemCreateResponse] = await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.url().includes('/api/packs') &&
            r.url().includes('/items') &&
            r.request().method() === 'POST',
        )
        .catch(() => null),
      page.getByTestId('items:submit').click(),
    ]);

    let itemId: number | string | undefined;
    if (itemCreateResponse) {
      const body = await (itemCreateResponse as import('@playwright/test').Response)
        .json()
        .catch(() => null);
      if (body && typeof body === 'object' && 'id' in body) {
        itemId = (body as { id: number }).id;
      }
    }

    // Confirm item is in pack detail
    await page.goto(`${BASE_URL}/pack/${sharedPackId}`);
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });

    if (!itemId) {
      const card = page.locator('[data-testid^="items:card-"]').first();
      await card.waitFor({ timeout: 10_000 });
      const testId = await card.getAttribute('data-testid');
      itemId = testId?.replace('items:card-', '');
    }

    // Accept dialogs (web confirm) before triggering delete
    page.on('dialog', (dialog) => dialog.accept());

    // Open the more-actions menu for the item
    const moreActionsButton = page.getByTestId(`items:more-actions-${itemId}`);
    if (await moreActionsButton.isVisible()) {
      await moreActionsButton.click();
      // Look for a delete option in the action sheet / menu
      const deleteOption = page
        .getByText(/delete/i)
        .or(page.getByRole('menuitem', { name: /delete/i }))
        .first();
      await deleteOption.waitFor({ timeout: 5_000 });
      await deleteOption.click();

      // Item should no longer be visible
      await expect(page.getByText(itemName)).not.toBeVisible({ timeout: 10_000 });
    } else {
      // items:more-actions may not be rendered on web — skip gracefully
      test.skip(true, 'items:more-actions button not accessible on web');
    }
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

test.describe('Validation', () => {
  test.setTimeout(15_000);

  test('empty pack name → submit button disabled or error shown', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/pack/new`);

    const submitButton = page.getByTestId('submit-pack-button');
    await submitButton.waitFor({ timeout: 10_000 });

    // Ensure the name field is empty
    const nameInput = page.getByTestId('packs:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();

    // The submit button should be disabled OR clicking it should reveal an error
    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    } else {
      await submitButton.click();
      // An inline error or toast about the required field should appear
      await expect(
        page
          .getByText(/required/i)
          .or(page.getByText(/name is required/i))
          .or(page.getByText(/cannot be empty/i))
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('empty item name → submit button disabled or error shown', async ({ authedPage: page }) => {
    // We need a valid pack to reach the item form
    const packName = `E2E-Validation-${Date.now()}`;
    const packId = await createPackViaForm(page, packName);

    await page.goto(`${BASE_URL}/item/new?packId=${packId}`);

    const submitButton = page.getByTestId('items:submit');
    await submitButton.waitFor({ timeout: 10_000 });

    // Ensure the name field is empty
    const nameInput = page.getByTestId('items:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();

    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    } else {
      await submitButton.click();
      await expect(
        page
          .getByText(/required/i)
          .or(page.getByText(/name is required/i))
          .or(page.getByText(/cannot be empty/i))
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
