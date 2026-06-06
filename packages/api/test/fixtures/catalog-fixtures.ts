import type { catalogItems } from '@packrat/db';
import type { InferInsertModel } from 'drizzle-orm';

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
 * Test fixture for creating a catalog item with all scalar fields populated.
 * Does NOT populate the heavy JSONB columns (variants, techs, links, reviews,
 * qas, faqs); use `createFatCatalogItem` when those need to be exercised
 * (e.g., shape-contract tests that need to confirm whether the heavy JSONB
 * is selected by a query path).
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

/**
 * Test fixture for creating a catalog item with EVERY scalar field AND every
 * heavy JSONB column populated (variants, techs, links, reviews, qas, faqs).
 * Use for shape-contract tests that need to confirm whether a query path
 * actually selects these columns — without them populated, the path's
 * select/strip behavior is indistinguishable from "field is null in DB".
 */
export const createFatCatalogItem = (
  overrides?: Partial<InferInsertModel<typeof catalogItems>>,
): InferInsertModel<typeof catalogItems> => {
  return {
    ...createFullTestCatalogItem(overrides),
    variants: overrides?.variants ?? [
      { attribute: 'color', values: ['Green', 'Red', 'Blue'] },
      { attribute: 'size', values: ['1P', '2P', '3P'] },
    ],
    techs: overrides?.techs ?? {
      'fly material': '20D Sil/Nylon',
      'floor material': '30D Nylon',
      poles: 'DAC Featherlite NSL',
      'packed weight': '1200g',
    },
    links: overrides?.links ?? [
      { title: 'Manufacturer page', url: 'https://example.com/tent/spec' },
      { title: 'Review video', url: 'https://example.com/tent/video' },
    ],
    reviews: overrides?.reviews ?? [
      {
        user_name: 'Alice',
        rating: 5,
        title: 'Solid tent',
        text: 'Held up in heavy wind. Recommend.',
        date: '2026-04-01',
        verified: true,
      },
      {
        user_name: 'Bob',
        rating: 4,
        title: 'Good but pricey',
        text: 'Worth it for thru-hiking.',
        date: '2026-03-15',
        verified: false,
      },
    ],
    qas: overrides?.qas ?? [
      {
        question: 'Is the floor bathtub-style?',
        user: 'Charlie',
        date: '2026-02-20',
        answers: [{ a: 'Yes, 4-inch bathtub.', date: '2026-02-21', user: 'Manufacturer' }],
      },
    ],
    faqs: overrides?.faqs ?? [
      { question: 'What is the trail weight?', answer: '1080g without stakes.' },
      { question: 'Does it pack down small?', answer: 'Yes, 18" x 5" packed.' },
    ],
  };
};
