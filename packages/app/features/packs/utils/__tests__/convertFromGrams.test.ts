import { describe, expect, it } from 'vitest';
import { convertFromGrams } from '../convertFromGrams';

describe('convertFromGrams', () => {
  // -------------------------------------------------------------------------
  // Metric conversions
  // -------------------------------------------------------------------------
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertFromGrams(100, 'g')).toBe(100);
      expect(convertFromGrams(0, 'g')).toBe(0);
      expect(convertFromGrams(1, 'g')).toBe(1);
    });

    it('converts grams to kilograms correctly', () => {
      expect(convertFromGrams(1000, 'kg')).toBe(1);
      expect(convertFromGrams(2500, 'kg')).toBe(2.5);
      expect(convertFromGrams(100, 'kg')).toBe(0.1);
      expect(convertFromGrams(500, 'kg')).toBe(0.5);
    });
  });

  // -------------------------------------------------------------------------
  // Imperial conversions
  // -------------------------------------------------------------------------
  describe('imperial conversions', () => {
    it('converts grams to ounces correctly', () => {
      expect(convertFromGrams(28.35, 'oz')).toBeCloseTo(1, 2);
      expect(convertFromGrams(56.7, 'oz')).toBeCloseTo(2, 1);
      expect(convertFromGrams(14.175, 'oz')).toBeCloseTo(0.5, 2);
    });

    it('converts grams to pounds correctly', () => {
      expect(convertFromGrams(453.59, 'lb')).toBeCloseTo(1, 2);
      expect(convertFromGrams(907.18, 'lb')).toBeCloseTo(2, 2);
      expect(convertFromGrams(226.795, 'lb')).toBeCloseTo(0.5, 2);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertFromGrams(0, 'kg')).toBe(0);
      expect(convertFromGrams(0, 'oz')).toBe(0);
      expect(convertFromGrams(0, 'lb')).toBe(0);
      expect(convertFromGrams(0, 'g')).toBe(0);
    });

    it('handles very small weights', () => {
      expect(convertFromGrams(1, 'kg')).toBe(0.001);
      expect(convertFromGrams(1, 'oz')).toBeCloseTo(0.0353, 4);
      expect(convertFromGrams(1, 'lb')).toBeCloseTo(0.0022, 4);
    });

    it('handles very large weights', () => {
      expect(convertFromGrams(1000000, 'kg')).toBe(1000);
      expect(convertFromGrams(1000000, 'oz')).toBeCloseTo(35273.37, 2);
      expect(convertFromGrams(1000000, 'lb')).toBeCloseTo(2204.62, 0);
    });

    it('handles negative weights', () => {
      expect(convertFromGrams(-1000, 'kg')).toBe(-1);
      expect(convertFromGrams(-28.35, 'oz')).toBeCloseTo(-1, 2);
      expect(convertFromGrams(-453.59, 'lb')).toBeCloseTo(-1, 2);
    });

    it('returns original value for unknown units', () => {
      expect(convertFromGrams(100, 'invalid' as any)).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Round-trip conversions
  // -------------------------------------------------------------------------
  describe('round-trip conversions', () => {
    it('maintains accuracy when converting to grams and back', () => {
      // Convert 100g to oz and back
      const ozValue = convertFromGrams(100, 'oz');
      expect(ozValue).toBeCloseTo(3.527, 3);

      // Convert 1 kg to lb and back
      const lbValue = convertFromGrams(1000, 'lb');
      expect(lbValue).toBeCloseTo(2.205, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Decimal precision
  // -------------------------------------------------------------------------
  describe('decimal precision', () => {
    it('handles decimal weights accurately', () => {
      expect(convertFromGrams(1500, 'kg')).toBe(1.5);
      expect(convertFromGrams(77.96, 'oz')).toBeCloseTo(2.75, 2);
      expect(convertFromGrams(1511.97, 'lb')).toBeCloseTo(3.333, 3);
    });

    it('preserves precision for very precise decimal inputs', () => {
      expect(convertFromGrams(123.456, 'kg')).toBeCloseTo(0.123456, 6);
      expect(convertFromGrams(123.456, 'oz')).toBeCloseTo(4.355, 2);
      expect(convertFromGrams(123.456, 'lb')).toBeCloseTo(0.272, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Real-world scenarios
  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('converts typical camping gear weights correctly', () => {
      // Tent: ~1814g to lbs
      expect(convertFromGrams(1814.368, 'lb')).toBeCloseTo(4, 1);

      // Sleeping bag: ~1134g to lbs
      expect(convertFromGrams(1133.98, 'lb')).toBeCloseTo(2.5, 1);

      // Water bottle: ~680g to oz
      expect(convertFromGrams(680.388, 'oz')).toBeCloseTo(24, 0);

      // Backpack: 1500g to kg
      expect(convertFromGrams(1500, 'kg')).toBe(1.5);
    });

    it('handles ultralight gear weights', () => {
      // Ultralight tarp: ~227g to oz
      expect(convertFromGrams(226.796, 'oz')).toBeCloseTo(8, 0);

      // Titanium spork: ~14g to oz
      expect(convertFromGrams(14.1748, 'oz')).toBeCloseTo(0.5, 1);

      // Down jacket: 250g
      expect(convertFromGrams(250, 'g')).toBe(250);
    });

    it('converts between metric and imperial for common weights', () => {
      // 1 lb = ~454g, back to oz (16 oz)
      expect(convertFromGrams(453.59, 'oz')).toBeCloseTo(16, 0);

      // 1 kg = 1000g, to lbs (~2.2 lbs)
      expect(convertFromGrams(1000, 'lb')).toBeCloseTo(2.2046, 4);

      // 1 oz = ~28.35g, to kg (~0.028 kg)
      expect(convertFromGrams(28.35, 'kg')).toBeCloseTo(0.02835, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Display formatting scenarios
  // -------------------------------------------------------------------------
  describe('display formatting scenarios', () => {
    it('provides sensible values for UI display', () => {
      // Items typically shown in oz should have reasonable precision
      const heavyItem = convertFromGrams(1000, 'oz'); // ~35 oz
      expect(heavyItem).toBeGreaterThan(35);
      expect(heavyItem).toBeLessThan(36);

      // Items shown in kg should be easily readable
      const lightKg = convertFromGrams(250, 'kg'); // 0.25 kg
      expect(lightKg).toBe(0.25);
    });
  });
});
