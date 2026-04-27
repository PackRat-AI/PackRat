import { describe, expect, it } from 'vitest';
import type { Pack, PackItem } from '../../types';
import { computePackWeights } from '../computePackWeights';

describe('computePackWeights', () => {
  describe('basic weight calculations', () => {
    it('should calculate total weight from items', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item 1',
            weight: 100,
            weightUnit: 'g',
            quantity: 2,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Item 2',
            weight: 50,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(250); // (100 * 2) + (50 * 1)
      expect(result.baseWeight).toBe(250);
    });

    it('should calculate with different weight units', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item 1',
            weight: 1,
            weightUnit: 'kg',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(1000); // 1 kg = 1000 g
      expect(result.baseWeight).toBe(1000);
    });
  });

  describe('consumable items', () => {
    it('should exclude consumable items from base weight', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Tent',
            weight: 1000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Food',
            weight: 500,
            weightUnit: 'g',
            quantity: 1,
            consumable: true,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(1500); // 1000 + 500
      expect(result.baseWeight).toBe(1000); // only tent (food is consumable)
    });

    it('should handle multiple consumable items', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Backpack',
            weight: 2000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Food',
            weight: 500,
            weightUnit: 'g',
            quantity: 2,
            consumable: true,
            worn: false,
          } as PackItem,
          {
            id: '3',
            name: 'Water',
            weight: 1000,
            weightUnit: 'g',
            quantity: 1,
            consumable: true,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(4000); // 2000 + (500 * 2) + 1000
      expect(result.baseWeight).toBe(2000); // only backpack
    });
  });

  describe('worn items', () => {
    it('should exclude worn items from base weight', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Tent',
            weight: 1000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Jacket',
            weight: 300,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(1300); // 1000 + 300
      expect(result.baseWeight).toBe(1000); // only tent (jacket is worn)
    });

    it('should handle multiple worn items', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Backpack',
            weight: 2000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Jacket',
            weight: 300,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
          {
            id: '3',
            name: 'Boots',
            weight: 800,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(3100); // 2000 + 300 + 800
      expect(result.baseWeight).toBe(2000); // only backpack
    });
  });

  describe('combined consumable and worn', () => {
    it('should exclude both consumable and worn items from base weight', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Tent',
            weight: 1000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Food',
            weight: 500,
            weightUnit: 'g',
            quantity: 1,
            consumable: true,
            worn: false,
          } as PackItem,
          {
            id: '3',
            name: 'Jacket',
            weight: 300,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(1800); // 1000 + 500 + 300
      expect(result.baseWeight).toBe(1000); // only tent
    });
  });

  describe('preferred unit conversion', () => {
    it('should convert to grams by default', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 1,
            weightUnit: 'kg',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(1000);
    });

    it('should convert to oz when specified', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 283.5,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack, 'oz');

      expect(result.totalWeight).toBeCloseTo(10, 1);
    });

    it('should convert to kg when specified', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 2000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack, 'kg');

      expect(result.totalWeight).toBe(2);
    });

    it('should convert to lb when specified', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 453.59,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack, 'lb');

      expect(result.totalWeight).toBeCloseTo(1, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty items array', () => {
      const pack = {
        id: '1',
        name: 'Empty Pack',
        items: [] as PackItem[],
      } as unknown as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(0);
      expect(result.baseWeight).toBe(0);
    });

    it('should handle zero weight items', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 0,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(0);
      expect(result.baseWeight).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        items: [
          {
            id: '1',
            name: 'Item',
            weight: 100.123456,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.totalWeight).toBe(100.12);
      expect(result.baseWeight).toBe(100.12);
    });

    it('should preserve original pack properties', () => {
      const pack = {
        id: '1',
        name: 'Test Pack',
        description: 'A test pack',
        items: [] as PackItem[],
      } as unknown as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack);

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Pack');
      expect((result as any).description).toBe('A test pack');
    });
  });

  describe('real-world examples', () => {
    it('should calculate realistic backpacking pack weights', () => {
      const pack = {
        id: '1',
        name: 'Weekend Backpacking Pack',
        items: [
          {
            id: '1',
            name: 'Tent',
            weight: 1.5,
            weightUnit: 'kg',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '2',
            name: 'Sleeping Bag',
            weight: 1,
            weightUnit: 'kg',
            quantity: 1,
            consumable: false,
            worn: false,
          } as PackItem,
          {
            id: '3',
            name: 'Food',
            weight: 800,
            weightUnit: 'g',
            quantity: 3,
            consumable: true,
            worn: false,
          } as PackItem,
          {
            id: '4',
            name: 'Jacket',
            weight: 500,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
          {
            id: '5',
            name: 'Boots',
            weight: 1,
            weightUnit: 'kg',
            quantity: 1,
            consumable: false,
            worn: true,
          } as PackItem,
        ],
      } as Omit<Pack, 'baseWeight' | 'totalWeight'>;

      const result = computePackWeights(pack, 'kg');

      expect(result.totalWeight).toBe(6.4); // 1.5 + 1 + 2.4 + 0.5 + 1
      expect(result.baseWeight).toBe(2.5); // 1.5 + 1 (tent + sleeping bag only)
    });
  });
});
