import { describe, expect, it } from 'vitest';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackTemplateItem } from 'expo-app/features/pack-templates';
import type { PackItem } from 'expo-app/features/packs';
import {
  isCatalogItem,
  getEffectiveWeight,
  getQuantity,
  getWeightUnit,
  getNotes,
  calculateTotalWeight,
  isConsumable,
  shouldShowQuantity,
  isWorn,
  hasNotes,
} from '../itemCalculations';

describe('itemCalculations', () => {
  describe('isCatalogItem', () => {
    it('should return true for catalog items with usageCount', () => {
      const catalogItem = {
        usageCount: 5,
        weight: 100,
        weightUnit: 'g',
      } as CatalogItem;

      expect(isCatalogItem(catalogItem)).toBe(true);
    });

    it('should return false for pack items without usageCount', () => {
      const packItem = {
        weight: 100,
        quantity: 2,
        weightUnit: 'g',
      } as PackItem;

      expect(isCatalogItem(packItem)).toBe(false);
    });

    it('should return false for pack template items', () => {
      const templateItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
      } as PackTemplateItem;

      expect(isCatalogItem(templateItem)).toBe(false);
    });
  });

  describe('getEffectiveWeight', () => {
    it('should return weight from catalog item', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 150,
      } as CatalogItem;

      expect(getEffectiveWeight(catalogItem)).toBe(150);
    });

    it('should return 0 for catalog item with null weight', () => {
      const catalogItem = {
        usageCount: 1,
        weight: null,
      } as CatalogItem;

      expect(getEffectiveWeight(catalogItem)).toBe(0);
    });

    it('should return weight from pack item', () => {
      const packItem = {
        weight: 200,
        quantity: 1,
        weightUnit: 'g',
      } as PackItem;

      expect(getEffectiveWeight(packItem)).toBe(200);
    });

    it('should return weight from pack template item', () => {
      const templateItem = {
        weight: 250,
        quantity: 1,
        weightUnit: 'g',
      } as PackTemplateItem;

      expect(getEffectiveWeight(templateItem)).toBe(250);
    });
  });

  describe('getQuantity', () => {
    it('should return 1 for catalog items', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(getQuantity(catalogItem)).toBe(1);
    });

    it('should return actual quantity for pack items', () => {
      const packItem = {
        weight: 100,
        quantity: 3,
        weightUnit: 'g',
      } as PackItem;

      expect(getQuantity(packItem)).toBe(3);
    });

    it('should return actual quantity for pack template items', () => {
      const templateItem = {
        weight: 100,
        quantity: 5,
        weightUnit: 'g',
      } as PackTemplateItem;

      expect(getQuantity(templateItem)).toBe(5);
    });
  });

  describe('getWeightUnit', () => {
    it('should return weight unit from catalog item', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
        weightUnit: 'oz',
      } as CatalogItem;

      expect(getWeightUnit(catalogItem)).toBe('oz');
    });

    it('should return default "g" for catalog item with null weightUnit', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
        weightUnit: null,
      } as CatalogItem;

      expect(getWeightUnit(catalogItem)).toBe('g');
    });

    it('should return default "g" for catalog item with invalid weightUnit', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
        weightUnit: 'invalid',
      } as CatalogItem;

      expect(getWeightUnit(catalogItem)).toBe('g');
    });

    it('should return weight unit from pack item', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'kg',
      } as PackItem;

      expect(getWeightUnit(packItem)).toBe('kg');
    });

    it('should handle all valid weight units', () => {
      const units = ['g', 'oz', 'kg', 'lb'] as const;

      for (const unit of units) {
        const item = {
          weight: 100,
          quantity: 1,
          weightUnit: unit,
        } as PackItem;

        expect(getWeightUnit(item)).toBe(unit);
      }
    });
  });

  describe('getNotes', () => {
    it('should return undefined for catalog items', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(getNotes(catalogItem)).toBeUndefined();
    });

    it('should return notes from pack item', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        notes: 'Important item',
      } as PackItem;

      expect(getNotes(packItem)).toBe('Important item');
    });

    it('should return undefined for pack item without notes', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
      } as PackItem;

      expect(getNotes(packItem)).toBeUndefined();
    });
  });

  describe('calculateTotalWeight', () => {
    it('should calculate total weight for catalog item (weight × 1)', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(calculateTotalWeight(catalogItem)).toBe(100);
    });

    it('should calculate total weight for pack item (weight × quantity)', () => {
      const packItem = {
        weight: 50,
        quantity: 3,
        weightUnit: 'g',
      } as PackItem;

      expect(calculateTotalWeight(packItem)).toBe(150);
    });

    it('should handle zero weight', () => {
      const packItem = {
        weight: 0,
        quantity: 5,
        weightUnit: 'g',
      } as PackItem;

      expect(calculateTotalWeight(packItem)).toBe(0);
    });

    it('should handle zero quantity', () => {
      const packItem = {
        weight: 100,
        quantity: 0,
        weightUnit: 'g',
      } as PackItem;

      expect(calculateTotalWeight(packItem)).toBe(0);
    });

    it('should handle null weight in catalog item', () => {
      const catalogItem = {
        usageCount: 1,
        weight: null,
      } as CatalogItem;

      expect(calculateTotalWeight(catalogItem)).toBe(0);
    });
  });

  describe('isConsumable', () => {
    it('should return true for consumable pack items', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        consumable: true,
      } as PackItem;

      expect(isConsumable(packItem)).toBe(true);
    });

    it('should return false for non-consumable pack items', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        consumable: false,
      } as PackItem;

      expect(isConsumable(packItem)).toBe(false);
    });

    it('should return false for items without consumable property', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(isConsumable(catalogItem)).toBe(false);
    });
  });

  describe('shouldShowQuantity', () => {
    it('should return true for pack items with quantity', () => {
      const packItem = {
        weight: 100,
        quantity: 3,
        weightUnit: 'g',
      } as PackItem;

      expect(shouldShowQuantity(packItem)).toBe(true);
    });

    it('should return false for catalog items', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(shouldShowQuantity(catalogItem)).toBe(false);
    });
  });

  describe('isWorn', () => {
    it('should return true for worn pack items', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        worn: true,
      } as PackItem;

      expect(isWorn(packItem)).toBe(true);
    });

    it('should return false for non-worn pack items', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        worn: false,
      } as PackItem;

      expect(isWorn(packItem)).toBe(false);
    });

    it('should return false for items without worn property', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(isWorn(catalogItem)).toBe(false);
    });
  });

  describe('hasNotes', () => {
    it('should return true for items with non-empty notes', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        notes: 'Some notes',
      } as PackItem;

      expect(hasNotes(packItem)).toBe(true);
    });

    it('should return false for items with empty notes', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        notes: '',
      } as PackItem;

      expect(hasNotes(packItem)).toBe(false);
    });

    it('should return false for items without notes property', () => {
      const catalogItem = {
        usageCount: 1,
        weight: 100,
      } as CatalogItem;

      expect(hasNotes(catalogItem)).toBe(false);
    });

    it('should return false for items with null notes', () => {
      const packItem = {
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
        notes: null,
      } as PackItem;

      expect(hasNotes(packItem)).toBe(false);
    });
  });
});
