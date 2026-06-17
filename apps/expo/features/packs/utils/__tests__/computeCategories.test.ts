import type { Pack, PackItem } from 'expo-app/features/packs/types';
import { describe, expect, it } from 'vitest';
import { computeCategorySummaries } from '../computeCategories';

function makeItem(
  overrides: Partial<PackItem> & Pick<PackItem, 'weight' | 'weightUnit'>,
): PackItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    quantity: 1,
    category: 'Shelter',
    consumable: false,
    worn: false,
    packId: 'pack-1',
    deleted: false,
    isAIGenerated: false,
    ...overrides,
  };
}

function makePack(items: PackItem[]): Pack {
  return {
    id: 'pack-1',
    name: 'Test Pack',
    category: 'hiking',
    isPublic: false,
    deleted: false,
    items,
    baseWeight: 0,
    totalWeight: 0,
  };
}

describe('computeCategorySummaries', () => {
  it('returns empty array for a pack with no items', () => {
    expect(computeCategorySummaries(makePack([]))).toEqual([]);
  });

  it('groups items under the correct category name', () => {
    const items = [
      makeItem({ id: 'i1', weight: 200, weightUnit: 'g', category: 'Shelter' }),
      makeItem({ id: 'i2', weight: 300, weightUnit: 'g', category: 'Food' }),
    ];
    const result = computeCategorySummaries(makePack(items));
    expect(result).toHaveLength(2);
    const names = result.map((c) => c.name);
    expect(names).toContain('Shelter');
    expect(names).toContain('Food');
  });

  it('falls back to "Other" for empty category string', () => {
    const items = [makeItem({ id: 'i1', weight: 100, weightUnit: 'g', category: '' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.name).toBe('Other');
  });

  it('falls back to "Other" for whitespace-only category', () => {
    const items = [makeItem({ id: 'i1', weight: 100, weightUnit: 'g', category: '   ' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.name).toBe('Other');
  });

  it('computes weight in preferred unit (grams)', () => {
    const items = [makeItem({ weight: 500, weightUnit: 'g', category: 'Pack' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.weight).toBe(500);
  });

  it('converts weight units before computing (kg → g)', () => {
    const items = [makeItem({ weight: 1, weightUnit: 'kg', category: 'Pack' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.weight).toBe(1000);
  });

  it('multiplies weight by quantity', () => {
    const items = [makeItem({ weight: 100, weightUnit: 'g', quantity: 3, category: 'Food' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.weight).toBe(300);
  });

  it('sets percentage to 100 for a single-category pack', () => {
    const items = [makeItem({ weight: 300, weightUnit: 'g', category: 'Electronics' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.percentage).toBe(100);
  });

  it('splits percentage evenly across equal-weight categories', () => {
    const items = [
      makeItem({ id: 'i1', weight: 500, weightUnit: 'g', category: 'Shelter' }),
      makeItem({ id: 'i2', weight: 500, weightUnit: 'g', category: 'Food' }),
    ];
    const result = computeCategorySummaries(makePack(items));
    for (const cat of result) {
      expect(cat.percentage).toBe(50);
    }
  });

  it('counts item rows (not total quantity) in each category', () => {
    const items = [
      makeItem({ id: 'i1', weight: 100, weightUnit: 'g', quantity: 5, category: 'Food' }),
      makeItem({ id: 'i2', weight: 200, weightUnit: 'g', quantity: 2, category: 'Food' }),
    ];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.items).toBe(2);
  });

  it('merges multiple items in the same category', () => {
    const items = [
      makeItem({ id: 'i1', weight: 300, weightUnit: 'g', category: 'Shelter' }),
      makeItem({ id: 'i2', weight: 200, weightUnit: 'g', category: 'Shelter' }),
    ];
    const result = computeCategorySummaries(makePack(items));
    expect(result).toHaveLength(1);
    expect(result[0]?.weight).toBe(500);
  });

  it('sets percentage to 0 when total weight is zero', () => {
    const items = [makeItem({ weight: 0, weightUnit: 'g', category: 'Empty' })];
    const result = computeCategorySummaries(makePack(items));
    expect(result[0]?.percentage).toBe(0);
  });
});
