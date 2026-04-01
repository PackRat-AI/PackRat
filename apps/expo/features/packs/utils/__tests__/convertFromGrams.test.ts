import { describe, expect, it } from 'vitest';
import { convertFromGrams } from '../convertFromGrams';
import type { WeightUnit } from '../../types';

describe('convertFromGrams', () => {
  describe('to grams (g)', () => {
    it('should return the same value', () => {
      expect(convertFromGrams(100, 'g')).toBe(100);
      expect(convertFromGrams(0, 'g')).toBe(0);
      expect(convertFromGrams(1, 'g')).toBe(1);
    });

    it('should handle decimal values', () => {
      expect(convertFromGrams(0.5, 'g')).toBe(0.5);
      expect(convertFromGrams(100.75, 'g')).toBe(100.75);
    });
  });

  describe('to ounces (oz)', () => {
    it('should convert grams to oz', () => {
      expect(convertFromGrams(28.35, 'oz')).toBeCloseTo(1, 2);
      expect(convertFromGrams(56.7, 'oz')).toBeCloseTo(2, 1);
      expect(convertFromGrams(283.5, 'oz')).toBeCloseTo(10, 1);
    });

    it('should handle decimal values', () => {
      expect(convertFromGrams(14.175, 'oz')).toBeCloseTo(0.5, 2);
      expect(convertFromGrams(42.525, 'oz')).toBeCloseTo(1.5, 2);
    });

    it('should handle zero', () => {
      expect(convertFromGrams(0, 'oz')).toBe(0);
    });

    it('should use correct conversion factor (28.35)', () => {
      // 1 oz = 28.35 grams
      expect(convertFromGrams(100, 'oz')).toBeCloseTo(100 / 28.35, 5);
    });
  });

  describe('to kilograms (kg)', () => {
    it('should convert grams to kg', () => {
      expect(convertFromGrams(1000, 'kg')).toBe(1);
      expect(convertFromGrams(2000, 'kg')).toBe(2);
      expect(convertFromGrams(500, 'kg')).toBe(0.5);
    });

    it('should handle decimal values', () => {
      expect(convertFromGrams(1, 'kg')).toBe(0.001);
      expect(convertFromGrams(1500, 'kg')).toBe(1.5);
      expect(convertFromGrams(2345, 'kg')).toBe(2.345);
    });

    it('should handle zero', () => {
      expect(convertFromGrams(0, 'kg')).toBe(0);
    });

    it('should use correct conversion factor (1000)', () => {
      // 1 kg = 1000 grams
      expect(convertFromGrams(100, 'kg')).toBe(0.1);
    });
  });

  describe('to pounds (lb)', () => {
    it('should convert grams to lb', () => {
      expect(convertFromGrams(453.59, 'lb')).toBeCloseTo(1, 2);
      expect(convertFromGrams(907.18, 'lb')).toBeCloseTo(2, 1);
      expect(convertFromGrams(2267.95, 'lb')).toBeCloseTo(5, 1);
    });

    it('should handle decimal values', () => {
      expect(convertFromGrams(226.795, 'lb')).toBeCloseTo(0.5, 2);
      expect(convertFromGrams(680.385, 'lb')).toBeCloseTo(1.5, 2);
    });

    it('should handle zero', () => {
      expect(convertFromGrams(0, 'lb')).toBe(0);
    });

    it('should use correct conversion factor (453.59)', () => {
      // 1 lb = 453.59 grams
      expect(convertFromGrams(100, 'lb')).toBeCloseTo(100 / 453.59, 5);
    });
  });

  describe('unknown units', () => {
    it('should return the original value for unknown units', () => {
      expect(convertFromGrams(100, 'unknown' as WeightUnit)).toBe(100);
      expect(convertFromGrams(50, 'xyz' as WeightUnit)).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should handle negative values', () => {
      expect(convertFromGrams(-100, 'g')).toBe(-100);
      expect(convertFromGrams(-1000, 'kg')).toBe(-1);
      expect(convertFromGrams(-28.35, 'oz')).toBeCloseTo(-1, 2);
      expect(convertFromGrams(-453.59, 'lb')).toBeCloseTo(-1, 2);
    });

    it('should handle very large values', () => {
      expect(convertFromGrams(1000000, 'kg')).toBe(1000);
      expect(convertFromGrams(100000, 'lb')).toBeCloseTo(220.46, 2);
    });

    it('should handle very small values', () => {
      expect(convertFromGrams(0.001, 'kg')).toBe(0.000001);
      expect(convertFromGrams(0.1, 'oz')).toBeCloseTo(0.00353, 5);
      expect(convertFromGrams(0.1, 'lb')).toBeCloseTo(0.00022, 5);
    });
  });

  describe('round-trip conversions', () => {
    it('should be consistent with convertToGrams for oz', () => {
      const originalOz = 5;
      const grams = originalOz * 28.35;
      const convertedBack = convertFromGrams(grams, 'oz');
      expect(convertedBack).toBeCloseTo(originalOz, 2);
    });

    it('should be consistent with convertToGrams for kg', () => {
      const originalKg = 2.5;
      const grams = originalKg * 1000;
      const convertedBack = convertFromGrams(grams, 'kg');
      expect(convertedBack).toBe(originalKg);
    });

    it('should be consistent with convertToGrams for lb', () => {
      const originalLb = 3;
      const grams = originalLb * 453.59;
      const convertedBack = convertFromGrams(grams, 'lb');
      expect(convertedBack).toBeCloseTo(originalLb, 2);
    });
  });

  describe('real-world examples', () => {
    it('should convert typical backpacking weights', () => {
      // Tent: 2500 g to kg
      expect(convertFromGrams(2500, 'kg')).toBe(2.5);

      // Sleeping bag: 907 g to oz
      expect(convertFromGrams(907, 'oz')).toBeCloseTo(32, 0);

      // Water bottle: 680 g to lb
      expect(convertFromGrams(680, 'lb')).toBeCloseTo(1.5, 1);

      // Headlamp: 100 g stays as g
      expect(convertFromGrams(100, 'g')).toBe(100);
    });

    it('should handle precise conversions for comparing weights', () => {
      // Compare if 1 lb is heavier than 400 g
      const onePoundInGrams = 453.59;
      expect(onePoundInGrams).toBeGreaterThan(400);

      // Compare if 1 oz is lighter than 30 g
      const oneOzInGrams = 28.35;
      expect(oneOzInGrams).toBeLessThan(30);
    });
  });
});
