import { createDb } from '@packrat/api/db';
import type { InferInsertModel } from 'drizzle-orm';
import type { Context } from 'hono';
import { catalogItems, packItems, packs } from '../../src/db/schema';
import { createTestCatalogItem } from '../fixtures/catalog-fixtures';
import { createTestPack, createTestPackItem } from '../fixtures/pack-fixtures';

/**
 * Generates a mock embedding vector
 * @param dimensions Number of dimensions for the embedding (default: 1536 for OpenAI)
 * @returns An array of random numbers
 */
function generateMockEmbedding(dimensions = 1536): number[] {
  return Array.from({ length: dimensions }, () => Math.random());
}

/**
 * Generates a unique SKU for testing
 */
let skuCounter = 0;
function generateUniqueSku(): string {
  return `TEST-${Date.now()}-${skuCounter++}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Seeds a catalog item into the test database
 * @returns The created catalog item with id
 */
export async function seedCatalogItem(overrides?: Partial<InferInsertModel<typeof catalogItems>>) {
  // Use the mocked database (which is connected in test setup)
  // The createDb function is mocked to return the test database, so we can pass an empty context
  const db = createDb({} as unknown as Context);

  const itemData = createTestCatalogItem({
    ...overrides,
    // Always use a unique SKU unless explicitly provided
    sku: overrides?.sku ?? generateUniqueSku(),
  });
  // Add a mock embedding if not provided
  const dataWithEmbedding = {
    ...itemData,
    embedding: overrides?.embedding ?? generateMockEmbedding(),
  };

  const [item] = await db.insert(catalogItems).values(dataWithEmbedding).returning();

  return item;
}

/**
 * Seeds multiple catalog items into the test database
 * @returns Array of created catalog items with ids
 */
export async function seedCatalogItems(
  count: number,
  overrides?: Partial<InferInsertModel<typeof catalogItems>>,
) {
  // Use the mocked database (which is connected in test setup)
  // The createDb function is mocked to return the test database, so we can pass an empty context
  const db = createDb({} as unknown as Context);

  const items = Array.from({ length: count }, (_, i) => {
    const baseItem = createTestCatalogItem({
      ...overrides,
      name: `Test Item ${i + 1}`,
      sku: generateUniqueSku(),
    });

    return {
      ...baseItem,
      embedding: generateMockEmbedding(),
    };
  });

  const createdItems = await db.insert(catalogItems).values(items).returning();

  return createdItems;
}

/**
 * Seeds a pack into the test database
 * @returns The created pack with id
 */
export async function seedPack(overrides?: Partial<InferInsertModel<typeof packs>>) {
  const db = createDb({} as unknown as Context);

  const packData = createTestPack(overrides);

  const [pack] = await db.insert(packs).values(packData).returning();

  return pack;
}

/**
 * Seeds multiple packs into the test database
 * @returns Array of created packs with ids
 */
export async function seedPacks(
  count: number,
  overrides?: Partial<InferInsertModel<typeof packs>>,
) {
  const db = createDb({} as unknown as Context);

  const packsData = Array.from({ length: count }, (_, i) => {
    return createTestPack({
      ...overrides,
      name: overrides?.name ?? `Test Pack ${i + 1}`,
      id: `test-pack-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    });
  });

  const createdPacks = await db.insert(packs).values(packsData).returning();

  return createdPacks;
}

/**
 * Seeds a pack item into the test database
 * @returns The created pack item with id
 */
export async function seedPackItem(overrides?: Partial<InferInsertModel<typeof packItems>>) {
  const db = createDb({} as unknown as Context);

  const itemData = createTestPackItem(overrides);

  const [item] = await db.insert(packItems).values(itemData).returning();

  return item;
}

/**
 * Seeds multiple pack items into the test database
 * @returns Array of created pack items with ids
 */
export async function seedPackItems(
  count: number,
  overrides?: Partial<InferInsertModel<typeof packItems>>,
) {
  const db = createDb({} as unknown as Context);

  const items = Array.from({ length: count }, (_, i) => {
    return createTestPackItem({
      ...overrides,
      name: overrides?.name ?? `Test Item ${i + 1}`,
      id: `test-item-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    });
  });

  const createdItems = await db.insert(packItems).values(items).returning();

  return createdItems;
}
