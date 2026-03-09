import type { PackItem } from 'expo-app/types';
import { describe, expect, it } from 'vitest';
import { calculateBaseWeight, calculateTotalWeight, convertWeight, formatWeight } from '../weight';

// ---------------------------------------------------------------------------
// Helper: build a minimal PackItem for testing
// ---------------------------------------------------------------------------
function makeItem(
  overrides: Partial<PackItem> & Pick<PackItem, 'weight' | 'weightUnit'>,
): PackItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    quantity: overrides.quantity ?? 1,
    consumable: overrides.consumable ?? false,
    worn: overrides.worn ?? false,
    packId: 'pack-1',
    userId: 'user-1',
    category: 'tools',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// convertWeight
// ---------------------------------------------------------------------------
describe('convertWeight', () => {
  it('returns the same value when from === to', () => {
    expect(convertWeight(100, 'g', 'g')).toBe(100);
    expect(convertWeight(5, 'oz', 'oz')).toBe(5);
    expect(convertWeight(2, 'kg', 'kg')).toBe(2);
    expect(convertWeight(1, 'lb', 'lb')).toBe(1);
  });

  it('converts grams to ounces', () => {
    expect(convertWeight(100, 'g', 'oz')).toBeCloseTo(3.53, 1);
  });

  it('converts ounces to grams', () => {
    expect(convertWeight(1, 'oz', 'g')).toBe(28);
  });

  it('converts grams to kilograms', () => {
    expect(convertWeight(1000, 'g', 'kg')).toBe(1);
  });

  it('converts kilograms to grams', () => {
    expect(convertWeight(1, 'kg', 'g')).toBe(1000);
  });

  it('converts grams to pounds', () => {
    expect(convertWeight(453.59, 'g', 'lb')).toBeCloseTo(1, 1);
  });

  it('converts pounds to grams', () => {
    expect(convertWeight(1, 'lb', 'g')).toBe(454);
  });
});

// ---------------------------------------------------------------------------
// formatWeight
// ---------------------------------------------------------------------------
describe('formatWeight', () => {
  it('formats weight with unit suffix', () => {
    expect(formatWeight(100, 'g')).toBe('100g');
    expect(formatWeight(3.5, 'oz')).toBe('3.5oz');
    expect(formatWeight(0, 'kg')).toBe('0kg');
  });
});

// ---------------------------------------------------------------------------
// calculateBaseWeight
// ---------------------------------------------------------------------------
describe('calculateBaseWeight', () => {
  it('returns 0 for an empty item list', () => {
    expect(calculateBaseWeight([])).toBe(0);
  });

  it('sums non-consumable, non-worn items', () => {
    const items = [makeItem({ weight: 200, weightUnit: 'g' })];
    expect(calculateBaseWeight(items, 'g')).toBe(200);
  });

  it('excludes consumable items from base weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateBaseWeight(items, 'g')).toBe(100);
  });

  it('excludes worn items from base weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', worn: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateBaseWeight(items, 'g')).toBe(100);
  });

  it('accounts for item quantity', () => {
    const items = [makeItem({ weight: 100, weightUnit: 'g', quantity: 3 })];
    expect(calculateBaseWeight(items, 'g')).toBe(300);
  });

  it('returns 0 when all items are consumable or worn', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g', worn: true }),
    ];
    expect(calculateBaseWeight(items, 'g')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalWeight
// ---------------------------------------------------------------------------
describe('calculateTotalWeight', () => {
  it('returns 0 for an empty item list', () => {
    expect(calculateTotalWeight([])).toBe(0);
  });

  it('includes consumable items in total weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', consumable: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateTotalWeight(items, 'g')).toBe(300);
  });

  it('includes worn items in total weight', () => {
    const items = [
      makeItem({ weight: 200, weightUnit: 'g', worn: true }),
      makeItem({ weight: 100, weightUnit: 'g' }),
    ];
    expect(calculateTotalWeight(items, 'g')).toBe(300);
  });

  it('converts mixed weight units correctly', () => {
    const items = [
      makeItem({ id: 'i1', weight: 1000, weightUnit: 'g' }),
      makeItem({ id: 'i2', weight: 1, weightUnit: 'kg' }),
    ];
    expect(calculateTotalWeight(items, 'g')).toBe(2000);
  });

  it('accounts for item quantity', () => {
    const items = [makeItem({ weight: 100, weightUnit: 'g', quantity: 5 })];
    expect(calculateTotalWeight(items, 'g')).toBe(500);
  });
});
