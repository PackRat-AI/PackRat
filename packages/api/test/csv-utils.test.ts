import { describe, expect, it } from 'vitest';
import {
  mapCsvRowToItem,
  normalizeJsonString,
  parseFaqs,
  parsePrice,
  parseWeight,
  safeJsonParse,
} from '../src/utils/csv-utils';

describe('csv-utils', () => {
  describe('parseWeight', () => {
    it('should parse grams with no unit', () => {
      expect(parseWeight('100')).toEqual({ weight: 100, unit: 'g' });
    });

    it('should parse ounces', () => {
      expect(parseWeight('5 oz')).toEqual({ weight: Math.round(5 * 28.35), unit: 'oz' });
      expect(parseWeight('5', 'oz')).toEqual({ weight: Math.round(5 * 28.35), unit: 'oz' });
    });

    it('should parse pounds', () => {
      expect(parseWeight('2 lb')).toEqual({ weight: Math.round(2 * 453.592), unit: 'lb' });
      expect(parseWeight('2', 'lb')).toEqual({ weight: Math.round(2 * 453.592), unit: 'lb' });
    });

    it('should parse kilograms', () => {
      expect(parseWeight('1.5 kg')).toEqual({ weight: 1500, unit: 'kg' });
      expect(parseWeight('1.5', 'kg')).toEqual({ weight: 1500, unit: 'kg' });
    });

    it('should handle invalid inputs', () => {
      expect(parseWeight('')).toEqual({ weight: null, unit: null });
      expect(parseWeight('invalid')).toEqual({ weight: null, unit: null });
      expect(parseWeight('-5')).toEqual({ weight: null, unit: null });
    });

    it('should be case insensitive', () => {
      expect(parseWeight('5 OZ')).toEqual({ weight: Math.round(5 * 28.35), unit: 'oz' });
      expect(parseWeight('5 LB')).toEqual({ weight: Math.round(5 * 453.592), unit: 'lb' });
      expect(parseWeight('5 KG')).toEqual({ weight: 5000, unit: 'kg' });
    });

    it('should handle fractional values', () => {
      expect(parseWeight('1.5')).toEqual({ weight: 1.5, unit: 'g' });
      expect(parseWeight('0.5 oz')).toEqual({ weight: Math.round(0.5 * 28.35), unit: 'oz' });
    });
  });

  describe('parsePrice', () => {
    it('should parse simple prices', () => {
      expect(parsePrice('49.99')).toBe(49.99);
      expect(parsePrice('100')).toBe(100);
    });

    it('should handle currency symbols', () => {
      expect(parsePrice('$49.99')).toBe(49.99);
      expect(parsePrice('€29.99')).toBe(29.99);
      expect(parsePrice('£39.99')).toBe(39.99);
    });

    it('should handle commas', () => {
      expect(parsePrice('1,299.99')).toBe(1299.99);
      expect(parsePrice('$1,999')).toBe(1999);
    });

    it('should return null for invalid inputs', () => {
      expect(parsePrice('')).toBeNull();
      expect(parsePrice('invalid')).toBeNull();
      expect(parsePrice('N/A')).toBeNull();
    });
  });

  describe('normalizeJsonString', () => {
    it('should replace Python-style values', () => {
      expect(normalizeJsonString('None')).toContain('null');
      expect(normalizeJsonString('True')).toContain('true');
      expect(normalizeJsonString('False')).toContain('false');
    });

    it('should normalize smart quotes', () => {
      expect(normalizeJsonString('"test"')).toContain('"test"');
      expect(normalizeJsonString(''test'')).toContain("'test'");
    });

    it('should convert single-quoted keys to double-quoted', () => {
      const input = "{'key': 'value'}";
      const result = normalizeJsonString(input);
      expect(result).toContain('"key"');
    });

    it('should remove trailing commas', () => {
      expect(normalizeJsonString('{"a": 1,}')).toBe('{"a": 1}');
      expect(normalizeJsonString('[1, 2,]')).toBe('[1, 2]');
    });

    it('should handle hex escapes', () => {
      const result = normalizeJsonString('\\x41'); // 'A'
      expect(result).toContain('A');
    });

    it('should escape backslashes', () => {
      const input = '{"path": "C:\\\\Users"}';
      const result = normalizeJsonString(input);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
      expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should parse normalized JSON', () => {
      expect(safeJsonParse("{'key': 'value'}")).toEqual({ key: 'value' });
      expect(safeJsonParse('{"key": True}')).toEqual({ key: true });
    });

    it('should return empty array for invalid inputs', () => {
      expect(safeJsonParse('')).toEqual([]);
      expect(safeJsonParse('undefined')).toEqual([]);
      expect(safeJsonParse('null')).toEqual([]);
    });

    it('should return empty array for unparseable JSON', () => {
      expect(safeJsonParse('invalid json')).toEqual([]);
      expect(safeJsonParse('{')).toEqual([]);
    });

    it('should handle complex nested structures', () => {
      const input = '{"data": [{"id": 1}, {"id": 2}]}';
      expect(safeJsonParse(input)).toEqual({
        data: [{ id: 1 }, { id: 2 }],
      });
    });
  });

  describe('parseFaqs', () => {
    it('should parse FAQ array', () => {
      const input =
        '[{"question": "What is this?", "answer": "A test"}, {"question": "Why?", "answer": "Testing"}]';
      const result = parseFaqs(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ question: 'What is this?', answer: 'A test' });
    });

    it('should handle single FAQ', () => {
      const input = '{"question": "How?", "answer": "Like this"}';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ question: 'How?', answer: 'Like this' });
    });

    it('should handle quoted JSON strings', () => {
      const input = '"[{\\"question\\": \\"Test\\", \\"answer\\": \\"Answer\\"}]"';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for invalid inputs', () => {
      expect(parseFaqs('')).toEqual([]);
      expect(parseFaqs('invalid')).toEqual([]);
    });

    it('should handle smart quotes', () => {
      const input = '{\"question\": \"What?\", \"answer\": \"This\"}';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
    });
  });

  describe('mapCsvRowToItem', () => {
    it('should map basic fields', () => {
      const values = ['Test Item', 'https://example.com/item', '100', 'g', '49.99'];
      const fieldMap = {
        name: 0,
        productUrl: 1,
        weight: 2,
        weightUnit: 3,
        price: 4,
      };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item).toMatchObject({
        name: 'Test Item',
        productUrl: 'https://example.com/item',
        weight: 100,
        weightUnit: 'g',
        price: 49.99,
      });
    });

    it('should parse categories from JSON array', () => {
      const values = ['Item', '["Camping", "Hiking"]'];
      const fieldMap = { name: 0, categories: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.categories).toEqual(['Camping', 'Hiking']);
    });

    it('should parse categories from comma-separated string', () => {
      const values = ['Item', 'Camping, Hiking, Backpacking'];
      const fieldMap = { name: 0, categories: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.categories).toEqual(['Camping', 'Hiking', 'Backpacking']);
    });

    it('should parse images from JSON array', () => {
      const values = ['Item', '["http://img1.jpg", "http://img2.jpg"]'];
      const fieldMap = { name: 0, images: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.images).toEqual(['http://img1.jpg', 'http://img2.jpg']);
    });

    it('should handle weight conversions', () => {
      const values = ['Item', '5 oz'];
      const fieldMap = { name: 0, weight: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.weight).toBe(Math.round(5 * 28.35));
      expect(item?.weightUnit).toBe('oz');
    });

    it('should parse numeric fields', () => {
      const values = ['Item', '4.5', '150'];
      const fieldMap = { name: 0, ratingValue: 1, reviewCount: 2 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.ratingValue).toBe(4.5);
      expect(item?.reviewCount).toBe(150);
    });

    it('should handle description with newlines', () => {
      const values = ['Item', 'Line 1\r\nLine 2\nLine 3'];
      const fieldMap = { name: 0, description: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.description).toBe('Line 1 Line 2 Line 3');
    });

    it('should handle string fields', () => {
      const values = ['Item', 'BrandName', 'Model123', 'Red', 'M', 'SKU123'];
      const fieldMap = {
        name: 0,
        brand: 1,
        model: 2,
        color: 3,
        size: 4,
        sku: 5,
      };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item).toMatchObject({
        brand: 'BrandName',
        model: 'Model123',
        color: 'Red',
        size: 'M',
        sku: 'SKU123',
      });
    });

    it('should parse variants from JSON', () => {
      const values = ['Item', '[{"size": "S"}, {"size": "M"}]'];
      const fieldMap = { name: 0, variants: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.variants).toEqual([{ size: 'S' }, { size: 'M' }]);
    });

    it('should handle JSON fields', () => {
      const values = ['Item', '[]', '[]', '[]'];
      const fieldMap = { name: 0, links: 1, reviews: 2, qas: 3 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.links).toEqual([]);
      expect(item?.reviews).toEqual([]);
      expect(item?.qas).toEqual([]);
    });

    it('should parse techs field and extract weight', () => {
      const values = ['Item', '{"Claimed Weight": "500g", "Material": "Nylon"}'];
      const fieldMap = { name: 0, techs: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.techs).toMatchObject({ 'Claimed Weight': '500g', Material: 'Nylon' });
      expect(item?.weight).toBe(500);
      expect(item?.weightUnit).toBe('g');
    });

    it('should handle missing fields gracefully', () => {
      const values = ['Item'];
      const fieldMap = { name: 0 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.name).toBe('Item');
      expect(item?.description).toBeUndefined();
    });

    it('should handle empty values', () => {
      const values = ['Item', '', '', ''];
      const fieldMap = { name: 0, description: 1, brand: 2, categories: 3 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.name).toBe('Item');
      expect(item?.description).toBe('');
      expect(item?.categories).toBeUndefined();
    });

    it('should handle availability enum', () => {
      const values = ['Item', 'in_stock'];
      const fieldMap = { name: 0, availability: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.availability).toBe('in_stock');
    });

    it('should strip quotes from string fields', () => {
      const values = ['Item', '"Brand Name"', '"Model-123"'];
      const fieldMap = { name: 0, brand: 1, model: 2 };

      const item = mapCsvRowToItem({ values, fieldMap });

      expect(item?.brand).toBe('Brand Name');
      expect(item?.model).toBe('Model-123');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty CSV values array', () => {
      const item = mapCsvRowToItem({ values: [], fieldMap: {} });
      expect(item).toEqual({});
    });

    it('should handle missing fieldMap entries', () => {
      const values = ['Item', '100'];
      const fieldMap = { name: 0 }; // weight field not mapped

      const item = mapCsvRowToItem({ values, fieldMap });
      expect(item?.name).toBe('Item');
      expect(item?.weight).toBeUndefined();
    });

    it('should handle malformed JSON gracefully', () => {
      const values = ['Item', '{invalid json}'];
      const fieldMap = { name: 0, variants: 1 };

      const item = mapCsvRowToItem({ values, fieldMap });
      expect(item?.variants).toEqual([]);
    });

    it('should parse FAQs with various formats', () => {
      const input = '[{"question": "Q1?", "answer": "A1"}]';
      const result = parseFaqs(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ question: 'Q1?', answer: 'A1' });
    });
  });
});
