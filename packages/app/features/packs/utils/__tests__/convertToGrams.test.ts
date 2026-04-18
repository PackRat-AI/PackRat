import { describe, expect, it } from 'vitest';
import { convertToGrams } from '../convertToGrams';

describe('convertToGrams', () => {
  // -------------------------------------------------------------------------
  // Metric conversions
  // -------------------------------------------------------------------------
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertToGrams(100, 'g')).toBe(100);
      expect(convertToGrams(0, 'g')).toBe(0);
      expect(convertToGrams(1, 'g')).toBe(1);
    });

    it('converts kilograms to grams correctly', () => {
      expect(convertToGrams(1, 'kg')).toBe(1000);
      expect(convertToGrams(2.5, 'kg')).toBe(2500);
      expect(convertToGrams(0.1, 'kg')).toBe(100);
    });

    it('handles case insensitive metric units', () => {
      expect(convertToGrams(1, 'KG')).toBe(1000);
      expect(convertToGrams(1, 'Kg')).toBe(1000);
      expect(convertToGrams(100, 'G')).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Imperial conversions
  // -------------------------------------------------------------------------
  describe('imperial conversions', () => {
    it('converts ounces to grams correctly', () => {
      expect(convertToGrams(1, 'oz')).toBeCloseTo(28.3495, 4);
      expect(convertToGrams(16, 'oz')).toBeCloseTo(453.592, 2); // 1 pound
      expect(convertToGrams(0.5, 'oz')).toBeCloseTo(14.1748, 4);
    });

    it('converts pounds to grams correctly', () => {
      expect(convertToGrams(1, 'lb')).toBeCloseTo(453.592, 3);
      expect(convertToGrams(2, 'lb')).toBeCloseTo(907.184, 3);
      expect(convertToGrams(0.5, 'lb')).toBeCloseTo(226.796, 3);
    });

    it('handles case insensitive imperial units', () => {
      expect(convertToGrams(1, 'OZ')).toBeCloseTo(28.3495, 4);
      expect(convertToGrams(1, 'Oz')).toBeCloseTo(28.3495, 4);
      expect(convertToGrams(1, 'LB')).toBeCloseTo(453.592, 3);
      expect(convertToGrams(1, 'Lb')).toBeCloseTo(453.592, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertToGrams(0, 'kg')).toBe(0);
      expect(convertToGrams(0, 'oz')).toBe(0);
      expect(convertToGrams(0, 'lb')).toBe(0);
    });

    it('handles very small weights', () => {
      expect(convertToGrams(0.001, 'kg')).toBe(1);
      expect(convertToGrams(0.001, 'oz')).toBeCloseTo(0.0283495, 7);
    });

    it('handles very large weights', () => {
      expect(convertToGrams(1000, 'kg')).toBe(1000000);
      expect(convertToGrams(1000, 'lb')).toBeCloseTo(453592, 0);
    });

    it('handles negative weights', () => {
      expect(convertToGrams(-1, 'kg')).toBe(-1000);
      expect(convertToGrams(-1, 'oz')).toBeCloseTo(-28.3495, 4);
    });

    it('returns original value for unknown units', () => {
      expect(convertToGrams(100, 'invalid')).toBe(100);
      expect(convertToGrams(100, '')).toBe(100);
      expect(convertToGrams(100, 'stone')).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Decimal precision
  // -------------------------------------------------------------------------
  describe('decimal precision', () => {
    it('handles decimal weights accurately', () => {
      expect(convertToGrams(1.5, 'kg')).toBe(1500);
      expect(convertToGrams(2.75, 'oz')).toBeCloseTo(77.9611, 4);
      expect(convertToGrams(3.333, 'lb')).toBeCloseTo(1511.82, 2);
    });

    it('preserves precision for very precise decimal inputs', () => {
      expect(convertToGrams(0.123456, 'kg')).toBeCloseTo(123.456, 3);
      expect(convertToGrams(0.123456, 'oz')).toBeCloseTo(3.499, 2);
    });
  });

  // -------------------------------------------------------------------------
  // Real-world scenarios
  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('converts typical camping gear weights correctly', () => {
      // Tent: 4 lbs
      expect(convertToGrams(4, 'lb')).toBeCloseTo(1814.368, 2);

      // Sleeping bag: 2.5 lbs
      expect(convertToGrams(2.5, 'lb')).toBeCloseTo(1133.98, 2);

      // Water bottle: 24 oz
      expect(convertToGrams(24, 'oz')).toBeCloseTo(680.388, 2);

      // Backpack: 1.5 kg
      expect(convertToGrams(1.5, 'kg')).toBe(1500);
    });

    it('handles ultralight gear weights', () => {
      // Ultralight tarp: 8 oz
      expect(convertToGrams(8, 'oz')).toBeCloseTo(226.796, 2);

      // Titanium spork: 0.5 oz
      expect(convertToGrams(0.5, 'oz')).toBeCloseTo(14.1748, 4);

      // Down jacket: 250g
      expect(convertToGrams(250, 'g')).toBe(250);
    });
  });
});
