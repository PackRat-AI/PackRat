import { describe, expect, it } from 'vitest';
import {
  calculateTotalWeight,
  getEffectiveWeight,
  getNotes,
  getQuantity,
  getWeightUnit,
  hasNotes,
  isCatalogItem,
  isConsumable,
  isWorn,
  shouldShowQuantity,
} from '../itemCalculations';

// Mock types for testing
type TestCatalogItem = {
  usageCount: number;
  weight?: number;
  weightUnit?: string;
};

type TestPackItem = {
  weight: number;
  weightUnit: 'g' | 'oz' | 'kg' | 'lb';
  quantity: number;
  notes?: string;
  consumable: boolean;
  worn: boolean;
};

describe('itemCalculations', () => {
  // -------------------------------------------------------------------------
  // isCatalogItem
  // -------------------------------------------------------------------------
  describe('isCatalogItem', () => {
    it('returns true for catalog items', () => {
      const catalogItem: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(isCatalogItem(catalogItem as any)).toBe(true);
    });

    it('returns false for pack items', () => {
      const packItem: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(isCatalogItem(packItem as any)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getEffectiveWeight
  // -------------------------------------------------------------------------
  describe('getEffectiveWeight', () => {
    it('returns weight for catalog item with weight defined', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 250 };
      expect(getEffectiveWeight(item as any)).toBe(250);
    });

    it('returns 0 for catalog item with no weight', () => {
      const item: TestCatalogItem = { usageCount: 5 };
      expect(getEffectiveWeight(item as any)).toBe(0);
    });

    it('returns weight for pack item', () => {
      const item: TestPackItem = {
        weight: 500,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(getEffectiveWeight(item as any)).toBe(500);
    });

    it('handles zero weight', () => {
      const item: TestPackItem = {
        weight: 0,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(getEffectiveWeight(item as any)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getQuantity
  // -------------------------------------------------------------------------
  describe('getQuantity', () => {
    it('returns 1 for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 10, weight: 100 };
      expect(getQuantity(item as any)).toBe(1);
    });

    it('returns actual quantity for pack items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 5,
        consumable: false,
        worn: false,
      };
      expect(getQuantity(item as any)).toBe(5);
    });

    it('handles zero quantity', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 0,
        consumable: false,
        worn: false,
      };
      expect(getQuantity(item as any)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getWeightUnit
  // -------------------------------------------------------------------------
  describe('getWeightUnit', () => {
    it('returns weight unit for pack item', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'oz',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(getWeightUnit(item as any)).toBe('oz');
    });

    it('returns weight unit for catalog item with valid unit', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100, weightUnit: 'kg' };
      expect(getWeightUnit(item as any)).toBe('kg');
    });

    it('returns default "g" for catalog item with no unit', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(getWeightUnit(item as any)).toBe('g');
    });

    it('returns default "g" for catalog item with invalid unit', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100, weightUnit: 'invalid' };
      expect(getWeightUnit(item as any)).toBe('g');
    });

    it('handles all valid weight units', () => {
      const units: Array<'g' | 'oz' | 'kg' | 'lb'> = ['g', 'oz', 'kg', 'lb'];
      for (const unit of units) {
        const item: TestPackItem = {
          weight: 100,
          weightUnit: unit,
          quantity: 1,
          consumable: false,
          worn: false,
        };
        expect(getWeightUnit(item as any)).toBe(unit);
      }
    });
  });

  // -------------------------------------------------------------------------
  // getNotes
  // -------------------------------------------------------------------------
  describe('getNotes', () => {
    it('returns undefined for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(getNotes(item as any)).toBeUndefined();
    });

    it('returns notes for pack items with notes', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        notes: 'Important item',
        consumable: false,
        worn: false,
      };
      expect(getNotes(item as any)).toBe('Important item');
    });

    it('returns undefined for pack items without notes', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(getNotes(item as any)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // calculateTotalWeight
  // -------------------------------------------------------------------------
  describe('calculateTotalWeight', () => {
    it('calculates total weight for pack item', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 3,
        consumable: false,
        worn: false,
      };
      expect(calculateTotalWeight(item as any)).toBe(300);
    });

    it('calculates total weight for catalog item (quantity = 1)', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 250 };
      expect(calculateTotalWeight(item as any)).toBe(250);
    });

    it('handles zero weight', () => {
      const item: TestPackItem = {
        weight: 0,
        weightUnit: 'g',
        quantity: 5,
        consumable: false,
        worn: false,
      };
      expect(calculateTotalWeight(item as any)).toBe(0);
    });

    it('handles zero quantity', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 0,
        consumable: false,
        worn: false,
      };
      expect(calculateTotalWeight(item as any)).toBe(0);
    });

    it('calculates correct total for large quantities', () => {
      const item: TestPackItem = {
        weight: 50,
        weightUnit: 'g',
        quantity: 100,
        consumable: false,
        worn: false,
      };
      expect(calculateTotalWeight(item as any)).toBe(5000);
    });
  });

  // -------------------------------------------------------------------------
  // isConsumable
  // -------------------------------------------------------------------------
  describe('isConsumable', () => {
    it('returns true for consumable items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: true,
        worn: false,
      };
      expect(isConsumable(item as any)).toBe(true);
    });

    it('returns false for non-consumable items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(isConsumable(item as any)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(isConsumable(item as any)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // shouldShowQuantity
  // -------------------------------------------------------------------------
  describe('shouldShowQuantity', () => {
    it('returns false for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(shouldShowQuantity(item as any)).toBe(false);
    });

    it('returns true for pack items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(shouldShowQuantity(item as any)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isWorn
  // -------------------------------------------------------------------------
  describe('isWorn', () => {
    it('returns true for worn items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: true,
      };
      expect(isWorn(item as any)).toBe(true);
    });

    it('returns false for non-worn items', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(isWorn(item as any)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(isWorn(item as any)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // hasNotes
  // -------------------------------------------------------------------------
  describe('hasNotes', () => {
    it('returns true for items with notes', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        notes: 'Test note',
        consumable: false,
        worn: false,
      };
      expect(hasNotes(item as any)).toBe(true);
    });

    it('returns false for items without notes', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      };
      expect(hasNotes(item as any)).toBe(false);
    });

    it('returns false for items with empty notes', () => {
      const item: TestPackItem = {
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        notes: '',
        consumable: false,
        worn: false,
      };
      expect(hasNotes(item as any)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item: TestCatalogItem = { usageCount: 5, weight: 100 };
      expect(hasNotes(item as any)).toBe(false);
    });
  });
});
