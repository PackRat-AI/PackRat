import type { CatalogItem, PackItem } from '@packrat/api/types';
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
} from '../itemCalculations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePackItem(overrides: Partial<PackItem> = {}): PackItem {
  return {
    id: 'pack-item-1',
    packId: 'pack-1',
    name: 'Test Pack Item',
    weight: 100,
    weightUnit: 'g',
    quantity: 1,
    consumable: false,
    worn: false,
    userId: 1,
    category: 'tools',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 1,
    name: 'Test Catalog Item',
    productUrl: 'https://example.com',
    sku: 'TEST-SKU',
    weight: 200,
    weightUnit: 'g',
    description: 'Test item',
    categories: ['camping'],
    images: [],
    brand: 'TestBrand',
    model: 'TestModel',
    ratingValue: 4.5,
    color: undefined,
    size: undefined,
    price: 99.99,
    availability: 'in_stock',
    seller: undefined,
    productSku: undefined,
    material: undefined,
    currency: 'USD',
    condition: undefined,
    reviewCount: 0,
    variants: undefined,
    techs: undefined,
    links: undefined,
    reviews: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('itemCalculations', () => {
  describe('isPackItem', () => {
    it('returns true for pack items', () => {
      const item = makePackItem();
      expect(isPackItem(item)).toBe(true);
    });

    it('returns false for catalog items', () => {
      const item = makeCatalogItem();
      expect(isPackItem(item)).toBe(false);
    });

    it('returns false for objects without packId', () => {
      const item = { name: 'Test', weight: 100 } as any;
      expect(isPackItem(item)).toBe(false);
    });
  });

  describe('getEffectiveWeight', () => {
    it('returns weight for pack items', () => {
      const item = makePackItem({ weight: 150 });
      expect(getEffectiveWeight(item)).toBe(150);
    });

    it('returns weight for catalog items', () => {
      const item = makeCatalogItem({ weight: 250 });
      expect(getEffectiveWeight(item)).toBe(250);
    });

    it('returns 0 for items without weight', () => {
      const item = { name: 'Test' } as any;
      expect(getEffectiveWeight(item)).toBe(0);
    });
  });

  describe('getQuantity', () => {
    it('returns quantity for pack items', () => {
      const item = makePackItem({ quantity: 3 });
      expect(getQuantity(item)).toBe(3);
    });

    it('returns 1 for catalog items', () => {
      const item = makeCatalogItem();
      expect(getQuantity(item)).toBe(1);
    });

    it('returns 1 for pack items with quantity 1', () => {
      const item = makePackItem({ quantity: 1 });
      expect(getQuantity(item)).toBe(1);
    });
  });

  describe('getWeightUnit', () => {
    it('returns weightUnit for pack items', () => {
      const item = makePackItem({ weightUnit: 'oz' });
      expect(getWeightUnit(item)).toBe('oz');
    });

    it('returns "g" for catalog items', () => {
      const item = makeCatalogItem();
      expect(getWeightUnit(item)).toBe('g');
    });

    it('returns correct unit for different pack item units', () => {
      expect(getWeightUnit(makePackItem({ weightUnit: 'kg' }))).toBe('kg');
      expect(getWeightUnit(makePackItem({ weightUnit: 'lb' }))).toBe('lb');
    });
  });

  describe('getNotes', () => {
    it('returns notes for pack items with notes', () => {
      const item = makePackItem({ notes: 'Important notes' });
      expect(getNotes(item)).toBe('Important notes');
    });

    it('returns undefined for pack items without notes', () => {
      const item = makePackItem();
      expect(getNotes(item)).toBeUndefined();
    });

    it('returns undefined for catalog items', () => {
      const item = makeCatalogItem();
      expect(getNotes(item)).toBeUndefined();
    });
  });

  describe('calculateTotalWeight', () => {
    it('calculates weight × quantity for pack items', () => {
      const item = makePackItem({ weight: 100, quantity: 3 });
      expect(calculateTotalWeight(item)).toBe(300);
    });

    it('returns weight for catalog items', () => {
      const item = makeCatalogItem({ weight: 200 });
      expect(calculateTotalWeight(item)).toBe(200);
    });

    it('handles quantity of 1 correctly', () => {
      const item = makePackItem({ weight: 150, quantity: 1 });
      expect(calculateTotalWeight(item)).toBe(150);
    });

    it('handles 0 quantity correctly', () => {
      const item = makePackItem({ weight: 100, quantity: 0 });
      expect(calculateTotalWeight(item)).toBe(0);
    });
  });

  describe('isConsumable', () => {
    it('returns true for consumable items', () => {
      const item = makePackItem({ consumable: true });
      expect(isConsumable(item)).toBe(true);
    });

    it('returns false for non-consumable items', () => {
      const item = makePackItem({ consumable: false });
      expect(isConsumable(item)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item = makeCatalogItem();
      expect(isConsumable(item)).toBe(false);
    });
  });

  describe('shouldShowQuantity', () => {
    it('returns true for pack items', () => {
      const item = makePackItem();
      expect(shouldShowQuantity(item)).toBe(true);
    });

    it('returns false for catalog items', () => {
      const item = makeCatalogItem();
      expect(shouldShowQuantity(item)).toBe(false);
    });
  });

  describe('isWorn', () => {
    it('returns true for worn items', () => {
      const item = makePackItem({ worn: true });
      expect(isWorn(item)).toBe(true);
    });

    it('returns false for non-worn items', () => {
      const item = makePackItem({ worn: false });
      expect(isWorn(item)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item = makeCatalogItem();
      expect(isWorn(item)).toBe(false);
    });
  });

  describe('hasNotes', () => {
    it('returns true for items with notes', () => {
      const item = makePackItem({ notes: 'Some notes' });
      expect(hasNotes(item)).toBe(true);
    });

    it('returns false for items without notes', () => {
      const item = makePackItem();
      expect(hasNotes(item)).toBe(false);
    });

    it('returns false for catalog items', () => {
      const item = makeCatalogItem();
      expect(hasNotes(item)).toBe(false);
    });

    it('returns false for items with empty notes', () => {
      const item = makePackItem({ notes: '' });
      expect(hasNotes(item)).toBe(false);
    });
  });
});
