import { createDb } from '@packrat/api/db';
import { hashPassword } from '@packrat/api/utils/auth';
import { assertDefined } from '@packrat/guards';
import type { InferInsertModel } from 'drizzle-orm';

import * as schema from '../../src/db/schema';
import {
  catalogItems,
  packItems,
  packs,
  packTemplateItems,
  packTemplates,
  type users,
} from '../../src/db/schema';
import { createTestCatalogItem } from '../fixtures/catalog-fixtures';
import { createTestPack, createTestPackItem } from '../fixtures/pack-fixtures';
import {
  createTestPackTemplate,
  createTestPackTemplateItem,
} from '../fixtures/pack-template-fixtures';
import { setCurrentTestAdmin, setCurrentTestUser } from './test-helpers';

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
 * Seeds a test user via UserService (same path production register uses).
 * Returns the user with DB-assigned id. Does NOT register as the current JWT
 * subject — tests that want `apiWithAuth` to authenticate as this user must
 * also call `loginAs(user)` or use `seedAndLoginTestUser()`.
 */
export async function seedTestUser(overrides?: Partial<InferInsertModel<typeof users>>) {
  const db = createDb();
  const password = (overrides as { password?: string } | undefined)?.password ?? 'TestPassword1!';
  const passwordHash = await hashPassword(password);
  const email =
    overrides?.email ?? `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      passwordHash,
      firstName: overrides?.firstName ?? 'Test',
      lastName: overrides?.lastName ?? 'User',
      role: overrides?.role ?? 'USER',
      emailVerified: overrides?.emailVerified ?? true,
    })
    .returning();

  assertDefined(user);
  return user;
}

/**
 * Seeds a user AND registers them as the current JWT subject so apiWithAuth
 * (or apiWithAdmin, for role: "ADMIN") authenticates as them. Use in
 * beforeEach for the "primary" test user.
 */
export async function seedAndLoginTestUser(
  overrides?: Partial<InferInsertModel<typeof users>> & { password?: string },
) {
  const user = await seedTestUser(overrides);
  const role = (user.role ?? 'USER') as 'USER' | 'ADMIN';
  const subject = { id: user.id, role };
  if (role === 'ADMIN') setCurrentTestAdmin(subject);
  else setCurrentTestUser(subject);
  return user;
}

/**
 * Seeds a catalog item into the test database
 * @returns The created catalog item with id
 */
export async function seedCatalogItem(overrides?: Partial<InferInsertModel<typeof catalogItems>>) {
  // Use the mocked database (which is connected in test setup)
  // The createDb function is mocked to return the test database, so we can pass an empty context
  const db = createDb();

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

  assertDefined(item);

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
  const db = createDb();

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
 * Seeds a pack template into the test database
 * @returns The created pack template with id
 */
export async function seedPackTemplate(
  overrides: Partial<InferInsertModel<typeof packTemplates>> & { userId: number },
) {
  const db = createDb();

  const templateData = createTestPackTemplate(overrides);

  const [template] = await db.insert(packTemplates).values(templateData).returning();

  assertDefined(template);

  return template;
}

/**
 * Seeds multiple pack templates into the test database
 * @returns Array of created pack templates with ids
 */

export async function seedPackTemplates(
  count: number,
  overrides: Partial<InferInsertModel<typeof packTemplates>> & { userId: number },
) {
  const db = createDb();

  const templates = Array.from({ length: count }, (_, i) => {
    return createTestPackTemplate({
      ...overrides,
      name: `Test Template ${i + 1}`,
    });
  });

  const createdTemplates = await db.insert(packTemplates).values(templates).returning();

  return createdTemplates;
}

/**
 * Seeds a pack template item into the test database
 * @returns The created pack template item with id
 */

export async function seedPackTemplateItem(
  packTemplateId: string,
  overrides: Partial<InferInsertModel<typeof packTemplateItems>> & { userId: number },
) {
  const db = createDb();

  const itemData = createTestPackTemplateItem(packTemplateId, overrides);

  const [item] = await db.insert(packTemplateItems).values(itemData).returning();

  assertDefined(item);

  return item;
}

/**
 * Seeds multiple pack template items into the test database
 * @returns Array of created pack template items with ids
 */

export async function seedPackTemplateItems(
  packTemplateId: string,
  opts: {
    count: number;
    overrides: Partial<InferInsertModel<typeof packTemplateItems>> & { userId: number };
  },
) {
  const { count, overrides } = opts;
  const db = createDb();

  const items = Array.from({ length: count }, (_, i) => {
    return createTestPackTemplateItem(packTemplateId, {
      ...overrides,
      name: `Test Item ${i + 1}`,
    });
  });

  const createdItems = await db.insert(packTemplateItems).values(items).returning();

  return createdItems;
}

/**
 * Seeds a pack into the test database
 * @returns The created pack with id
 */
export async function seedPack(
  overrides: Partial<InferInsertModel<typeof packs>> & { userId: number },
) {
  const db = createDb();

  const packData = createTestPack(overrides);

  const [pack] = await db.insert(packs).values(packData).returning();

  assertDefined(pack);

  return pack;
}

/**
 * Seeds multiple packs into the test database
 * @returns Array of created packs with ids
 */

export async function seedPacks(
  count: number,
  overrides: Partial<InferInsertModel<typeof packs>> & { userId: number },
) {
  const db = createDb();

  const packsData = Array.from({ length: count }, (_, i) => {
    return createTestPack({
      ...overrides,
      name: `Test Pack ${i + 1}`,
    });
  });

  const createdPacks = await db.insert(packs).values(packsData).returning();

  return createdPacks;
}

/**
 * Seeds a pack item into the test database
 * @returns The created pack item with id
 */

export async function seedPackItem(
  packId: string,
  overrides: Partial<InferInsertModel<typeof packItems>> & { userId: number },
) {
  const db = createDb();

  const itemData = createTestPackItem(packId, overrides);

  const [item] = await db.insert(packItems).values(itemData).returning();

  assertDefined(item);

  return item;
}

/**
 * Seeds multiple pack items into the test database
 * @returns Array of created pack items with ids
 */

export async function seedPackItems(
  packId: string,
  opts: {
    count: number;
    overrides: Partial<InferInsertModel<typeof packItems>> & { userId: number };
  },
) {
  const { count, overrides } = opts;
  const db = createDb();

  const items = Array.from({ length: count }, (_, i) => {
    return createTestPackItem(packId, {
      ...overrides,
      name: `Test Item ${i + 1}`,
    });
  });

  const createdItems = await db.insert(packItems).values(items).returning();

  return createdItems;
}
