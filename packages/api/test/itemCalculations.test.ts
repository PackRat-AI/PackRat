import { describe, expect, it } from 'vitest';
import {
  calculateTotalWeight,
  getEffectiveWeight,
  getNotes,
  getQuantity,
  getWeightUnit,
  hasNotes,
  isConsumable,
  isPackItem,
  isWorn,
  shouldShowQuantity,
} from '../src/utils/itemCalculations';
import type { CatalogItem, PackItem } from '../src/types';

describe('itemCalculations utilities', () => {
  describe('isPackItem', () => {
    it('should identify pack items', () => {
      const packItem: PackItem = {
        id: 'pi_123',
        packId: 'p_456',
        name: 'Test Item',
        weight: 100,
        weightUnit: 'g',
        quantity: 1,
        category: 'Gear',
        userId: 1,
        consumable: false,
        worn: false,
        deleted: false,
        localCreatedAt: new Date(),
        localUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        image: null,
        notes: null,
        catalogItemId: null,
      };

      expect(isPackItem(packItem)).toBe(true);
    });

    it('should identify catalog items as not pack items', () => {
      const catalogItem: Partial<CatalogItem> = {
        id: 1,
        name: 'Test Catalog Item',
        weight: 100,
        // no packId
      };

      expect(isPackItem(catalogItem as CatalogItem)).toBe(false);
    });
  });

  describe('getEffectiveWeight', () => {
    it('should get weight from pack item', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        weight: 500,
      };

      expect(getEffectiveWeight(packItem as PackItem)).toBe(500);
    });

    it('should get weight from catalog item', () => {
      const catalogItem: Partial<CatalogItem> = {
        weight: 300,
      };

      expect(getEffectiveWeight(catalogItem as CatalogItem)).toBe(300);
    });

    it('should return 0 for items without weight', () => {
      const item = {} as CatalogItem;

      expect(getEffectiveWeight(item)).toBe(0);
    });
  });

  describe('getQuantity', () => {
    it('should get quantity from pack item', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        quantity: 3,
      };

      expect(getQuantity(packItem as PackItem)).toBe(3);
    });

    it('should return 1 for catalog items', () => {
      const catalogItem = {} as CatalogItem;

      expect(getQuantity(catalogItem)).toBe(1);
    });
  });

  describe('getWeightUnit', () => {
    it('should get weight unit from pack item', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        weightUnit: 'kg',
      };

      expect(getWeightUnit(packItem as PackItem)).toBe('kg');
    });

    it('should return g for catalog items', () => {
      const catalogItem = {} as CatalogItem;

      expect(getWeightUnit(catalogItem)).toBe('g');
    });
  });

  describe('getNotes', () => {
    it('should get notes from pack item', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        notes: 'Important notes',
      };

      expect(getNotes(packItem as PackItem)).toBe('Important notes');
    });

    it('should return undefined for catalog items', () => {
      const catalogItem = {} as CatalogItem;

      expect(getNotes(catalogItem)).toBeUndefined();
    });

    it('should return null if notes is null', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        notes: null,
      };

      expect(getNotes(packItem as PackItem)).toBeNull();
    });
  });

  describe('calculateTotalWeight', () => {
    it('should calculate total weight for pack item', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        weight: 200,
        quantity: 3,
      };

      expect(calculateTotalWeight(packItem as PackItem)).toBe(600);
    });

    it('should calculate total weight for catalog item', () => {
      const catalogItem: Partial<CatalogItem> = {
        weight: 150,
      };

      // Catalog items have implicit quantity of 1
      expect(calculateTotalWeight(catalogItem as CatalogItem)).toBe(150);
    });

    it('should handle zero weight', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        weight: 0,
        quantity: 5,
      };

      expect(calculateTotalWeight(packItem as PackItem)).toBe(0);
    });

    it('should handle fractional weights', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        weight: 25.5,
        quantity: 4,
      };

      expect(calculateTotalWeight(packItem as PackItem)).toBe(102);
    });
  });

  describe('isConsumable', () => {
    it('should identify consumable items', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        consumable: true,
      };

      expect(isConsumable(item as PackItem)).toBe(true);
    });

    it('should identify non-consumable items', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        consumable: false,
      };

      expect(isConsumable(item as PackItem)).toBe(false);
    });

    it('should return false for items without consumable property', () => {
      const item = {} as CatalogItem;

      expect(isConsumable(item)).toBe(false);
    });
  });

  describe('shouldShowQuantity', () => {
    it('should return true for pack items with quantity', () => {
      const packItem: Partial<PackItem> = {
        packId: 'p_123',
        quantity: 2,
      };

      expect(shouldShowQuantity(packItem as PackItem)).toBe(true);
    });

    it('should return false for catalog items', () => {
      const catalogItem = {} as CatalogItem;

      expect(shouldShowQuantity(catalogItem)).toBe(false);
    });
  });

  describe('isWorn', () => {
    it('should identify worn items', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        worn: true,
      };

      expect(isWorn(item as PackItem)).toBe(true);
    });

    it('should identify non-worn items', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        worn: false,
      };

      expect(isWorn(item as PackItem)).toBe(false);
    });

    it('should return false for items without worn property', () => {
      const item = {} as CatalogItem;

      expect(isWorn(item)).toBe(false);
    });
  });

  describe('hasNotes', () => {
    it('should return true for items with notes', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        notes: 'Some notes',
      };

      expect(hasNotes(item as PackItem)).toBe(true);
    });

    it('should return true for items with empty notes', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        notes: '',
      };

      expect(hasNotes(item as PackItem)).toBe(true);
    });

    it('should return false for items with null notes', () => {
      const item: Partial<PackItem> = {
        packId: 'p_123',
        notes: null,
      };

      // hasNotes checks for undefined, so null notes should return true
      expect(hasNotes(item as PackItem)).toBe(true);
    });

    it('should return false for items without notes property', () => {
      const item = {} as CatalogItem;

      expect(hasNotes(item)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle items with all properties', () => {
      const fullItem: PackItem = {
        id: 'pi_123',
        packId: 'p_456',
        name: 'Complete Item',
        weight: 250,
        weightUnit: 'g',
        quantity: 2,
        category: 'Gear',
        userId: 1,
        consumable: true,
        worn: true,
        deleted: false,
        localCreatedAt: new Date(),
        localUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        description: 'Full description',
        image: 'https://example.com/image.jpg',
        notes: 'Important notes',
        catalogItemId: 123,
      };

      expect(isPackItem(fullItem)).toBe(true);
      expect(getEffectiveWeight(fullItem)).toBe(250);
      expect(getQuantity(fullItem)).toBe(2);
      expect(getWeightUnit(fullItem)).toBe('g');
      expect(getNotes(fullItem)).toBe('Important notes');
      expect(calculateTotalWeight(fullItem)).toBe(500);
      expect(isConsumable(fullItem)).toBe(true);
      expect(shouldShowQuantity(fullItem)).toBe(true);
      expect(isWorn(fullItem)).toBe(true);
      expect(hasNotes(fullItem)).toBe(true);
    });

    it('should handle items with minimum properties', () => {
      const minItem: Partial<PackItem> = {
        packId: 'p_123',
        weight: 100,
        quantity: 1,
        weightUnit: 'g',
      };

      expect(isPackItem(minItem as PackItem)).toBe(true);
      expect(getEffectiveWeight(minItem as PackItem)).toBe(100);
      expect(getQuantity(minItem as PackItem)).toBe(1);
      expect(getWeightUnit(minItem as PackItem)).toBe('g');
      expect(calculateTotalWeight(minItem as PackItem)).toBe(100);
    });
  });
});
