import { describe, expect, it, vi } from 'vitest';
import type { PackTemplate, PackTemplateItem } from '../../types';

// The SUT imports convertFromGrams/convertToGrams from the packs/utils barrel,
// which also re-exports uploadImage (expo-file-system) and computeCategories
// (expo-app/features/auth/store). Replace the barrel with the real pure
// conversion helpers so the test stays in a Node environment.
vi.mock('expo-app/features/packs/utils', async () => {
  const fromGrams = await import('expo-app/features/packs/utils/convertFromGrams');
  const toGrams = await import('expo-app/features/packs/utils/convertToGrams');
  return {
    convertFromGrams: fromGrams.convertFromGrams,
    convertToGrams: toGrams.convertToGrams,
  };
});

import { computePackTemplateWeights } from '../computePacktemplateWeight';

type TemplateInput = Omit<PackTemplate, 'baseWeight' | 'totalWeight'>;

function makeItem(overrides: Partial<PackTemplateItem> = {}): PackTemplateItem {
  return {
    id: 'item-1',
    packTemplateId: 'tpl-1',
    name: 'Item',
    weight: 100,
    weightUnit: 'g',
    quantity: 1,
    category: 'gear',
    consumable: false,
    worn: false,
    deleted: false,
    ...overrides,
  };
}

function makeTemplate(items: PackTemplateItem[]): TemplateInput {
  return {
    id: 'tpl-1',
    name: 'Template',
    category: 'hiking',
    isAppTemplate: false,
    items,
    deleted: false,
    localCreatedAt: '2024-01-01T00:00:00.000Z',
    localUpdatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('computePackTemplateWeights', () => {
  // ---------------------------------------------------------------------------
  // Empty templates
  // ---------------------------------------------------------------------------
  describe('with no items', () => {
    it('returns 0 for base and total weight (default unit: grams)', () => {
      const result = computePackTemplateWeights(makeTemplate([]));
      expect(result.baseWeight).toBe(0);
      expect(result.totalWeight).toBe(0);
    });

    it('returns 0 regardless of preferred unit', () => {
      const result = computePackTemplateWeights(makeTemplate([]), 'kg');
      expect(result.baseWeight).toBe(0);
      expect(result.totalWeight).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-consumable / non-worn gear (counts toward base and total)
  // ---------------------------------------------------------------------------
  describe('with base gear only', () => {
    it('sums weights into base and total in grams by default', () => {
      const result = computePackTemplateWeights(
        makeTemplate([
          makeItem({ id: 'a', weight: 500, weightUnit: 'g', quantity: 1 }),
          makeItem({ id: 'b', weight: 1, weightUnit: 'kg', quantity: 2 }),
        ]),
      );
      // 500g + 2 * 1000g = 2500g
      expect(result.baseWeight).toBe(2500);
      expect(result.totalWeight).toBe(2500);
    });

    it('converts to the preferred unit (kg)', () => {
      const result = computePackTemplateWeights(
        makeTemplate([makeItem({ weight: 2500, weightUnit: 'g', quantity: 1 })]),
        'kg',
      );
      // 2500g => 2.5kg, rounded to 2 decimals
      expect(result.baseWeight).toBe(2.5);
      expect(result.totalWeight).toBe(2.5);
    });
  });

  // ---------------------------------------------------------------------------
  // Consumable items (counted in total, not base)
  // ---------------------------------------------------------------------------
  describe('with consumable items', () => {
    it('excludes consumables from base but includes them in total', () => {
      const result = computePackTemplateWeights(
        makeTemplate([
          makeItem({ id: 'a', weight: 1000, weightUnit: 'g', consumable: false }),
          makeItem({ id: 'b', weight: 500, weightUnit: 'g', consumable: true }),
        ]),
      );
      expect(result.baseWeight).toBe(1000);
      expect(result.totalWeight).toBe(1500);
    });
  });

  // ---------------------------------------------------------------------------
  // Worn items (counted in total, not base)
  // ---------------------------------------------------------------------------
  describe('with worn items', () => {
    it('excludes worn items from base but includes them in total', () => {
      const result = computePackTemplateWeights(
        makeTemplate([
          makeItem({ id: 'a', weight: 800, weightUnit: 'g', worn: false }),
          makeItem({ id: 'b', weight: 200, weightUnit: 'g', worn: true }),
        ]),
      );
      expect(result.baseWeight).toBe(800);
      expect(result.totalWeight).toBe(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // Quantity multiplies the item weight
  // ---------------------------------------------------------------------------
  describe('quantity handling', () => {
    it('multiplies item weight by quantity', () => {
      const result = computePackTemplateWeights(
        makeTemplate([makeItem({ weight: 250, weightUnit: 'g', quantity: 4 })]),
      );
      expect(result.totalWeight).toBe(1000);
      expect(result.baseWeight).toBe(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // Preserves template metadata
  // ---------------------------------------------------------------------------
  it('returns the same template metadata alongside computed weights', () => {
    const template = makeTemplate([makeItem({ weight: 100, weightUnit: 'g', quantity: 1 })]);
    const result = computePackTemplateWeights(template);
    expect(result.id).toBe(template.id);
    expect(result.name).toBe(template.name);
    expect(result.items).toHaveLength(1);
  });
});
