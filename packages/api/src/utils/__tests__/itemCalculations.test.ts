import { describe, expect, it } from 'vitest';
import type { CatalogItem, PackItem } from '@packrat/api/types';
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
} from '../itemCalculations';

// Mock data
const mockPackItem: PackItem = {
  id: 'pack-1',
  packId: 'pack-123',
  itemId: 'item-1',
  name: 'Tent',
  weight: 2500,
  weightUnit: 'g',
  quantity: 2,
  notes: 'Lightweight camping tent',
  worn: false,
  consumable: false,
  ownerId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deleted: false,
};

const mockCatalogItem: CatalogItem = {
  id: 'catalog-1',
  name: 'Sleeping Bag',
  description: 'Warm sleeping bag',
  category: 'Shelter',
  sku: 'SB-001',
  weight: 1500,
  price: 199.99,
  seller: 'OutdoorGear',
  productUrl: 'https://example.com/sleeping-bag',
  imageUrl: 'https://example.com/images/sleeping-bag.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('itemCalculations', () => {
  // -------------------------------------------------------------------------
  // isPackItem
  // -------------------------------------------------------------------------
  describe('isPackItem', () => {
    it('returns true for pack item with packId', () => {
      expect(isPackItem(mockPackItem)).toBe(true);
    });

    it('returns false for catalog item without packId', () => {
      expect(isPackItem(mockCatalogItem)).toBe(false);
    });

    it('returns false for item with undefined packId', () => {
      const itemWithUndefinedPackId = { ...mockPackItem, packId: undefined };
      expect(isPackItem(itemWithUndefinedPackId)).toBe(false);
    });

    it('returns true for item with null packId but packId property exists', () => {
      const itemWithNullPackId = { ...mockPackItem, packId: null as any };
      // packId property exists (null is not undefined), so type guard passes
      expect(isPackItem(itemWithNullPackId)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getEffectiveWeight
  // -------------------------------------------------------------------------
  describe('getEffectiveWeight', () => {
    it('returns weight for pack item', () => {
      expect(getEffectiveWeight(mockPackItem)).toBe(2500);
    });

    it('returns weight for catalog item', () => {
      expect(getEffectiveWeight(mockCatalogItem)).toBe(1500);
    });

    it('returns 0 for catalog item without weight', () => {
      const itemWithoutWeight = { ...mockCatalogItem };
      delete (itemWithoutWeight as any).weight;
      expect(getEffectiveWeight(itemWithoutWeight)).toBe(0);
    });

    it('returns 0 for pack item with zero weight', () => {
      const zeroWeightItem = { ...mockPackItem, weight: 0 };
      expect(getEffectiveWeight(zeroWeightItem)).toBe(0);
    });

    it('handles fractional weights', () => {
      const fractionalItem = { ...mockPackItem, weight: 123.45 };
      expect(getEffectiveWeight(fractionalItem)).toBe(123.45);
    });
  });

  // -------------------------------------------------------------------------
  // getQuantity
  // -------------------------------------------------------------------------
  describe('getQuantity', () => {
    it('returns quantity for pack item', () => {
      expect(getQuantity(mockPackItem)).toBe(2);
    });

    it('returns 1 for catalog item', () => {
      expect(getQuantity(mockCatalogItem)).toBe(1);
    });

    it('returns correct quantity for pack item with quantity 1', () => {
      const singleItem = { ...mockPackItem, quantity: 1 };
      expect(getQuantity(singleItem)).toBe(1);
    });

    it('returns correct quantity for pack item with large quantity', () => {
      const multipleItems = { ...mockPackItem, quantity: 100 };
      expect(getQuantity(multipleItems)).toBe(100);
    });

    it('returns quantity 0 for pack item with zero quantity', () => {
      const zeroQty = { ...mockPackItem, quantity: 0 };
      expect(getQuantity(zeroQty)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getWeightUnit
  // -------------------------------------------------------------------------
  describe('getWeightUnit', () => {
    it('returns weightUnit for pack item', () => {
      expect(getWeightUnit(mockPackItem)).toBe('g');
    });

    it('returns "g" for catalog item', () => {
      expect(getWeightUnit(mockCatalogItem)).toBe('g');
    });

    it('returns kg for pack item with kg unit', () => {
      const kgItem = { ...mockPackItem, weightUnit: 'kg' as const };
      expect(getWeightUnit(kgItem)).toBe('kg');
    });

    it('returns lb for pack item with lb unit', () => {
      const lbItem = { ...mockPackItem, weightUnit: 'lb' as const };
      expect(getWeightUnit(lbItem)).toBe('lb');
    });

    it('returns oz for pack item with oz unit', () => {
      const ozItem = { ...mockPackItem, weightUnit: 'oz' as const };
      expect(getWeightUnit(ozItem)).toBe('oz');
    });
  });

  // -------------------------------------------------------------------------
  // getNotes
  // -------------------------------------------------------------------------
  describe('getNotes', () => {
    it('returns notes for pack item with notes', () => {
      expect(getNotes(mockPackItem)).toBe('Lightweight camping tent');
    });

    it('returns undefined for catalog item', () => {
      expect(getNotes(mockCatalogItem)).toBeUndefined();
    });

    it('returns undefined for pack item without notes', () => {
      const noNotesItem = { ...mockPackItem, notes: undefined };
      expect(getNotes(noNotesItem)).toBeUndefined();
    });

    it('returns empty string notes if present', () => {
      const emptyNotesItem = { ...mockPackItem, notes: '' };
      expect(getNotes(emptyNotesItem)).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // calculateTotalWeight
  // -------------------------------------------------------------------------
  describe('calculateTotalWeight', () => {
    it('calculates total weight for pack item', () => {
      expect(calculateTotalWeight(mockPackItem)).toBe(5000); // 2500 * 2
    });

    it('calculates total weight for catalog item', () => {
      expect(calculateTotalWeight(mockCatalogItem)).toBe(1500); // 1500 * 1
    });

    it('returns 0 for item with zero weight', () => {
      const zeroWeightItem = { ...mockPackItem, weight: 0 };
      expect(calculateTotalWeight(zeroWeightItem)).toBe(0);
    });

    it('returns 0 for item with zero quantity', () => {
      const zeroQtyItem = { ...mockPackItem, quantity: 0 };
      expect(calculateTotalWeight(zeroQtyItem)).toBe(0);
    });

    it('handles fractional results', () => {
      const fractionalItem = { ...mockPackItem, weight: 123.5, quantity: 3 };
      expect(calculateTotalWeight(fractionalItem)).toBe(370.5);
    });

    it('calculates correctly for large quantities', () => {
      const largeQtyItem = { ...mockPackItem, weight: 100, quantity: 1000 };
      expect(calculateTotalWeight(largeQtyItem)).toBe(100000);
    });
  });

  // -------------------------------------------------------------------------
  // isConsumable
  // -------------------------------------------------------------------------
  describe('isConsumable', () => {
    it('returns false for non-consumable pack item', () => {
      expect(isConsumable(mockPackItem)).toBe(false);
    });

    it('returns true for consumable pack item', () => {
      const consumableItem = { ...mockPackItem, consumable: true };
      expect(isConsumable(consumableItem)).toBe(true);
    });

    it('returns false for catalog item without consumable field', () => {
      expect(isConsumable(mockCatalogItem)).toBe(false);
    });

    it('returns false for item with consumable=false explicitly', () => {
      const nonConsumableItem = { ...mockPackItem, consumable: false };
      expect(isConsumable(nonConsumableItem)).toBe(false);
    });

    it('returns false for item without consumable property', () => {
      const noConsumableItem = { ...mockPackItem };
      delete (noConsumableItem as any).consumable;
      expect(isConsumable(noConsumableItem)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // shouldShowQuantity
  // -------------------------------------------------------------------------
  describe('shouldShowQuantity', () => {
    it('returns true for pack item with quantity', () => {
      expect(shouldShowQuantity(mockPackItem)).toBe(true);
    });

    it('returns false for catalog item', () => {
      expect(shouldShowQuantity(mockCatalogItem)).toBe(false);
    });

    it('returns true for pack item with quantity 0', () => {
      const zeroQtyItem = { ...mockPackItem, quantity: 0 };
      expect(shouldShowQuantity(zeroQtyItem)).toBe(true);
    });

    it('returns true for pack item with quantity 1', () => {
      const singleItem = { ...mockPackItem, quantity: 1 };
      expect(shouldShowQuantity(singleItem)).toBe(true);
    });

    it('returns false for pack item without quantity property', () => {
      const noQtyItem = { ...mockPackItem };
      delete (noQtyItem as any).quantity;
      expect(shouldShowQuantity(noQtyItem)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isWorn
  // -------------------------------------------------------------------------
  describe('isWorn', () => {
    it('returns false for non-worn pack item', () => {
      expect(isWorn(mockPackItem)).toBe(false);
    });

    it('returns true for worn pack item', () => {
      const wornItem = { ...mockPackItem, worn: true };
      expect(isWorn(wornItem)).toBe(true);
    });

    it('returns false for catalog item without worn field', () => {
      expect(isWorn(mockCatalogItem)).toBe(false);
    });

    it('returns false for item with worn=false explicitly', () => {
      const notWornItem = { ...mockPackItem, worn: false };
      expect(isWorn(notWornItem)).toBe(false);
    });

    it('returns false for item without worn property', () => {
      const noWornItem = { ...mockPackItem };
      delete (noWornItem as any).worn;
      expect(isWorn(noWornItem)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // hasNotes
  // -------------------------------------------------------------------------
  describe('hasNotes', () => {
    it('returns true for pack item with notes', () => {
      expect(hasNotes(mockPackItem)).toBe(true);
    });

    it('returns false for pack item without notes', () => {
      const noNotesItem = { ...mockPackItem, notes: undefined };
      expect(hasNotes(noNotesItem)).toBe(false);
    });

    it('returns false for catalog item without notes', () => {
      expect(hasNotes(mockCatalogItem)).toBe(false);
    });

    it('returns true for pack item with empty string notes', () => {
      const emptyNotesItem = { ...mockPackItem, notes: '' };
      expect(hasNotes(emptyNotesItem)).toBe(true); // notes exists but is empty
    });

    it('returns false for item without notes property', () => {
      const noNotesProperty = { ...mockPackItem };
      delete (noNotesProperty as any).notes;
      expect(hasNotes(noNotesProperty)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Integration scenarios
  // -------------------------------------------------------------------------
  describe('integration scenarios', () => {
    it('calculates correct values for consumable pack item', () => {
      const consumable = {
        ...mockPackItem,
        consumable: true,
        quantity: 5,
        weight: 100,
      };

      expect(isPackItem(consumable)).toBe(true);
      expect(isConsumable(consumable)).toBe(true);
      expect(getQuantity(consumable)).toBe(5);
      expect(calculateTotalWeight(consumable)).toBe(500);
    });

    it('handles worn item correctly', () => {
      const wornItem = {
        ...mockPackItem,
        worn: true,
        weight: 500,
        quantity: 1,
      };

      expect(isWorn(wornItem)).toBe(true);
      expect(isPackItem(wornItem)).toBe(true);
      expect(calculateTotalWeight(wornItem)).toBe(500);
    });

    it('handles catalog item with all defaults', () => {
      expect(isPackItem(mockCatalogItem)).toBe(false);
      expect(getQuantity(mockCatalogItem)).toBe(1);
      expect(getWeightUnit(mockCatalogItem)).toBe('g');
      expect(getNotes(mockCatalogItem)).toBeUndefined();
      expect(shouldShowQuantity(mockCatalogItem)).toBe(false);
    });

    it('handles minimal pack item', () => {
      const minimalItem: PackItem = {
        id: 'min-1',
        packId: 'pack-1',
        itemId: 'item-1',
        name: 'Minimal',
        weight: 0,
        weightUnit: 'g',
        quantity: 1,
        worn: false,
        consumable: false,
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false,
      };

      expect(isPackItem(minimalItem)).toBe(true);
      expect(calculateTotalWeight(minimalItem)).toBe(0);
      expect(hasNotes(minimalItem)).toBe(false);
    });
  });
});
