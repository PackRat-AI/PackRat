import type { PackItem } from '@packrat/types';
import { describe, expect, it } from 'vitest';
import {
  calculateBaseWeight,
  calculateTotalWeight,
  convertToGrams,
  convertWeight,
  formatWeight,
} from '../weight';

// ---------------------------------------------------------------------------
// Helper: build a minimal PackItem for testing
// ---------------------------------------------------------------------------
function makeItem(
  overrides: Partial<PackItem> & Pick<PackItem, 'weight' | 'weightUnit'>,
): PackItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    description: null,
    quantity: overrides.quantity ?? 1,
    category: null,
    consumable: overrides.consumable ?? false,
    worn: overrides.worn ?? false,
    image: null,
    notes: null,
    packId: 'pack-1',
    catalogItemId: null,
    userId: 'user-1',
    deleted: false,
    isAIGenerated: false,
    templateItemId: null,
    embedding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PackItem;
}

// ---------------------------------------------------------------------------
// convertWeight
// ---------------------------------------------------------------------------
describe('convertWeight', () => {
  it('returns the same value when from === to', () => {
    expect(convertWeight({ weight: 100, units: { from: 'g', to: 'g' } })).toBe(100);
    expect(convertWeight({ weight: 5, units: { from: 'oz', to: 'oz' } })).toBe(5);
    expect(convertWeight({ weight: 2, units: { from: 'kg', to: 'kg' } })).toBe(2);
    expect(convertWeight({ weight: 1, units: { from: 'lb', to: 'lb' } })).toBe(1);
  });

  it('converts grams to ounces', () => {
    expect(convertWeight({ weight: 100, units: { from: 'g', to: 'oz' } })).toBeCloseTo(3.53, 1);
  });

  it('converts ounces to grams', () => {
    expect(convertWeight({ weight: 1, units: { from: 'oz', to: 'g' } })).toBeCloseTo(
      28.349523125,
      8,
    );
  });

  it('converts grams to kilograms', () => {
    expect(convertWeight({ weight: 1000, units: { from: 'g', to: 'kg' } })).toBe(1);
  });

  it('converts kilograms to grams', () => {
    expect(convertWeight({ weight: 1, units: { from: 'kg', to: 'g' } })).toBe(1000);
  });

  it('converts grams to pounds', () => {
    expect(convertWeight({ weight: 453.59, units: { from: 'g', to: 'lb' } })).toBeCloseTo(1, 1);
  });

  it('converts pounds to grams', () => {
    expect(convertWeight({ weight: 1, units: { from: 'lb', to: 'g' } })).toBeCloseTo(453.59237, 4);
  });
});

// ---------------------------------------------------------------------------
// formatWeight
// ---------------------------------------------------------------------------
describe('formatWeight', () => {
  it('formats weight with unit', () => {
    expect(formatWeight({ weight: 100, unit: 'g' })).toBe('100g');
    expect(formatWeight({ weight: 3.5, unit: 'oz' })).toBe('3.5oz');
    expect(formatWeight({ weight: 0, unit: 'kg' })).toBe('0kg');
  });
});

// ---------------------------------------------------------------------------
// convertToGrams (legacy helper)
// ---------------------------------------------------------------------------
describe('convertToGrams', () => {
  it('returns the same value for grams', () => {
    expect(convertToGrams({ weight: 100, unit: 'g' })).toBe(100);
  });

  it('converts kilograms to grams', () => {
    expect(convertToGrams({ weight: 1, unit: 'kg' })).toBe(1000);
  });

  it('converts ounces to grams', () => {
    expect(convertToGrams({ weight: 1, unit: 'oz' })).toBeCloseTo(28.35, 1);
  });

  it('converts pounds to grams', () => {
    expect(convertToGrams({ weight: 1, unit: 'lb' })).toBeCloseTo(453.59, 0);
  });

  it('returns weight unchanged for unknown units', () => {
    expect(convertToGrams({ weight: 50, unit: 'unknown' })).toBe(50);
  });

  it('returns weight unchanged for mixed-case units (case-sensitive)', () => {
    expect(convertToGrams({ weight: 1, unit: 'KG' })).toBe(1); // unknown → treated as grams passthrough
    expect(convertToGrams({ weight: 1, unit: 'OZ' })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateBaseWeight
// ---------------------------------------------------------------------------
describe('calculateBaseWeight', () => {
  it('returns 0 for an empty item list', () => {
    expect(calculateBaseWeight({ items: [] })).toBe(0);
  });

  it('sums non-consumable, non-worn items', () => {
    const items = [makeItem({ weight: 200, weightUnit: 'g' })];
    expect(calculateBaseWeight({ items, unit: 'g' })).toBe(200);
  });

  it('excludes consumable items from base weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateBaseWeight({ items, unit: 'g' })).toBe(100);
  });

  it('excludes worn items from base weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', worn: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateBaseWeight({ items, unit: 'g' })).toBe(100);
  });

  it('accounts for item quantity', () => {
    const items = [makeItem({ weight: 100, weightUnit: 'g', quantity: 3 })];
    expect(calculateBaseWeight({ items, unit: 'g' })).toBe(300);
  });

  it('returns 0 when all items are consumable or worn', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g', worn: true }),
    ];
    expect(calculateBaseWeight({ items, unit: 'g' })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalWeight
// ---------------------------------------------------------------------------
describe('calculateTotalWeight', () => {
  it('returns 0 for an empty item list', () => {
    expect(calculateTotalWeight({ items: [] })).toBe(0);
  });

  it('includes consumable items in total weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateTotalWeight({ items, unit: 'g' })).toBe(300);
  });

  it('includes worn items in total weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', worn: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateTotalWeight({ items, unit: 'g' })).toBe(300);
  });

  it('converts mixed weight units correctly', () => {
    const items = [
      makeItem({ weight: 1000, weightUnit: 'g' }), // 1000 g
      makeItem({ weight: 1, weightUnit: 'kg' }), // 1000 g
    ];
    expect(calculateTotalWeight({ items, unit: 'g' })).toBe(2000);
  });

  it('accounts for item quantity', () => {
    const items = [makeItem({ weight: 100, weightUnit: 'g', quantity: 5 })];
    expect(calculateTotalWeight({ items, unit: 'g' })).toBe(500);
  });
});
