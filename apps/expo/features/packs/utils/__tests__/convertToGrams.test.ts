import { describe, expect, it } from 'vitest';
import { convertToGrams } from '../convertToGrams';

describe('convertToGrams', () => {
  describe('grams (g)', () => {
    it('should return the same value for grams', () => {
      expect(convertToGrams(100, 'g')).toBe(100);
      expect(convertToGrams(0, 'g')).toBe(0);
      expect(convertToGrams(1, 'g')).toBe(1);
    });

    it('should handle decimal values', () => {
      expect(convertToGrams(0.5, 'g')).toBe(0.5);
      expect(convertToGrams(100.75, 'g')).toBe(100.75);
    });

    it('should be case insensitive', () => {
      expect(convertToGrams(100, 'G')).toBe(100);
    });
  });

  describe('kilograms (kg)', () => {
    it('should convert kg to grams', () => {
      expect(convertToGrams(1, 'kg')).toBe(1000);
      expect(convertToGrams(2, 'kg')).toBe(2000);
      expect(convertToGrams(0.5, 'kg')).toBe(500);
    });

    it('should handle decimal values', () => {
      expect(convertToGrams(0.001, 'kg')).toBe(1);
      expect(convertToGrams(1.5, 'kg')).toBe(1500);
      expect(convertToGrams(2.345, 'kg')).toBe(2345);
    });

    it('should be case insensitive', () => {
      expect(convertToGrams(1, 'KG')).toBe(1000);
      expect(convertToGrams(1, 'Kg')).toBe(1000);
    });

    it('should handle zero', () => {
      expect(convertToGrams(0, 'kg')).toBe(0);
    });
  });

  describe('ounces (oz)', () => {
    it('should convert oz to grams', () => {
      expect(convertToGrams(1, 'oz')).toBeCloseTo(28.3495, 4);
      expect(convertToGrams(2, 'oz')).toBeCloseTo(56.699, 4);
      expect(convertToGrams(10, 'oz')).toBeCloseTo(283.495, 3);
    });

    it('should handle decimal values', () => {
      expect(convertToGrams(0.5, 'oz')).toBeCloseTo(14.17475, 4);
      expect(convertToGrams(1.5, 'oz')).toBeCloseTo(42.52425, 4);
    });

    it('should be case insensitive', () => {
      expect(convertToGrams(1, 'OZ')).toBeCloseTo(28.3495, 4);
      expect(convertToGrams(1, 'Oz')).toBeCloseTo(28.3495, 4);
    });

    it('should handle zero', () => {
      expect(convertToGrams(0, 'oz')).toBe(0);
    });
  });

  describe('pounds (lb)', () => {
    it('should convert lb to grams', () => {
      expect(convertToGrams(1, 'lb')).toBeCloseTo(453.592, 3);
      expect(convertToGrams(2, 'lb')).toBeCloseTo(907.184, 3);
      expect(convertToGrams(5, 'lb')).toBeCloseTo(2267.96, 2);
    });

    it('should handle decimal values', () => {
      expect(convertToGrams(0.5, 'lb')).toBeCloseTo(226.796, 3);
      expect(convertToGrams(1.5, 'lb')).toBeCloseTo(680.388, 3);
    });

    it('should be case insensitive', () => {
      expect(convertToGrams(1, 'LB')).toBeCloseTo(453.592, 3);
      expect(convertToGrams(1, 'Lb')).toBeCloseTo(453.592, 3);
    });

    it('should handle zero', () => {
      expect(convertToGrams(0, 'lb')).toBe(0);
    });
  });

  describe('unknown units', () => {
    it('should return the original value for unknown units', () => {
      expect(convertToGrams(100, 'unknown')).toBe(100);
      expect(convertToGrams(50, 'xyz')).toBe(50);
      expect(convertToGrams(25, '')).toBe(25);
    });
  });

  describe('edge cases', () => {
    it('should handle negative values', () => {
      expect(convertToGrams(-10, 'g')).toBe(-10);
      expect(convertToGrams(-1, 'kg')).toBe(-1000);
      expect(convertToGrams(-1, 'oz')).toBeCloseTo(-28.3495, 4);
      expect(convertToGrams(-1, 'lb')).toBeCloseTo(-453.592, 3);
    });

    it('should handle very large values', () => {
      expect(convertToGrams(1000, 'kg')).toBe(1000000);
      expect(convertToGrams(100, 'lb')).toBeCloseTo(45359.2, 1);
    });

    it('should handle very small values', () => {
      expect(convertToGrams(0.001, 'kg')).toBe(1);
      expect(convertToGrams(0.001, 'oz')).toBeCloseTo(0.0283495, 7);
      expect(convertToGrams(0.001, 'lb')).toBeCloseTo(0.453592, 6);
    });
  });

  describe('real-world examples', () => {
    it('should convert typical backpacking weights', () => {
      // Tent: 2.5 kg
      expect(convertToGrams(2.5, 'kg')).toBe(2500);

      // Sleeping bag: 32 oz
      expect(convertToGrams(32, 'oz')).toBeCloseTo(907.184, 3);

      // Water bottle: 1.5 lb
      expect(convertToGrams(1.5, 'lb')).toBeCloseTo(680.388, 3);

      // Headlamp: 100 g
      expect(convertToGrams(100, 'g')).toBe(100);
    });
  });
});
