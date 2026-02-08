import { describe, expect, it } from 'vitest';
import {
  parseWeight,
  parsePrice,
  normalizeJsonString,
  safeJsonParse,
} from '../../src/utils/csv-utils';

describe('parseWeight', () => {
  it('should parse weight in grams', () => {
    expect(parseWeight('500')).toEqual({ weight: 500, unit: 'g' });
    expect(parseWeight('0')).toEqual({ weight: 0, unit: 'g' }); // 0 is valid, not filtered
    expect(parseWeight('')).toEqual({ weight: null, unit: null });
  });

  it('should parse weight in ounces', () => {
    expect(parseWeight('16', 'oz')).toEqual({ weight: 454, unit: 'oz' }); // 16 * 28.35 = 453.6 → rounded
    expect(parseWeight('8', 'ounces')).toEqual({ weight: 8, unit: 'g' }); // 'ounces' not recognized, returns grams
  });

  it('should parse weight in pounds', () => {
    expect(parseWeight('2', 'lb')).toEqual({ weight: 907, unit: 'lb' }); // 2 * 453.592 = 907.184 → 907
    expect(parseWeight('1', 'lbs')).toEqual({ weight: 454, unit: 'lb' });
  });

  it('should parse weight in kilograms', () => {
    expect(parseWeight('2.5', 'kg')).toEqual({ weight: 2500, unit: 'kg' });
    expect(parseWeight('1', 'kilograms')).toEqual({ weight: 1, unit: 'g' }); // Only recognizes 'kg' substring
  });

  it('should handle negative values', () => {
    expect(parseWeight('-5')).toEqual({ weight: null, unit: null });
    expect(parseWeight('-1', 'kg')).toEqual({ weight: null, unit: null });
  });

  it('should extract unit from weight string', () => {
    expect(parseWeight('10oz')).toEqual({ weight: 284, unit: 'oz' });
    expect(parseWeight('2lb')).toEqual({ weight: 907, unit: 'lb' });
  });
});

describe('parsePrice', () => {
  it('should parse simple price', () => {
    expect(parsePrice('19.99')).toBe(19.99);
    expect(parsePrice('100')).toBe(100);
  });

  it('should extract price from currency string', () => {
    expect(parsePrice('$19.99')).toBe(19.99);
    expect(parsePrice('$1,000.00')).toBe(1000);
    expect(parsePrice('€50.00')).toBe(50);
  });

  it('should handle invalid price', () => {
    expect(parsePrice('')).toBe(null);
    expect(parsePrice('free')).toBe(null);
  });
});

describe('normalizeJsonString', () => {
  it('should convert Python null/booleans to JS', () => {
    expect(normalizeJsonString('{"active": True, "value": None}')).toBe(
      '{"active": true, "value": null}',
    );
    expect(normalizeJsonString('{"deleted": False}')).toBe('{"deleted": false}');
  });

  it('should normalize smart quotes', () => {
    expect(normalizeJsonString("{'name': 'John' }")).toBe('{"name": "John" }');
  });

  it('should remove trailing commas', () => {
    expect(normalizeJsonString('{"a": 1, "b": 2,}')).toBe('{"a": 1, "b": 2}');
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"name": "test"}')).toEqual({ name: 'test' });
    expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('should return empty array for null/undefined', () => {
    expect(safeJsonParse(null as unknown as string)).toEqual([]);
    expect(safeJsonParse('undefined')).toEqual([]);
    expect(safeJsonParse('')).toEqual([]);
  });

  it('should handle malformed JSON gracefully', () => {
    expect(safeJsonParse('not json')).toEqual([]);
    expect(safeJsonParse('{broken')).toEqual([]);
  });

  it('should normalize Python-style JSON', () => {
    expect(safeJsonParse('{"active": True, "value": None}')).toEqual({
      active: true,
      value: null,
    });
  });
});
