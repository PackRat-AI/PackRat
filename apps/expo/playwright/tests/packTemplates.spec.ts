import { testIds } from '../../lib/testIds';
import { BASE_URL, expect, test } from './fixtures';

async function openTemplateCreation(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/pack-templates/new`);
  await page.getByTestId(testIds.packTemplates.nameInput).waitFor({ timeout: 10_000 });
}

async function createPackTemplate(page: import('@playwright/test').Page, name: string) {
  await openTemplateCreation(page);
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/pack-templates') &&
      response.status() >= 200 &&
      response.status() < 300,
  );
  await page.getByTestId(testIds.packTemplates.nameInput).fill(name);
  await page.getByTestId(testIds.packTemplates.submitBtn).click();
  const response = await createResponse;
  const payload = await response.json().catch(() => null);
  const templateId = payload?.id ?? payload?.data?.id ?? payload?.template?.id;
  expect(templateId, 'template id').toBeTruthy();
  return templateId as string;
}

async function openTemplate(
  page: import('@playwright/test').Page,
  templateId: string,
  name: string,
) {
  await page.goto(`${BASE_URL}/pack-templates/${templateId}`);
  await page.waitForURL(/\/pack-templates\/[^/]+$/, { timeout: 10_000 });
  await expect(page.locator('body')).toContainText(name, { timeout: 10_000 });
}

async function createTemplateItem(
  page: import('@playwright/test').Page,
  opts: {
    packTemplateId: string;
    name: string;
    worn?: boolean;
    consumable?: boolean;
    weight?: string;
    quantity?: string;
    notes?: string;
  },
) {
  const {
    packTemplateId,
    name,
    worn = false,
    consumable = false,
    weight = '500',
    quantity = '1',
    notes = '',
  } = opts;

  await page.getByText('Add Item', { exact: true }).last().click();
  await page.getByTestId(testIds.packTemplates.addManuallyBtn).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
  await page.getByTestId(testIds.packTemplates.addManuallyBtn).click();
  await page.getByTestId(testIds.packTemplates.nameInput).waitFor({ timeout: 10_000 });

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/pack-templates') &&
      response.status() >= 200 &&
      response.status() < 300,
  );

  await page.getByTestId(testIds.packTemplates.nameInput).fill(name);
  await page.getByTestId(testIds.packTemplates.weightInput).fill(weight);
  await page.getByTestId(testIds.items.quantityInput).fill(quantity);
  if (consumable) {
    await page.getByTestId(testIds.packTemplates.consumableSwitch).click();
  }
  if (worn) {
    await page.getByTestId(testIds.packTemplates.wornSwitch).click();
  }
  if (notes) {
    await page.getByTestId(testIds.packTemplates.notesInput).fill(notes);
  }

  await page.getByTestId(testIds.packTemplates.submitBtn).click();
  const response = await createResponse;
  const payload = await response.json().catch(() => null);
  const itemId = payload?.id ?? payload?.data?.id ?? payload?.item?.id;
  expect(itemId, 'template item id').toBeTruthy();
  return itemId as string;
}

test.describe('Pack template CRUD', () => {
  test('creates, edits, and deletes a template', async ({ signedInPage: page }) => {
    test.setTimeout(90_000);
    const templateName = `E2E-Template-${Date.now()}`;
    const updatedName = `${templateName}-UPDATED`;

    const templateId = await createPackTemplate(page, templateName);
    await openTemplate(page, templateId, templateName);

    await page.getByTestId(testIds.packTemplates.detailEditBtn).click();
    await page.waitForURL(/\/pack-templates\/[^/]+\/edit/, { timeout: 10_000 });
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/pack-templates') &&
        response.status() >= 200 &&
        response.status() < 300,
    );
    await page.getByTestId(testIds.packTemplates.nameInput).fill(updatedName);
    await page.getByTestId(testIds.packTemplates.submitBtn).click();
    await updateResponse;

    await expect(page.locator('body')).toContainText(updatedName, { timeout: 10_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(testIds.packTemplates.detailDeleteBtn).click();
    await page.goto(`${BASE_URL}/pack-templates`);
    await expect(page.locator('body')).not.toContainText(updatedName, { timeout: 10_000 });
  });

  test('creates, updates, filters, and deletes template items', async ({
    signedInPage: page,
  }) => {
    test.setTimeout(120_000);
    const templateName = `E2E-TemplateItems-${Date.now()}`;
    const wornItemName = `${templateName}-WORN`;
    const consumableItemName = `${templateName}-CONSUMABLE`;
    const updatedItemName = `${wornItemName}-UPDATED`;

    const templateId = await createPackTemplate(page, templateName);
    await openTemplate(page, templateId, templateName);
    expect(templateId).toBeTruthy();

    const wornItemId = await createTemplateItem(page, {
      packTemplateId: templateId as string,
      name: wornItemName,
      worn: true,
      weight: '300',
      notes: 'Layer one',
    });
    await expect(page.getByTestId(testIds.packTemplates.itemCard(wornItemId))).toBeVisible({
      timeout: 10_000,
    });

    const consumableItemId = await createTemplateItem(page, {
      packTemplateId: templateId as string,
      name: consumableItemName,
      consumable: true,
      weight: '120',
      quantity: '3',
      notes: 'Snacks',
    });
    await expect(page.getByTestId(testIds.packTemplates.itemCard(consumableItemId))).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId(testIds.packTemplates.wornTab).click();
    await expect(page.locator('body')).toContainText(wornItemName, { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(consumableItemName, {
      timeout: 10_000,
    });

    await page.getByTestId(testIds.packTemplates.consumableTab).click();
    await expect(page.locator('body')).toContainText(consumableItemName, { timeout: 10_000 });

    await page.getByTestId(testIds.packTemplates.allTab).click();
    await expect(page.locator('body')).toContainText(wornItemName, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(consumableItemName, { timeout: 10_000 });

    await page.getByTestId(testIds.packTemplates.itemCardActionsBtn(wornItemId)).click();
    await page.getByText('Edit', { exact: true }).click();
    await page.waitForURL(/\/templateItem\/[^/]+\/edit/, { timeout: 10_000 });
    await expect(page.getByTestId(testIds.packTemplates.nameInput)).toHaveValue(wornItemName, {
      timeout: 10_000,
    });
    await page.getByTestId(testIds.packTemplates.nameInput).fill(updatedItemName);
    await page.getByTestId(testIds.packTemplates.submitBtn).click();
    await page.waitForURL(/\/pack-templates\/[^/]+$/, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(updatedItemName, { timeout: 10_000 });
    await expect(page.getByTestId(testIds.packTemplates.itemCard(wornItemId))).toBeVisible({
      timeout: 10_000,
    });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(testIds.packTemplates.itemCardActionsBtn(wornItemId)).click();
    await page.getByText('Delete', { exact: true }).click();
    await expect(page.locator('body')).not.toContainText(updatedItemName, {
      timeout: 10_000,
    });
  });
});
