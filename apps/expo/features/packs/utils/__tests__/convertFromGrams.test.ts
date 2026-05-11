import { describe, expect, it } from 'vitest';
import { convertFromGrams } from '../convertFromGrams';

describe('convertFromGrams', () => {
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

  describe('imperial conversions (NIST avoirdupois values)', () => {
    it('converts grams to ounces correctly', () => {
      expect(convertFromGrams(28.349523125, 'oz')).toBe(1); // exact NIST value
      expect(convertFromGrams(56.69904625, 'oz')).toBeCloseTo(2, 10);
      expect(convertFromGrams(14.174761562, 'oz')).toBeCloseTo(0.5, 8);
    });

    it('converts grams to pounds correctly', () => {
      expect(convertFromGrams(453.59237, 'lb')).toBe(1); // exact NIST value
      expect(convertFromGrams(907.18474, 'lb')).toBeCloseTo(2, 10);
      expect(convertFromGrams(226.796185, 'lb')).toBeCloseTo(0.5, 8);
    });
  });

  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertFromGrams(0, 'kg')).toBe(0);
      expect(convertFromGrams(0, 'oz')).toBe(0);
      expect(convertFromGrams(0, 'lb')).toBe(0);
      expect(convertFromGrams(0, 'g')).toBe(0);
    });

    it('handles very small weights', () => {
      expect(convertFromGrams(1, 'kg')).toBe(0.001);
      expect(convertFromGrams(1, 'oz')).toBeCloseTo(0.03527, 4);
      expect(convertFromGrams(1, 'lb')).toBeCloseTo(0.002205, 4);
    });

    it('handles very large weights', () => {
      expect(convertFromGrams(1000000, 'kg')).toBe(1000);
      // 1,000,000 / 28.349523125 ≈ 35273.96 (NIST exact, not the old 35273.37)
      expect(convertFromGrams(1000000, 'oz')).toBeCloseTo(35273.96, 1);
      expect(convertFromGrams(1000000, 'lb')).toBeCloseTo(2204.62, 0);
    });

    it('handles negative weights', () => {
      expect(convertFromGrams(-1000, 'kg')).toBe(-1);
      expect(convertFromGrams(-28.349523125, 'oz')).toBeCloseTo(-1, 10);
      expect(convertFromGrams(-453.59237, 'lb')).toBeCloseTo(-1, 10);
    });
  });

  describe('round-trip conversions (using same factor both ways)', () => {
    it('maintains exact accuracy when converting to grams and back', () => {
      const ozValue = convertFromGrams(100, 'oz');
      expect(ozValue).toBeCloseTo(3.527, 3);

      const lbValue = convertFromGrams(1000, 'lb');
      expect(lbValue).toBeCloseTo(2.205, 3);
    });
  });

  describe('decimal precision', () => {
    it('handles decimal weights accurately', () => {
      expect(convertFromGrams(1500, 'kg')).toBe(1.5);
      expect(convertFromGrams(123.456, 'kg')).toBeCloseTo(0.123456, 6);
      expect(convertFromGrams(123.456, 'oz')).toBeCloseTo(4.355, 2);
      expect(convertFromGrams(123.456, 'lb')).toBeCloseTo(0.272, 3);
    });
  });

  describe('real-world scenarios', () => {
    it('converts typical camping gear weights correctly', () => {
      expect(convertFromGrams(1814.369, 'lb')).toBeCloseTo(4, 1);
      expect(convertFromGrams(1133.981, 'lb')).toBeCloseTo(2.5, 1);
      expect(convertFromGrams(680.388, 'oz')).toBeCloseTo(24, 0);
      expect(convertFromGrams(1500, 'kg')).toBe(1.5);
    });

    it('handles ultralight gear weights', () => {
      expect(convertFromGrams(226.796, 'oz')).toBeCloseTo(8, 0);
      expect(convertFromGrams(14.1748, 'oz')).toBeCloseTo(0.5, 1);
      expect(convertFromGrams(250, 'g')).toBe(250);
    });

    it('converts between metric and imperial for common weights', () => {
      // 1 kg in lbs
      expect(convertFromGrams(1000, 'lb')).toBeCloseTo(2.20462, 4);
      // 1 oz in kg
      expect(convertFromGrams(28.349523125, 'kg')).toBeCloseTo(0.02835, 5);
    });
  });

  describe('display formatting scenarios', () => {
    it('provides sensible values for UI display', () => {
      const heavyItem = convertFromGrams(1000, 'oz'); // ~35.27 oz
      expect(heavyItem).toBeGreaterThan(35);
      expect(heavyItem).toBeLessThan(36);

      const lightKg = convertFromGrams(250, 'kg'); // 0.25 kg
      expect(lightKg).toBe(0.25);
    });
  });
});
