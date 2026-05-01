/**
 * Web E2E tests for PackRat Trips — CRUD + validation.
 *
 * Trips use syncedCrud (no direct fetch), so creation/edit/delete are verified
 * by navigating to the list/detail rather than by intercepting API responses.
 *
 * testIds source: apps/expo/lib/testIds.ts
 */
import { BASE_URL, expect, test } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to /trip/new, fill the form, and submit.
 * Returns the unique trip name used so the caller can find it in the list.
 */
async function createTrip(
  page: Parameters<Parameters<typeof test>[1]>[0],
  opts: {
    name: string;
    description?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  },
) {
  await page.goto(`${BASE_URL}/trip/new`);
  await page.getByTestId('trips:name-input').fill(opts.name);

  if (opts.description) {
    await page.getByTestId('trips:description-input').fill(opts.description);
  }

  if (opts.startDate) {
    await page
      .getByText(/Start Date/i)
      .first()
      .click();
    await page.locator('input[type="date"]').first().fill(opts.startDate);
  }

  if (opts.endDate) {
    await page
      .getByText(/End Date/i)
      .first()
      .click();
    // After clicking End Date the second date input (or first if start already filled) becomes active
    await page.locator('input[type="date"]').last().fill(opts.endDate);
  }

  await page.getByTestId('submit-trip-button').click();
}

/**
 * Navigate to /trips, find the named trip, click it, and return the trip detail URL
 * (which encodes the trip ID).
 */
async function openTripFromList(page: Parameters<Parameters<typeof test>[1]>[0], tripName: string) {
  await page.goto(`${BASE_URL}/trips`);
  await expect(page.getByText(tripName)).toBeVisible({ timeout: 10_000 });
  await page.getByText(tripName).first().click();
  // Wait for navigation to /trip/[id]
  await page.waitForURL(/\/trip\/[^/]+$/, { timeout: 10_000 });
  return page.url();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

test.describe('Trip CRUD', () => {
  test('create a trip with dates → appears in list', async ({ authedPage: page }) => {
    const tripName = `E2E-Trip-${Date.now()}`;

    await createTrip(page, {
      name: tripName,
      startDate: '2026-08-01',
      endDate: '2026-08-14',
    });

    await page.goto(`${BASE_URL}/trips`);
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 10_000 });
  });

  test('create a trip with a description → description visible on detail', async ({
    authedPage: page,
  }) => {
    const tripName = `E2E-TripDesc-${Date.now()}`;
    const description = 'A scenic Pacific Crest Trail section.';

    await createTrip(page, {
      name: tripName,
      description,
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    });

    // Navigate to list, click trip to open detail
    const detailUrl = await openTripFromList(page, tripName);
    expect(detailUrl).toMatch(/\/trip\/[^/]+$/);
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test('edit trip name → updated name visible in detail', async ({ authedPage: page }) => {
    const originalName = `E2E-EditTrip-${Date.now()}`;
    const updatedName = `${originalName}-EDITED`;

    // Create the trip first
    await createTrip(page, { name: originalName, startDate: '2026-07-01', endDate: '2026-07-10' });

    // Get the trip ID from the detail URL
    const detailUrl = await openTripFromList(page, originalName);
    const tripId = detailUrl.split('/trip/')[1];
    expect(tripId).toBeTruthy();

    // Navigate directly to edit form
    await page.goto(`${BASE_URL}/trip/${tripId}/edit`);

    // The name field should be pre-populated; clear and re-fill
    const nameInput = page.getByTestId('trips:name-input');
    await nameInput.waitFor({ timeout: 5_000 });
    await nameInput.clear();
    await nameInput.fill(updatedName);

    await page.getByTestId('submit-trip-button').click();

    // Navigate to trips list and confirm updated name
    await page.goto(`${BASE_URL}/trips`);
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(originalName)).not.toBeVisible();
  });

  test('delete trip → disappears from list', async ({ authedPage: page }) => {
    const tripName = `E2E-DeleteTrip-${Date.now()}`;

    // Create the trip, then open its detail page
    await createTrip(page, { name: tripName, startDate: '2026-10-01', endDate: '2026-10-05' });
    const detailUrl = await openTripFromList(page, tripName);
    const tripId = detailUrl.split('/trip/')[1];
    expect(tripId).toBeTruthy();

    // Accept the Alert.alert confirmation dialog automatically
    page.on('dialog', (dialog) => dialog.accept());

    // Click the delete button in the trip detail header
    const deleteButton = page.getByTestId('trips:delete');
    await deleteButton.waitFor({ timeout: 5_000 });
    await deleteButton.click();

    // After deletion the app should navigate away; verify trip is gone from the list
    await page.goto(`${BASE_URL}/trips`);
    await expect(page.getByText(tripName)).not.toBeVisible();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

test.describe('Trip form validation', () => {
  test('empty trip name → submit button disabled or shows validation message', async ({
    authedPage: page,
  }) => {
    await page.goto(`${BASE_URL}/trip/new`);

    // Ensure name field is empty
    const nameInput = page.getByTestId('trips:name-input');
    await nameInput.waitFor({ timeout: 5_000 });
    await nameInput.clear();

    const submitButton = page.getByTestId('submit-trip-button');
    await submitButton.waitFor({ timeout: 5_000 });

    // Either the button is disabled, OR clicking it shows a validation message
    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      // Good — submit is blocked
      expect(isDisabled).toBe(true);
    } else {
      // Click and expect a validation error to appear
      await submitButton.click();
      await expect(
        page
          .getByText(/name is required/i)
          .or(page.getByText(/please enter a name/i))
          .or(page.getByText(/trip name.*required/i))
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // Confirm we did NOT navigate away from the form
    expect(page.url()).toContain('/trip/new');
  });

  test('end date before start date → validation message shown', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/trip/new`);

    await page.getByTestId('trips:name-input').fill('Validation Test Trip');

    // Set start date
    await page
      .getByText(/Start Date/i)
      .first()
      .click();
    await page.locator('input[type="date"]').first().fill('2026-08-14');

    // Set end date BEFORE start date
    await page
      .getByText(/End Date/i)
      .first()
      .click();
    await page.locator('input[type="date"]').last().fill('2026-08-01');

    await page.getByTestId('submit-trip-button').click();

    // Expect an error message about date ordering
    await expect(
      page
        .getByText(/end date.*before.*start/i)
        .or(page.getByText(/start date.*after.*end/i))
        .or(page.getByText(/invalid date range/i))
        .or(page.getByText(/date.*invalid/i))
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // Should remain on the form
    expect(page.url()).toContain('/trip/new');
  });
});

// ─── List UI ──────────────────────────────────────────────────────────────────

test.describe('Trips list', () => {
  test('trips list shows create button', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/trips`);
    await expect(page.getByTestId('create-trip-button')).toBeVisible();
  });

  test('create-trip-button navigates to /trip/new', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/trips`);
    await page.getByTestId('create-trip-button').click();
    await page.waitForURL(/\/trip\/new/, { timeout: 5_000 });
    expect(page.url()).toContain('/trip/new');
  });

  test('trip list item links to correct trip detail', async ({ authedPage: page }) => {
    const tripName = `E2E-ListItem-${Date.now()}`;

    await createTrip(page, { name: tripName, startDate: '2026-11-01', endDate: '2026-11-03' });

    await page.goto(`${BASE_URL}/trips`);
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 10_000 });
    await page.getByText(tripName).first().click();

    await page.waitForURL(/\/trip\/[^/]+$/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/trip\/[^/]+$/);

    // Detail page should display the trip name
    await expect(page.getByText(tripName).first()).toBeVisible({ timeout: 5_000 });
  });
});
