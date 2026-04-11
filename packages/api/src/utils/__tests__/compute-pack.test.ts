import type { PackItem, PackWithItems } from '@packrat/api/db/schema';
import { describe, expect, it } from 'vitest';
import { computePacksWeights, computePackWeights } from '../compute-pack';

// ---------------------------------------------------------------------------
// Minimal factory helpers
// ---------------------------------------------------------------------------
function makePack(overrides: Partial<PackWithItems> = {}): PackWithItems {
  return {
    id: 'pack-1',
    name: 'Test Pack',
    description: null,
    category: 'hiking',
    userId: 1,
    templateId: null,
    isPublic: false,
    image: null,
    tags: [],
    deleted: false,
    isAIGenerated: false,
    localCreatedAt: new Date(),
    localUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
}

function makePackItem(
  overrides: Partial<PackItem> & Pick<PackItem, 'weight' | 'weightUnit'>,
): PackItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    quantity: overrides.quantity ?? 1,
    consumable: overrides.consumable ?? false,
    worn: overrides.worn ?? false,
    packId: 'pack-1',
    userId: 1,
    deleted: false,
    isAIGenerated: false,
    category: null,
    description: null,
    image: null,
    notes: null,
    catalogItemId: null,
    templateItemId: null,
    embedding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computePackWeights
// ---------------------------------------------------------------------------
describe('computePackWeights', () => {
  it('returns zero base and total weight for an empty pack', () => {
    const pack = makePack({ items: [] });
    const result = computePackWeights(pack);
    expect(result.baseWeight).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it('throws when items is null/undefined', () => {
    // Force the missing-items scenario by casting to bypass TS
    const pack = makePack({ items: undefined as unknown as PackItem[] });
    expect(() => computePackWeights(pack)).toThrow(`Pack with ID pack-1 has no items`);
  });

  it('calculates correct base and total weight in grams', () => {
    const items = [
      makePackItem({ id: 'i1', weight: 200, weightUnit: 'g' }),
      makePackItem({ id: 'i2', weight: 100, weightUnit: 'g' }),
    ];
    const result = computePackWeights(makePack({ items }));
    expect(result.totalWeight).toBe(300);
    expect(result.baseWeight).toBe(300);
  });

  it('excludes consumable items from base weight but includes in total', () => {
    const items = [
      makePackItem({ id: 'i1', weight: 200, weightUnit: 'g', consumable: true }),
      makePackItem({ id: 'i2', weight: 100, weightUnit: 'g' }),
    ];
    const result = computePackWeights(makePack({ items }));
    expect(result.totalWeight).toBe(300);
    expect(result.baseWeight).toBe(100);
  });

  it('excludes worn items from base weight but includes in total', () => {
    const items = [
      makePackItem({ id: 'i1', weight: 200, weightUnit: 'g', worn: true }),
      makePackItem({ id: 'i2', weight: 100, weightUnit: 'g' }),
    ];
    const result = computePackWeights(makePack({ items }));
    expect(result.totalWeight).toBe(300);
    expect(result.baseWeight).toBe(100);
  });

  it('multiplies weight by item quantity', () => {
    const items = [makePackItem({ weight: 100, weightUnit: 'g', quantity: 3 })];
    const result = computePackWeights(makePack({ items }));
    expect(result.totalWeight).toBe(300);
    expect(result.baseWeight).toBe(300);
  });

  it('converts weights across units before summing', () => {
    const items = [
      makePackItem({ id: 'i1', weight: 1, weightUnit: 'kg' }), // 1000 g
      makePackItem({ id: 'i2', weight: 1000, weightUnit: 'g' }), // 1000 g
    ];
    const result = computePackWeights(makePack({ items }));
    expect(result.totalWeight).toBe(2000);
    expect(result.baseWeight).toBe(2000);
  });

  it('respects the preferredUnit parameter (oz)', () => {
    const items = [makePackItem({ weight: 28.35, weightUnit: 'g' })];
    const result = computePackWeights(makePack({ items }), 'oz');
    expect(result.totalWeight).toBeCloseTo(1, 1);
  });

  it('respects the preferredUnit parameter (kg)', () => {
    const items = [makePackItem({ weight: 1000, weightUnit: 'g' })];
    const result = computePackWeights(makePack({ items }), 'kg');
    expect(result.totalWeight).toBe(1);
  });

  it('preserves all other pack properties', () => {
    const pack = makePack({ name: 'My Pack', category: 'backpacking', items: [] });
    const result = computePackWeights(pack);
    expect(result.name).toBe('My Pack');
    expect(result.category).toBe('backpacking');
  });

  it('rounds computed weights to 2 decimal places', () => {
    // 100g in oz = 3.527... rounded to 2 decimals
    const items = [makePackItem({ weight: 100, weightUnit: 'g' })];
    const result = computePackWeights(makePack({ items }), 'oz');
    const decimals = result.totalWeight.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 2).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computePacksWeights
// ---------------------------------------------------------------------------
describe('computePacksWeights', () => {
  it('returns an empty array for no packs', () => {
    expect(computePacksWeights([])).toEqual([]);
  });

  it('computes weights for multiple packs', () => {
    const packs = [
      makePack({
        id: 'p1',
        items: [makePackItem({ weight: 500, weightUnit: 'g' })],
      }),
      makePack({
        id: 'p2',
        items: [makePackItem({ weight: 1000, weightUnit: 'g' })],
      }),
    ];
    const results = computePacksWeights(packs);
    expect(results[0]?.totalWeight).toBe(500);
    expect(results[1]?.totalWeight).toBe(1000);
  });
});
