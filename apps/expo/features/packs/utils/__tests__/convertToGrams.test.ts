import { describe, expect, it } from 'vitest';
import { convertToGrams } from '../convertToGrams';

describe('convertToGrams', () => {
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertToGrams({ weight: 100, unit: 'g' })).toBe(100);
      expect(convertToGrams({ weight: 0, unit: 'g' })).toBe(0);
      expect(convertToGrams({ weight: 1, unit: 'g' })).toBe(1);
    });

    it('converts kilograms to grams correctly', () => {
      expect(convertToGrams({ weight: 1, unit: 'kg' })).toBe(1000);
      expect(convertToGrams({ weight: 2.5, unit: 'kg' })).toBe(2500);
      expect(convertToGrams({ weight: 0.1, unit: 'kg' })).toBe(100);
    });
  });

  describe('imperial conversions (NIST avoirdupois values)', () => {
    it('converts ounces to grams correctly', () => {
      expect(convertToGrams({ weight: 1, unit: 'oz' })).toBe(28.349523125);
      expect(convertToGrams({ weight: 16, unit: 'oz' })).toBeCloseTo(453.59237, 4); // 1 lb worth
      expect(convertToGrams({ weight: 0.5, unit: 'oz' })).toBeCloseTo(14.174761562, 6);
    });

    it('converts pounds to grams correctly', () => {
      expect(convertToGrams({ weight: 1, unit: 'lb' })).toBe(453.59237);
      expect(convertToGrams({ weight: 2, unit: 'lb' })).toBeCloseTo(907.18474, 4);
      expect(convertToGrams({ weight: 0.5, unit: 'lb' })).toBeCloseTo(226.796185, 4);
    });
  });

  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertToGrams({ weight: 0, unit: 'kg' })).toBe(0);
      expect(convertToGrams({ weight: 0, unit: 'oz' })).toBe(0);
      expect(convertToGrams({ weight: 0, unit: 'lb' })).toBe(0);
    });

    it('handles very small weights', () => {
      expect(convertToGrams({ weight: 0.001, unit: 'kg' })).toBe(1);
      expect(convertToGrams({ weight: 0.001, unit: 'oz' })).toBeCloseTo(0.028349523125, 8);
    });

    it('handles very large weights', () => {
      expect(convertToGrams({ weight: 1000, unit: 'kg' })).toBe(1000000);
      expect(convertToGrams({ weight: 1000, unit: 'lb' })).toBeCloseTo(453592.37, 1);
    });

    it('handles negative weights', () => {
      expect(convertToGrams({ weight: -1, unit: 'kg' })).toBe(-1000);
      expect(convertToGrams({ weight: -1, unit: 'oz' })).toBe(-28.349523125);
    });

    it('returns weight unchanged for unknown units (falls back to g)', () => {
      expect(convertToGrams({ weight: 100, unit: 'invalid' })).toBe(100);
      expect(convertToGrams({ weight: 100, unit: '' })).toBe(100);
      expect(convertToGrams({ weight: 100, unit: 'stone' })).toBe(100);
    });
  });

  describe('decimal precision', () => {
    it('handles decimal weights accurately', () => {
      expect(convertToGrams({ weight: 1.5, unit: 'kg' })).toBe(1500);
      expect(convertToGrams({ weight: 2.75, unit: 'oz' })).toBeCloseTo(77.961188, 4);
      expect(convertToGrams({ weight: 3.333, unit: 'lb' })).toBeCloseTo(1511.82, 2);
    });

    it('preserves precision for very precise decimal inputs', () => {
      expect(convertToGrams({ weight: 0.123456, unit: 'kg' })).toBeCloseTo(123.456, 3);
    });
  });

  describe('real-world scenarios', () => {
    it('converts typical camping gear weights correctly', () => {
      expect(convertToGrams({ weight: 4, unit: 'lb' })).toBeCloseTo(1814.369, 2);
      expect(convertToGrams({ weight: 2.5, unit: 'lb' })).toBeCloseTo(1133.981, 2);
      expect(convertToGrams({ weight: 24, unit: 'oz' })).toBeCloseTo(680.388, 2);
      expect(convertToGrams({ weight: 1.5, unit: 'kg' })).toBe(1500);
    });

    it('handles ultralight gear weights', () => {
      expect(convertToGrams({ weight: 8, unit: 'oz' })).toBeCloseTo(226.796, 2);
      expect(convertToGrams({ weight: 0.5, unit: 'oz' })).toBeCloseTo(14.1748, 3);
      expect(convertToGrams({ weight: 250, unit: 'g' })).toBe(250);
    });
  });
});
