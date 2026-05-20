import { describe, expect, it } from 'vitest';
import { convertFromGrams } from '../convertFromGrams';

describe('convertFromGrams', () => {
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertFromGrams({ grams: 100, unit: 'g' })).toBe(100);
      expect(convertFromGrams({ grams: 0, unit: 'g' })).toBe(0);
      expect(convertFromGrams({ grams: 1, unit: 'g' })).toBe(1);
    });

    it('converts grams to kilograms correctly', () => {
      expect(convertFromGrams({ grams: 1000, unit: 'kg' })).toBe(1);
      expect(convertFromGrams({ grams: 2500, unit: 'kg' })).toBe(2.5);
      expect(convertFromGrams({ grams: 100, unit: 'kg' })).toBe(0.1);
      expect(convertFromGrams({ grams: 500, unit: 'kg' })).toBe(0.5);
    });
  });

  describe('imperial conversions (NIST avoirdupois values)', () => {
    it('converts grams to ounces correctly', () => {
      expect(convertFromGrams({ grams: 28.349523125, unit: 'oz' })).toBe(1); // exact NIST value
      expect(convertFromGrams({ grams: 56.69904625, unit: 'oz' })).toBeCloseTo(2, 10);
      expect(convertFromGrams({ grams: 14.174761562, unit: 'oz' })).toBeCloseTo(0.5, 8);
    });

    it('converts grams to pounds correctly', () => {
      expect(convertFromGrams({ grams: 453.59237, unit: 'lb' })).toBe(1); // exact NIST value
      expect(convertFromGrams({ grams: 907.18474, unit: 'lb' })).toBeCloseTo(2, 10);
      expect(convertFromGrams({ grams: 226.796185, unit: 'lb' })).toBeCloseTo(0.5, 8);
    });
  });

  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertFromGrams({ grams: 0, unit: 'kg' })).toBe(0);
      expect(convertFromGrams({ grams: 0, unit: 'oz' })).toBe(0);
      expect(convertFromGrams({ grams: 0, unit: 'lb' })).toBe(0);
      expect(convertFromGrams({ grams: 0, unit: 'g' })).toBe(0);
    });

    it('handles very small weights', () => {
      expect(convertFromGrams({ grams: 1, unit: 'kg' })).toBe(0.001);
      expect(convertFromGrams({ grams: 1, unit: 'oz' })).toBeCloseTo(0.03527, 4);
      expect(convertFromGrams({ grams: 1, unit: 'lb' })).toBeCloseTo(0.002205, 4);
    });

    it('handles very large weights', () => {
      expect(convertFromGrams({ grams: 1000000, unit: 'kg' })).toBe(1000);
      // 1,000,000 / 28.349523125 ≈ 35273.96 (NIST exact, not the old 35273.37)
      expect(convertFromGrams({ grams: 1000000, unit: 'oz' })).toBeCloseTo(35273.96, 1);
      expect(convertFromGrams({ grams: 1000000, unit: 'lb' })).toBeCloseTo(2204.62, 0);
    });

    it('handles negative weights', () => {
      expect(convertFromGrams({ grams: -1000, unit: 'kg' })).toBe(-1);
      expect(convertFromGrams({ grams: -28.349523125, unit: 'oz' })).toBeCloseTo(-1, 10);
      expect(convertFromGrams({ grams: -453.59237, unit: 'lb' })).toBeCloseTo(-1, 10);
    });
  });

  describe('round-trip conversions (using same factor both ways)', () => {
    it('maintains exact accuracy when converting to grams and back', () => {
      const ozValue = convertFromGrams({ grams: 100, unit: 'oz' });
      expect(ozValue).toBeCloseTo(3.527, 3);

      const lbValue = convertFromGrams({ grams: 1000, unit: 'lb' });
      expect(lbValue).toBeCloseTo(2.205, 3);
    });
  });

  describe('decimal precision', () => {
    it('handles decimal weights accurately', () => {
      expect(convertFromGrams({ grams: 1500, unit: 'kg' })).toBe(1.5);
      expect(convertFromGrams({ grams: 123.456, unit: 'kg' })).toBeCloseTo(0.123456, 6);
      expect(convertFromGrams({ grams: 123.456, unit: 'oz' })).toBeCloseTo(4.355, 2);
      expect(convertFromGrams({ grams: 123.456, unit: 'lb' })).toBeCloseTo(0.272, 3);
    });
  });

  describe('real-world scenarios', () => {
    it('converts typical camping gear weights correctly', () => {
      expect(convertFromGrams({ grams: 1814.369, unit: 'lb' })).toBeCloseTo(4, 1);
      expect(convertFromGrams({ grams: 1133.981, unit: 'lb' })).toBeCloseTo(2.5, 1);
      expect(convertFromGrams({ grams: 680.388, unit: 'oz' })).toBeCloseTo(24, 0);
      expect(convertFromGrams({ grams: 1500, unit: 'kg' })).toBe(1.5);
    });

    it('handles ultralight gear weights', () => {
      expect(convertFromGrams({ grams: 226.796, unit: 'oz' })).toBeCloseTo(8, 0);
      expect(convertFromGrams({ grams: 14.1748, unit: 'oz' })).toBeCloseTo(0.5, 1);
      expect(convertFromGrams({ grams: 250, unit: 'g' })).toBe(250);
    });

    it('converts between metric and imperial for common weights', () => {
      // 1 kg in lbs
      expect(convertFromGrams({ grams: 1000, unit: 'lb' })).toBeCloseTo(2.20462, 4);
      // 1 oz in kg
      expect(convertFromGrams({ grams: 28.349523125, unit: 'kg' })).toBeCloseTo(0.02835, 5);
    });
  });

  describe('display formatting scenarios', () => {
    it('provides sensible values for UI display', () => {
      const heavyItem = convertFromGrams({ grams: 1000, unit: 'oz' }); // ~35.27 oz
      expect(heavyItem).toBeGreaterThan(35);
      expect(heavyItem).toBeLessThan(36);

      const lightKg = convertFromGrams({ grams: 250, unit: 'kg' }); // 0.25 kg
      expect(lightKg).toBe(0.25);
    });
  });
});
