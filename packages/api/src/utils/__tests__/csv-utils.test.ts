import { describe, expect, it } from 'vitest';
import {
  normalizeJsonString,
  parseFaqs,
  parsePrice,
  parseWeight,
  safeJsonParse,
} from '../csv-utils';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('csv-utils', () => {
  describe('parseWeight', () => {
    it('parses grams correctly', () => {
      expect(parseWeight('100')).toEqual({ weight: 100, unit: 'g' });
      expect(parseWeight('150', 'g')).toEqual({ weight: 150, unit: 'g' });
    });

    it('parses ounces correctly', () => {
      expect(parseWeight('10', 'oz')).toEqual({ weight: 284, unit: 'oz' });
      expect(parseWeight('5 oz')).toEqual({ weight: 142, unit: 'oz' });
    });

    it('parses pounds correctly', () => {
      expect(parseWeight('2', 'lb')).toEqual({ weight: 907, unit: 'lb' });
      expect(parseWeight('3 lbs')).toEqual({ weight: 1361, unit: 'lb' });
    });

    it('parses kilograms correctly', () => {
      expect(parseWeight('1.5', 'kg')).toEqual({ weight: 1500, unit: 'kg' });
      expect(parseWeight('2 kg')).toEqual({ weight: 2000, unit: 'kg' });
    });

    it('handles empty or invalid input', () => {
      expect(parseWeight('')).toEqual({ weight: null, unit: null });
      expect(parseWeight('invalid')).toEqual({ weight: null, unit: null });
      expect(parseWeight('-10')).toEqual({ weight: null, unit: null });
    });

    it('defaults to grams when no unit is specified', () => {
      expect(parseWeight('250')).toEqual({ weight: 250, unit: 'g' });
    });

    it('is case-insensitive for units', () => {
      expect(parseWeight('10', 'OZ')).toEqual({ weight: 284, unit: 'oz' });
      expect(parseWeight('1', 'KG')).toEqual({ weight: 1000, unit: 'kg' });
    });
  });

  describe('parsePrice', () => {
    it('parses numeric prices', () => {
      expect(parsePrice('99.99')).toBe(99.99);
      expect(parsePrice('150')).toBe(150);
    });

    it('extracts price from formatted strings', () => {
      expect(parsePrice('$99.99')).toBe(99.99);
      expect(parsePrice('USD 150.50')).toBe(150.5);
      expect(parsePrice('€45.00')).toBe(45);
    });

    it('handles invalid input', () => {
      expect(parsePrice('')).toBeNull();
      expect(parsePrice('invalid')).toBeNull();
      expect(parsePrice('abc')).toBeNull();
    });

    it('handles prices with commas', () => {
      expect(parsePrice('$1,234.56')).toBe(1234.56);
      expect(parsePrice('2,500')).toBe(2500);
    });
  });

  describe('normalizeJsonString', () => {
    it('replaces Python-style null/boolean with JS equivalents', () => {
      expect(normalizeJsonString('None')).toBe('null');
      expect(normalizeJsonString('True')).toBe('true');
      expect(normalizeJsonString('False')).toBe('false');
    });

    it('normalizes smart quotes to standard quotes', () => {
      // Test with actual smart quote characters (curly quotes)
      const inputWithSmartQuotes = String.fromCharCode(8216) + 'hello' + String.fromCharCode(8217);
      const result = normalizeJsonString(inputWithSmartQuotes);
      expect(result).toContain("'hello'"); // Smart quotes should become regular quotes
      expect(result).not.toContain(String.fromCharCode(8216)); // No more smart quotes
    });

    it('converts single-quoted keys to double-quoted', () => {
      const input = "{'key': 'value'}";
      const result = normalizeJsonString(input);
      expect(result).toContain('"key"');
    });

    it('removes trailing commas', () => {
      const input = '{"key": "value",}';
      const result = normalizeJsonString(input);
      expect(result).toBe('{"key": "value"}');
    });

    it('handles complex nested objects', () => {
      const input = "{'outer': {'inner': True, 'value': None,}}";
      const result = normalizeJsonString(input);
      expect(result).toContain('true');
      expect(result).toContain('null');
      expect(result).not.toContain(',}');
    });

    it('decodes hex escapes', () => {
      const input = '\\x41\\x42\\x43';
      const result = normalizeJsonString(input);
      expect(result).toBe('ABC');
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns empty array for invalid JSON', () => {
      const result = safeJsonParse('invalid json');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(safeJsonParse('')).toEqual([]);
      expect(safeJsonParse('undefined')).toEqual([]);
      expect(safeJsonParse('null')).toEqual([]);
    });

    it('normalizes and parses Python-style JSON', () => {
      const result = safeJsonParse("{'key': True, 'other': None}");
      expect(result).toEqual({ key: true, other: null });
    });

    it('handles arrays', () => {
      const result = safeJsonParse('["a", "b", "c"]');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array on parse error', () => {
      const result = safeJsonParse('{invalid: json}');
      expect(result).toEqual([]);
    });
  });

  describe('parseFaqs', () => {
    it('parses valid FAQ JSON array', () => {
      const input = '[{"question": "Q1?", "answer": "A1"}, {"question": "Q2?", "answer": "A2"}]';
      const result = parseFaqs(input);
      expect(result).toEqual([
        { question: 'Q1?', answer: 'A1' },
        { question: 'Q2?', answer: 'A2' },
      ]);
    });

    it('handles empty input', () => {
      expect(parseFaqs('')).toEqual([]);
      expect(parseFaqs(null as any)).toEqual([]);
      expect(parseFaqs(undefined as any)).toEqual([]);
    });

    it('extracts FAQs from malformed JSON', () => {
      const input = '{"question": "What is this?", "answer": "An item"}';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        question: 'What is this?',
        answer: 'An item',
      });
    });

    it('handles quoted string input', () => {
      const input = '"{\\"question\\": \\"Q1?\\", \\"answer\\": \\"A1\\"}"';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        question: 'Q1?',
        answer: 'A1',
      });
    });

    it('returns empty array for input without FAQs', () => {
      const result = parseFaqs('random text');
      expect(result).toEqual([]);
    });

    it('handles single-quoted JSON', () => {
      const input = "{'question': 'Q1?', 'answer': 'A1'}";
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
    });
  });
});
