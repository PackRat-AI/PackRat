import type { InferInsertModel } from 'drizzle-orm';
import type { packTemplateItems, packTemplates } from '../../src/db/schema';

type PackTemplateOverrides = Partial<InferInsertModel<typeof packTemplates>> & { userId: number };

/**
 * Test fixture for creating a minimal valid pack template.
 * `userId` is required — no default (#2180).
 */
export const createTestPackTemplate = (
  overrides: PackTemplateOverrides,
): InferInsertModel<typeof packTemplates> => {
  const now = new Date();
  return {
    id: overrides.id ?? `pt_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name: overrides.name ?? 'Test Backpacking Template',
    description: overrides.description ?? 'A test template for backpacking trips',
    category: overrides.category ?? 'backpacking',
    userId: overrides.userId,
    image: overrides.image ?? null,
    tags: overrides.tags ?? ['hiking', 'backpacking'],
    isAppTemplate: overrides.isAppTemplate ?? true,
    deleted: overrides.deleted ?? false,
    localCreatedAt: overrides.localCreatedAt ?? now,
    localUpdatedAt: overrides.localUpdatedAt ?? now,
    ...overrides,
  };
};

/**
 * Test fixture for creating a pack template item
 */

type PackTemplateItemOverrides = Partial<InferInsertModel<typeof packTemplateItems>> & {
  userId: number;
};

export const createTestPackTemplateItem = (
  packTemplateId: string,
  overrides: PackTemplateItemOverrides,
): InferInsertModel<typeof packTemplateItems> => {
  return {
    id: overrides.id ?? `pti_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name: overrides.name ?? 'Test Backpack',
    description: overrides.description ?? 'A test item for the pack template',
    weight: overrides.weight ?? 1200,
    weightUnit: overrides.weightUnit ?? 'g',
    quantity: overrides.quantity ?? 1,
    category: overrides.category ?? 'pack',
    consumable: overrides.consumable ?? false,
    worn: overrides.worn ?? false,
    image: overrides.image ?? null,
    notes: overrides.notes ?? null,
    packTemplateId,
    catalogItemId: overrides.catalogItemId ?? null,
    userId: overrides.userId,
    deleted: overrides.deleted ?? false,
    ...overrides,
  };
};

/**
 * Test fixture for creating a full pack template with items
 */
export const createFullTestPackTemplate = (
  overrides: PackTemplateOverrides,
): InferInsertModel<typeof packTemplates> => {
  return {
    ...createTestPackTemplate(overrides),
    tags: overrides.tags ?? ['ultralight', 'thru-hiking', 'backpacking'],
  };
};
