import { describe, expect, it, vi } from 'vitest';

// Mock the auth store so computeCategorySummaries doesn't need a running
// Legend-State context.  We default to grams so weight assertions are simple.
vi.mock('expo-app/features/auth/store', () => ({
  userStore: {
    preferredWeightUnit: {
      peek: () => 'g',
    },
  },
}));

// assertDefined is a guard that throws for undefined values; stub it out since
// we always pass valid data in these tests.
vi.mock('@packrat/guards', () => ({
  assertDefined: vi.fn(),
}));

import type { Pack, PackItem } from '../../types';
import { computeCategorySummaries } from '../computeCategories';

const baseItem = (overrides: Partial<PackItem> = {}): PackItem =>
  ({
    id: 'i1',
    name: 'Item',
    weight: 100,
    weightUnit: 'g',
    quantity: 1,
    category: 'Shelter',
    consumable: false,
    worn: false,
    packId: 'p1',
    deleted: false,
    isAIGenerated: false,
    ...overrides,
  }) as PackItem;

const basePack = (items: PackItem[], totalWeight = 0): Pack =>
  ({
    id: 'p1',
    name: 'Test Pack',
    category: 'hiking',
    isPublic: false,
    items,
    baseWeight: 0,
    totalWeight,
    deleted: false,
    localCreatedAt: new Date().toISOString(),
    localUpdatedAt: new Date().toISOString(),
  }) as Pack;

describe('computeCategorySummaries', () => {
  it('returns an empty array when the pack has no items', () => {
    const result = computeCategorySummaries(basePack([], 0));
    expect(result).toEqual([]);
  });

  it('groups items under a single category', () => {
    const items = [
      baseItem({ id: 'i1', weight: 200, weightUnit: 'g', quantity: 1, category: 'Shelter' }),
      baseItem({ id: 'i2', weight: 100, weightUnit: 'g', quantity: 2, category: 'Shelter' }),
    ];
    // total weight in grams = 200 + (100*2) = 400 g
    const result = computeCategorySummaries(basePack(items, 400));

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Shelter');
    expect(result[0]?.items).toBe(2);
    expect(result[0]?.weight).toBeCloseTo(400, 1);
    expect(result[0]?.percentage).toBeCloseTo(100, 1);
  });

  it('groups items across multiple categories', () => {
    const items = [
      baseItem({ id: 'i1', weight: 300, weightUnit: 'g', quantity: 1, category: 'Shelter' }),
      baseItem({ id: 'i2', weight: 100, weightUnit: 'g', quantity: 1, category: 'Food' }),
    ];
    // total = 400 g
    const result = computeCategorySummaries(basePack(items, 400));

    expect(result).toHaveLength(2);

    const shelter = result.find((c) => c.name === 'Shelter');
    const food = result.find((c) => c.name === 'Food');

    expect(shelter?.items).toBe(1);
    expect(shelter?.weight).toBeCloseTo(300, 1);
    expect(shelter?.percentage).toBeCloseTo(75, 1);

    expect(food?.items).toBe(1);
    expect(food?.weight).toBeCloseTo(100, 1);
    expect(food?.percentage).toBeCloseTo(25, 1);
  });

  it('falls back to "Other" when an item has no category', () => {
    const item = baseItem({ id: 'i1', category: '' });
    const result = computeCategorySummaries(basePack([item], 100));

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Other');
  });

  it('trims whitespace from category names', () => {
    const items = [
      baseItem({ id: 'i1', category: '  Shelter  ' }),
      baseItem({ id: 'i2', category: 'Shelter', weight: 200 }),
    ];
    const result = computeCategorySummaries(basePack(items, 300));

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Shelter');
    expect(result[0]?.items).toBe(2);
  });

  it('percentage is 0 when totalWeight is 0', () => {
    const item = baseItem({ id: 'i1', weight: 100, quantity: 1 });
    const result = computeCategorySummaries(basePack([item], 0));

    expect(result[0]?.percentage).toBe(0);
  });

  it('multiplies weight by quantity', () => {
    const item = baseItem({ id: 'i1', weight: 50, quantity: 4, category: 'Gear' });
    const result = computeCategorySummaries(basePack([item], 200));

    expect(result[0]?.weight).toBeCloseTo(200, 1);
  });
});
