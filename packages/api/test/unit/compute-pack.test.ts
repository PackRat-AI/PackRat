import { describe, expect, it } from 'vitest';
import { computePackWeights, computePacksWeights } from '../../src/utils/compute-pack';

// Mock schema and types since they reference Cloudflare types
const mockPackWithItems = {
  id: 1,
  name: 'Test Pack',
  userId: 1,
  description: null,
  isTemplate: false,
  visibility: 'private' as const,
  forkedFrom: null,
  category: null,
  location: null,
  tripType: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 1,
      packId: 1,
      name: 'Tent',
      quantity: 1,
      weight: 2.5,
      weightUnit: 'kg' as const,
      category: 'shelter',
      consumable: false,
      worn: false,
      description: null,
    },
    {
      id: 2,
      packId: 1,
      name: 'Water',
      quantity: 2,
      weight: 1000,
      weightUnit: 'g' as const,
      category: 'consumables',
      consumable: true,
      worn: false,
      description: null,
    },
    {
      id: 3,
      packId: 1,
      name: 'Jacket',
      quantity: 1,
      weight: 500,
      weightUnit: 'g' as const,
      category: 'clothing',
      consumable: false,
      worn: true,
      description: null,
    },
  ],
};

describe('computePackWeights', () => {
  it('should calculate weights in grams', () => {
    const result = computePackWeights(mockPackWithItems, 'g');

    // Tent: 2.5kg = 2500g
    // Water: 1000g * 2 = 2000g
    // Jacket: 500g (worn, not counted)
    // Base weight: 2500g (tent only, since water is consumable, jacket is worn)
    // Total weight: 2500g + 2000g + 500g = 5000g (worn items ARE counted in total)
    expect(result.baseWeight).toBe(2500);
    expect(result.totalWeight).toBe(5000);
  });

  it('should convert to ounces', () => {
    const result = computePackWeights(mockPackWithItems, 'oz');

    // Base: 2500g / 28.35 ≈ 88.18oz
    // Total: 5000g / 28.35 ≈ 176.37oz
    expect(result.baseWeight).toBeCloseTo(88.18, 1);
    expect(result.totalWeight).toBeCloseTo(176.37, 1);
  });

  it('should convert to pounds', () => {
    const result = computePackWeights(mockPackWithItems, 'lb');

    // Base: 2500g / 453.59 ≈ 5.51lb
    // Total: 5000g / 453.59 ≈ 11.02lb
    expect(result.baseWeight).toBeCloseTo(5.51, 1);
    expect(result.totalWeight).toBeCloseTo(11.02, 1);
  });

  it('should convert to kilograms', () => {
    const result = computePackWeights(mockPackWithItems, 'kg');

    // Base: 2500g / 1000 = 2.5kg
    // Total: 5000g / 1000 = 5kg
    expect(result.baseWeight).toBe(2.5);
    expect(result.totalWeight).toBe(5);
  });

  it('should throw error for pack without items', () => {
    const packWithoutItems = { ...mockPackWithItems, items: null };
    expect(() => computePackWeights(packWithoutItems as typeof mockPackWithItems)).toThrow(
      'Pack with ID 1 has no items',
    );
  });

  it('should handle empty items array', () => {
    const packWithEmptyItems = { ...mockPackWithItems, items: [] };
    const result = computePackWeights(packWithEmptyItems as typeof mockPackWithItems);
    expect(result.baseWeight).toBe(0);
    expect(result.totalWeight).toBe(0);
  });
});

describe('computePacksWeights', () => {
  it('should compute weights for multiple packs', () => {
    const packs = [mockPackWithItems, { ...mockPackWithItems, id: 2, name: 'Second Pack' }];
    const results = computePacksWeights(packs, 'g');

    expect(results).toHaveLength(2);
    expect(results[0].baseWeight).toBe(2500);
    expect(results[1].baseWeight).toBe(2500);
    expect(results[0].totalWeight).toBe(5000);
    expect(results[1].totalWeight).toBe(5000);
  });

  it('should return empty array for empty packs list', () => {
    const results = computePacksWeights([], 'g');
    expect(results).toEqual([]);
  });
});
