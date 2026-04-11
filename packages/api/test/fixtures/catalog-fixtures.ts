import type { InferInsertModel } from 'drizzle-orm';
import type { catalogItems } from '../../src/db/schema';

/**
 * Test fixture for creating a minimal valid catalog item
 */
export const createTestCatalogItem = (
  overrides?: Partial<InferInsertModel<typeof catalogItems>>,
): InferInsertModel<typeof catalogItems> => {
  return {
    name: overrides?.name ?? 'Test Tent',
    productUrl: overrides?.productUrl ?? 'https://example.com/tent',
    sku: overrides?.sku ?? `TEST-${Date.now()}`,
    weight: overrides?.weight ?? 1200,
    weightUnit: overrides?.weightUnit ?? 'g',
    description: overrides?.description ?? 'A test tent for backpacking',
    categories: overrides?.categories ?? ['shelter'],
    brand: overrides?.brand ?? 'TestBrand',
    model: overrides?.model ?? 'TestModel',
    price: overrides?.price ?? 299.99,
    ...overrides,
  };
};

/**
 * Test fixture for creating a catalog item with all fields
 */
export const createFullTestCatalogItem = (
  overrides?: Partial<InferInsertModel<typeof catalogItems>>,
): InferInsertModel<typeof catalogItems> => {
  return {
    ...createTestCatalogItem(overrides),
    images: overrides?.images ?? ['https://example.com/tent.jpg'],
    ratingValue: overrides?.ratingValue ?? 4.5,
    color: overrides?.color ?? 'Green',
    size: overrides?.size ?? '2-Person',
    availability: overrides?.availability ?? 'in_stock',
    seller: overrides?.seller ?? 'REI',
    productSku: overrides?.productSku ?? 'REI-789',
    material: overrides?.material ?? 'Nylon',
    currency: overrides?.currency ?? 'USD',
    condition: overrides?.condition ?? 'New',
    reviewCount: overrides?.reviewCount ?? 127,
  };
};
