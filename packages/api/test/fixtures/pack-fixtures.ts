import type { InferInsertModel } from 'drizzle-orm';
import type { packItems, packs } from '../../src/db/schema';

/**
 * Test fixture for creating a minimal valid pack
 */
export const createTestPack = (
  overrides?: Partial<InferInsertModel<typeof packs>>,
): InferInsertModel<typeof packs> => {
  const now = new Date();
  return {
    id: overrides?.id ?? `test-pack-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: overrides?.name ?? 'Test Hiking Pack',
    description: overrides?.description ?? 'A test pack for hiking trips',
    category: overrides?.category ?? 'hiking',
    userId: overrides?.userId ?? 1, // Default to test user
    templateId: overrides?.templateId ?? null,
    isPublic: overrides?.isPublic ?? false,
    image: overrides?.image ?? null,
    tags: overrides?.tags ?? null,
    deleted: overrides?.deleted ?? false,
    isAIGenerated: overrides?.isAIGenerated ?? false,
    localCreatedAt: overrides?.localCreatedAt ?? now,
    localUpdatedAt: overrides?.localUpdatedAt ?? now,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  };
};

/**
 * Test fixture for creating a pack item
 */
export const createTestPackItem = (
  overrides?: Partial<InferInsertModel<typeof packItems>>,
): InferInsertModel<typeof packItems> => {
  const now = new Date();
  return {
    id: overrides?.id ?? `test-item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: overrides?.name ?? 'Test Item',
    description: overrides?.description ?? 'A test pack item',
    weight: overrides?.weight ?? 500,
    weightUnit: overrides?.weightUnit ?? 'g',
    quantity: overrides?.quantity ?? 1,
    category: overrides?.category ?? 'gear',
    consumable: overrides?.consumable ?? false,
    worn: overrides?.worn ?? false,
    image: overrides?.image ?? null,
    notes: overrides?.notes ?? null,
    packId: overrides?.packId ?? 'test-pack-id',
    catalogItemId: overrides?.catalogItemId ?? null,
    userId: overrides?.userId ?? 1,
    deleted: overrides?.deleted ?? false,
    isAIGenerated: overrides?.isAIGenerated ?? false,
    templateItemId: overrides?.templateItemId ?? null,
    embedding: overrides?.embedding ?? null,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  };
};
