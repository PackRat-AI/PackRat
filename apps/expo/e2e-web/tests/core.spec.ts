/**
 * Web E2E tests for PackRat core functionality.
 *
 * Each test navigates to a route after seeding auth tokens in localStorage.
 * TestIds match the constants in lib/testIds.ts and the Maestro iOS flows.
 */
import { BASE_URL, expect, test } from './fixtures';

// ─── Dashboard ──────────────────────────────────────────────────────────────

test('dashboard loads authenticated', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/`);
  // Tab bar must be visible — confirms app rendered past the auth gate
  await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Packs/i })).toBeVisible();
});

// ─── Packs ───────────────────────────────────────────────────────────────────

test('packs tab loads and shows create button', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/packs`);
  await expect(page.getByTestId('create-pack-button')).toBeVisible();
});

test('create a pack end-to-end', async ({ authedPage: page }) => {
  const packName = `E2E-Pack-${Date.now()}`;

  // Use waitForResponse to capture the created pack ID.
  // Navigating directly to /pack/new means router.back() fails on submit,
  // so we intercept the API response instead of relying on navigation.
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByRole('textbox', { name: /Pack Name/i }).fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  expect(packResponse.ok()).toBeTruthy();

  // Verify pack appears in the list
  await page.goto(`${BASE_URL}/packs`);
  await expect(page.getByText(packName)).toBeVisible({ timeout: 10_000 });
});

// ─── Pack Detail — add items ─────────────────────────────────────────────────

test('add item manually to a pack', async ({ authedPage: page }) => {
  const packName = `E2E-AddItem-${Date.now()}`;

  // Create a pack via API and capture the ID
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByTestId('packs:name-input').fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  expect(packResponse.ok()).toBeTruthy();
  const { id: packId } = (await packResponse.json()) as { id: number };

  // Fill the item creation form using testIds
  await page.goto(`${BASE_URL}/item/new?packId=${packId}`);
  await page.getByTestId('items:name-input').fill('Test Tent');
  await page.getByTestId('items:weight-input').fill('1200');

  // Submit — createPackItem syncs to API and updates local store
  await Promise.all([
    page
      .waitForResponse(
        (r) =>
          r.url().includes('/api/packs') &&
          r.url().includes('/items') &&
          r.request().method() === 'POST',
      )
      .catch(() => null), // API call may be deferred by syncedCrud
    page.getByTestId('items:submit').click(),
  ]);

  // Navigate to pack detail — item should be visible (local store or API)
  await page.goto(`${BASE_URL}/pack/${packId}`);
  await expect(page.getByText('Test Tent')).toBeVisible({ timeout: 15_000 });
});

test('add item from catalog to a pack', async ({ authedPage: page }) => {
  const packName = `E2E-Catalog-${Date.now()}`;

  // Create a pack and capture the ID
  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByRole('textbox', { name: /Pack Name/i }).fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  const { id: packId } = (await packResponse.json()) as { id: number };

  // Navigate to pack detail and open "Add from Catalog" sheet
  await page.goto(`${BASE_URL}/pack/${packId}`);
  await page.getByTestId('add-from-catalog-option').last().click();

  // Dialog with catalog items should appear
  await expect(page.getByText('Browse Catalog').first()).toBeVisible({ timeout: 10_000 });

  // Wait for catalog items to load, then click the first one
  const firstCard = page.getByTestId(/^catalog-item-card-/).first();
  await firstCard.waitFor({ timeout: 15_000 });
  await firstCard.click();

  // Confirm "Add N item(s)" panel appears and click it
  await expect(page.getByText(/Add \d+ item/i)).toBeVisible({ timeout: 5_000 });
  await page.getByText(/Add \d+ item/i).click();

  // Local store updates synchronously; the pack detail (behind the modal) re-renders.
  // A non-zero weight confirms the catalog item was added.
  await expect(page.getByText(/[1-9]\d*\.?\d*g/).first()).toBeVisible({ timeout: 10_000 });
});

// ─── Trips ────────────────────────────────────────────────────────────────────

test('trips tab loads', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/trips`);
  await expect(page.getByText('Create New Trip')).toBeVisible();
});

test('create a trip with dates', async ({ authedPage: page }) => {
  const tripName = `E2E-Trip-${Date.now()}`;

  await page.goto(`${BASE_URL}/trip/new`);
  await page.getByRole('textbox', { name: /Trip Name/i }).fill(tripName);

  // Open start date picker and set via native input
  await page.getByText('Start DateSelect date').click();
  await page.locator('input[type="date"]').fill('2026-08-01');

  // Open end date picker
  await page.getByText('End DateSelect date').click();
  await page.locator('input[type="date"]').fill('2026-08-14');

  await page.getByTestId('submit-trip-button').click();

  // Navigate to trips list and verify
  await page.goto(`${BASE_URL}/trips`);
  await expect(page.getByText(tripName)).toBeVisible({ timeout: 10_000 });
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

test('catalog tab loads items', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/catalog`);
  // Wait for items to load — at least one item name visible
  await expect(page.locator('text=/\\d+,?\\d+ items/i').first()).toBeVisible({ timeout: 15_000 });
});

test('catalog search filters results', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/catalog`);
  // Wait for initial load
  await page.waitForLoadState('networkidle');

  // The search box is revealed by clicking the search icon
  await page.getByText('󰍉').first().click();

  const searchBox = page.locator('input[placeholder*="Search"]');
  await searchBox.waitFor({ timeout: 5_000 });
  await searchBox.fill('sleeping bag');
  // Results should update — check item names
  await expect(page.getByText(/sleeping bag/i).first()).toBeVisible({ timeout: 10_000 });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

test('profile screen loads user info', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/profile`);
  await expect(page.getByText('Account Information')).toBeVisible();
  // User email should be visible
  await expect(page.getByText(/@/).first()).toBeVisible();
});

test('profile name edit screen', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/profile/name`);
  await expect(page.getByRole('heading', { name: 'Name' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(2); // First + Last
});

// ─── Settings ─────────────────────────────────────────────────────────────────

test('settings screen loads', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/settings`);
  await expect(page.getByText('AI Models')).toBeVisible();
  await expect(page.getByText('Danger Zone')).toBeVisible();
  await expect(page.getByText(/PackRat v/i)).toBeVisible();
});

// ─── AI Chat ──────────────────────────────────────────────────────────────────

test('AI chat sends message and gets response', async ({ authedPage: page }) => {
  test.setTimeout(60_000); // AI streaming responses can take 20-30s
  // Create a pack to chat about first
  const packName = `E2E-AI-${Date.now()}`;

  const [packResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/packs') && r.request().method() === 'POST'),
    (async () => {
      await page.goto(`${BASE_URL}/pack/new`);
      await page.getByRole('textbox', { name: /Pack Name/i }).fill(packName);
      await page.getByTestId('submit-pack-button').click();
    })(),
  ]);

  const { id: packId } = (await packResponse.json()) as { id: number };

  await page.goto(
    `${BASE_URL}/ai-chat?packId=${packId}&packName=${encodeURIComponent(packName)}&contextType=pack`,
  );

  // Greet message should be visible
  await expect(page.getByText(/working with your/i).first()).toBeVisible();

  // Send a message
  await page.getByRole('textbox', { name: /Ask about this pack/i }).fill('List 3 essential items.');
  // Send button is icon-only with no accessible name; use the arrow-up icon character
  await page.getByText('󰁝').click();

  // Wait for AI response (streaming may take a while)
  await expect(page.getByText(/item/i).nth(1)).toBeVisible({ timeout: 30_000 });
});

// ─── Weather ──────────────────────────────────────────────────────────────────

test('weather screen loads', async ({ authedPage: page }) => {
  await page.goto(`${BASE_URL}/weather`);
  await expect(page.getByText('Weather', { exact: true }).first()).toBeVisible();
  // Empty state or locations list
  await expect(page.getByText('No saved locations').or(page.locator('text=/°[FC]/'))).toBeVisible({
    timeout: 10_000,
  });
});
