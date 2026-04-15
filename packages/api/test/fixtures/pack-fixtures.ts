import type { InferInsertModel } from 'drizzle-orm';
import type { packItems, packs } from '../../src/db/schema';

type PackOverrides = Partial<InferInsertModel<typeof packs>> & { userId: number };
type PackItemOverrides = Partial<InferInsertModel<typeof packItems>> & { userId: number };

/**
 * Test fixture for creating a minimal valid pack.
 * `userId` is required — no default (#2180).
 */
export const createTestPack = (overrides: PackOverrides): InferInsertModel<typeof packs> => {
  const now = new Date();
  return {
    id: overrides.id ?? `pack_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name: overrides.name ?? 'Test Backpacking Pack',
    description: overrides.description ?? 'A test pack for backpacking trips',
    category: overrides.category ?? 'backpacking',
    templateId: overrides.templateId ?? null,
    isPublic: overrides.isPublic ?? false,
    image: overrides.image ?? null,
    tags: overrides.tags ?? ['hiking', 'backpacking'],
    deleted: overrides.deleted ?? false,
    isAIGenerated: overrides.isAIGenerated ?? false,
    localCreatedAt: overrides.localCreatedAt ?? now,
    localUpdatedAt: overrides.localUpdatedAt ?? now,
    ...overrides,
  };
};

export const createTestPackItem = (
  packId: string,
  overrides: PackItemOverrides,
): InferInsertModel<typeof packItems> => {
  return {
    id: overrides.id ?? `item_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name: overrides.name ?? 'Test Backpack',
    description: overrides.description ?? 'A test item for the pack',
    weight: overrides.weight ?? 1200,
    weightUnit: overrides.weightUnit ?? 'g',
    quantity: overrides.quantity ?? 1,
    category: overrides.category ?? 'pack',
    consumable: overrides.consumable ?? false,
    worn: overrides.worn ?? false,
    image: overrides.image ?? null,
    notes: overrides.notes ?? null,
    packId,
    catalogItemId: overrides.catalogItemId ?? null,
    deleted: overrides.deleted ?? false,
    ...overrides,
  };
};

export const createFullTestPack = (overrides: PackOverrides): InferInsertModel<typeof packs> => {
  return {
    ...createTestPack(overrides),
    tags: overrides.tags ?? ['ultralight', 'thru-hiking', 'backpacking'],
    isPublic: overrides.isPublic ?? true,
  };
};
