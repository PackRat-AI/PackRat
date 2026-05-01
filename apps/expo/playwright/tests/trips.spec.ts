/**
 * Web E2E tests for PackRat Trips — CRUD + validation.
 *
 * Trips use syncedCrud which fires POST/PUT/DELETE to /api/trips asynchronously.
 * We intercept those API responses before navigating away so the DB is in a
 * consistent state when the next page reloads and re-fetches from the API.
 *
 * testIds source: apps/expo/lib/testIds.ts
 */
import { BASE_URL, expect, test } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Set a date on an <input type="date"> rendered by the DateTimePicker mock.
 * The mock uses a controlled React input; we use the native HTMLInputElement
 * value setter (bypasses React's tracker) then dispatch both 'input' and
 * 'change' events so React's synthetic onChange fires regardless of version.
 */
async function fillDateInput(
  page: import('@playwright/test').Page,
  opts: { testId: string; value: string },
): Promise<void> {
  const input = page.getByTestId(opts.testId);
  await input.waitFor({ timeout: 5_000 });
  await input.evaluate((el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, opts.value);
}

/**
 * Navigate to /trip/new, fill the form, submit, and wait for the POST /api/trips
 * response to be confirmed before returning.  Returns the server-assigned trip id
 * so the caller can navigate directly to the detail / edit routes.
 */
async function createTrip(
  page: import('@playwright/test').Page,
  opts: {
    name: string;
    description?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  },
): Promise<string> {
  await page.goto(`${BASE_URL}/trip/new`);

  // Fill trip name
  const nameInput = page.getByTestId('trips:name-input');
  await nameInput.waitFor({ timeout: 10_000 });
  await nameInput.fill(opts.name);

  // Fill optional description
  if (opts.description) {
    await page.getByTestId('trips:description-input').fill(opts.description);
  }

  // Set start date: click the Pressable to show the DateTimePicker, then set
  // the date via the native input setter so React's onChange fires correctly.
  if (opts.startDate) {
    await page.getByTestId('trips:start-date-btn').click();
    await fillDateInput(page, { testId: 'trips:start-date-input', value: opts.startDate });
  }

  // Set end date similarly.
  if (opts.endDate) {
    await page.getByTestId('trips:end-date-btn').click();
    await fillDateInput(page, { testId: 'trips:end-date-input', value: opts.endDate });
  }

  // Register the listener immediately before submitting so the 20s window starts here,
  // not before navigation+form-fill which can exceed 20s on slow CI runners.
  const postPromise = page.waitForResponse(
    (r) => r.url().includes('/api/trips') && r.request().method() === 'POST',
    { timeout: 20_000 },
  );

  // Submit the form
  await page.getByTestId('submit-trip-button').click();

  // Wait for the POST to complete so the trip is persisted before any page reload
  const response = await postPromise;
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

test.describe('Trip CRUD', () => {
  test('create a trip with dates → appears in list', async ({ authedPage: page }) => {
    test.setTimeout(60_000);
    const tripName = `E2E-Trip-${Date.now()}`;

    await createTrip(page, {
      name: tripName,
      startDate: '2026-08-01',
      endDate: '2026-08-14',
    });

    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 15_000 });
  });

  test('create a trip with a description → description visible on detail', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000);
    const tripName = `E2E-TripDesc-${Date.now()}`;
    const description = 'A scenic Pacific Crest Trail section.';

    const tripId = await createTrip(page, {
      name: tripName,
      description,
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    });

    // Navigate directly to the detail page using the id from the POST response
    await page.goto(`${BASE_URL}/trip/${tripId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(description)).toBeVisible({ timeout: 15_000 });
  });

  test('edit trip name → updated name visible in detail', async ({ authedPage: page }) => {
    test.setTimeout(90_000);
    const originalName = `E2E-EditTrip-${Date.now()}`;
    const updatedName = `${originalName}-EDITED`;

    // Create the trip first (waits for POST response)
    const tripId = await createTrip(page, {
      name: originalName,
      startDate: '2026-07-01',
      endDate: '2026-07-10',
    });

    // Open the detail page via SPA nav so the JS context stays alive for the PUT
    await page.goto(`${BASE_URL}/trip/${tripId}`);
    await page.waitForLoadState('networkidle');

    // Click the edit button (SPA nav — keeps the store alive so syncedCrud can flush)
    const editButton = page.getByTestId('trips:edit');
    await editButton.waitFor({ timeout: 10_000 });
    await editButton.click();

    // Wait for the edit form to load
    const nameInput = page.getByTestId('trips:name-input');
    await nameInput.waitFor({ timeout: 10_000 });
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Register the PUT listener before submitting
    const putPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/trips') &&
        (r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
      { timeout: 20_000 },
    );

    await page.getByTestId('submit-trip-button').click();

    // Await the PUT so the DB is updated before reloading
    await putPromise;

    // Updated name should appear in the trip detail (full reload from API)
    await page.goto(`${BASE_URL}/trip/${tripId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 15_000 });
  });

  test('delete trip → disappears from list', async ({ authedPage: page }) => {
    test.setTimeout(90_000);
    const tripName = `E2E-DeleteTrip-${Date.now()}`;

    // Create the trip (waits for POST)
    const tripId = await createTrip(page, {
      name: tripName,
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });
    void tripId; // id captured for scoping the URL; used below

    // Navigate to trips list first to build SPA history (list → detail → list via back)
    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 15_000 });

    // SPA-navigate to trip detail by clicking the list item
    await page.getByText(tripName).first().click();
    await page.waitForURL(/\/trip\/[^/]+$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Click the delete button — triggers Alert.alert → window.confirm on web.
    // The dialog handler registered above accepts it automatically.
    const deleteButton = page.getByTestId('trips:delete');
    await deleteButton.waitFor({ timeout: 10_000 });
    await deleteButton.click();

    // router.back() SPA-navigates away from the trip detail.
    // Wait for URL to change (either to /trips or /)
    await page.waitForURL((url) => !url.pathname.startsWith('/trip/'), { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Navigate to trips list to confirm trip is gone
    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tripName)).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

test.describe('Trip form validation', () => {
  test.setTimeout(30_000);

  test('empty trip name → submit button disabled or form stays on page', async ({
    authedPage: page,
  }) => {
    await page.goto(`${BASE_URL}/trip/new`);

    // Ensure name field is empty
    const nameInput = page.getByTestId('trips:name-input');
    await nameInput.waitFor({ timeout: 5_000 });
    await nameInput.clear();

    const submitButton = page.getByTestId('submit-trip-button');
    await submitButton.waitFor({ timeout: 5_000 });

    // NativeWindUI Pressable renders disabled state as aria-disabled, not the HTML
    // disabled attribute — use aria check rather than isDisabled().
    const ariaDisabled = await submitButton.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') {
      // Button is aria-disabled — good, submit is blocked
      await expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    } else {
      // Button is clickable — clicking must NOT navigate away
      const formUrl = page.url();
      await submitButton.click();
      await page.waitForTimeout(1_500);
      expect(page.url()).toBe(formUrl);
    }

    // Either way, we must still be on the create form
    expect(page.url()).toContain('/trip/new');
  });

  test('end date before start date → validation message shown', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/trip/new`);

    await page.getByTestId('trips:name-input').fill('Validation Test Trip');

    // Set start date
    await page.getByTestId('trips:start-date-btn').click();
    await fillDateInput(page, { testId: 'trips:start-date-input', value: '2026-08-14' });

    // Set end date BEFORE start date
    await page.getByTestId('trips:end-date-btn').click();
    await fillDateInput(page, { testId: 'trips:end-date-input', value: '2026-08-01' });

    // Validation fires onChange — error should appear without needing to click submit.
    // If button is not disabled, click it to also trigger onSubmit validation.
    const submitButton = page.getByTestId('submit-trip-button');
    await submitButton.waitFor({ timeout: 5_000 });
    const ariaDisabled = await submitButton.getAttribute('aria-disabled');
    if (ariaDisabled !== 'true') {
      await submitButton.click();
    }

    // The zod refinement message is "End date must be after start date"
    await expect(
      page
        .getByText(/end date must be after start date/i)
        .or(page.getByText(/end date.*before.*start/i))
        .or(page.getByText(/start date.*after.*end/i))
        .or(page.getByText(/invalid date range/i))
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
    test.setTimeout(60_000);
    const tripName = `E2E-ListItem-${Date.now()}`;

    const tripId = await createTrip(page, {
      name: tripName,
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });

    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 15_000 });
    await page.getByText(tripName).first().click();

    await page.waitForURL(/\/trip\/[^/]+$/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/trip\/[^/]+$/);
    expect(page.url()).toContain(tripId);

    // Wait for the detail page to fully mount before asserting content.
    // NOTE: getByText(tripName) also matches the hidden TripCard element from the trips list
    // (kept in DOM by Expo Router for tab history). Check the detail-specific "Dates" section
    // instead — it only renders on the trip detail page, not on list cards.
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('trips:dates-section')).toBeVisible({ timeout: 15_000 });
  });
});
