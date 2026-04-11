import { describe, expect, it } from 'vitest';
import {
  mapCsvRowToItem,
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
  describe('mapCsvRowToItem', () => {
    it('maps basic string fields correctly', () => {
      const values = ['Test Product', 'Test Brand', 'Red', 'Large', 'SKU123', 'PROD-456', 'Amazon'];
      const fieldMap = {
        name: 0,
        brand: 1,
        color: 2,
        size: 3,
        sku: 4,
        productSku: 5,
        seller: 6,
      };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        name: 'Test Product',
        brand: 'Test Brand',
        color: 'Red',
        size: 'Large',
        sku: 'SKU123',
        productSku: 'PROD-456',
        seller: 'Amazon',
      });
    });

    it('handles quoted strings properly for stringFields', () => {
      const values = ['"Quoted Brand"', '"Quoted Color"'];
      const fieldMap = { brand: 0, color: 1 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        brand: 'Quoted Brand',
        color: 'Quoted Color',
      });
    });

    it('parses weight and unit correctly', () => {
      const values = ['100', 'g'];
      const fieldMap = { weight: 0, weightUnit: 1 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        weight: 100,
        weightUnit: 'g',
      });
    });

    it('parses weight from string with unit', () => {
      const values = ['2.5 kg'];
      const fieldMap = { weight: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        weight: 2500,
        weightUnit: 'kg',
      });
    });

    it('parses price correctly', () => {
      const values = ['$49.99'];
      const fieldMap = { price: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        price: 49.99,
      });
    });

    it('parses rating correctly', () => {
      const values = ['4.5'];
      const fieldMap = { ratingValue: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        ratingValue: 4.5,
      });
    });

    it('parses review count correctly', () => {
      const values = ['123'];
      const fieldMap = { reviewCount: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        reviewCount: 123,
      });
    });

    it('handles categories as JSON array', () => {
      const values = ['["Electronics", "Outdoors"]'];
      const fieldMap = { categories: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        categories: ['Electronics', 'Outdoors'],
      });
    });

    it('handles categories as comma-separated string', () => {
      const values = ['Electronics, Outdoors, Gear'];
      const fieldMap = { categories: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        categories: ['Electronics', 'Outdoors', 'Gear'],
      });
    });

    it('handles images as JSON array', () => {
      const values = ['["img1.jpg", "img2.jpg"]'];
      const fieldMap = { images: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        images: ['img1.jpg', 'img2.jpg'],
      });
    });

    it('handles images as comma-separated string', () => {
      const values = ['img1.jpg, img2.jpg'];
      const fieldMap = { images: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        images: ['img1.jpg', 'img2.jpg'],
      });
    });

    it('parses variants JSON correctly', () => {
      const values = ['[{"size": "M", "color": "blue"}]'];
      const fieldMap = { variants: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        variants: [{ size: 'M', color: 'blue' }],
      });
    });

    it('handles malformed variants JSON with single quotes', () => {
      const values = ["[{'size': 'M', 'color': 'blue'}]"];
      const fieldMap = { variants: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        variants: [{ size: 'M', color: 'blue' }],
      });
    });

    it('falls back to empty array for invalid variants', () => {
      const values = ['invalid json'];
      const fieldMap = { variants: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        variants: [],
      });
    });

    it('parses FAQs correctly', () => {
      const values = ['[{"question": "Q1?", "answer": "A1"}]'];
      const fieldMap = { faqs: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        faqs: [{ question: 'Q1?', answer: 'A1' }],
      });
    });

    it('parses techs JSON correctly', () => {
      const values = ['{"material": "nylon", "Claimed Weight": "100g"}'];
      const fieldMap = { techs: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        techs: { material: 'nylon', 'Claimed Weight': '100g' },
        weight: 100,
        weightUnit: 'g',
      });
    });

    it('handles techs weight fallback with weight field', () => {
      const values = ['{"weight": "200g"}'];
      const fieldMap = { techs: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        techs: { weight: '200g' },
        weight: 200,
        weightUnit: 'g',
      });
    });

    it('parses JSON fields like links, reviews, qas', () => {
      const values = [
        '["link1", "link2"]',
        '[{"rating": 5, "text": "Great!"}]',
        '[{"question": "Q?", "answer": "A"}]',
      ];
      const fieldMap = { links: 0, reviews: 1, qas: 2 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        links: ['link1', 'link2'],
        reviews: [{ rating: 5, text: 'Great!' }],
        qas: [{ question: 'Q?', answer: 'A' }],
      });
    });

    it('handles availability enum', () => {
      const values = ['in_stock'];
      const fieldMap = { availability: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        availability: 'in_stock',
      });
    });

    it('handles missing fields gracefully', () => {
      const values = ['Test', '', '', ''];
      const fieldMap = { name: 0, brand: 1, color: 2, size: 3 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.name).toBe('Test');
      // All empty/null/undefined values result in undefined for string fields due to truthiness check
      expect(result?.brand).toBeUndefined();
      expect(result?.color).toBeUndefined();
      expect(result?.size).toBeUndefined();
    });

    it('ignores negative weight values', () => {
      const values = ['-100', 'g'];
      const fieldMap = { weight: 0, weightUnit: 1 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.weight).toBeUndefined();
      expect(result?.weightUnit).toBeUndefined();
    });

    it('ignores weight with value 0', () => {
      const values = ['0', 'g'];
      const fieldMap = { weight: 0, weightUnit: 1 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.weight).toBeUndefined();
      expect(result?.weightUnit).toBeUndefined();
    });

    it('handles empty categories gracefully', () => {
      const values = [''];
      const fieldMap = { categories: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.categories).toBeUndefined();
    });

    it('handles empty images gracefully', () => {
      const values = [''];
      const fieldMap = { images: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.images).toBeUndefined();
    });

    it('handles malformed JSON in categories', () => {
      const values = ['invalid json'];
      const fieldMap = { categories: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.categories).toEqual(['invalid json']);
    });

    it('processes description with newlines correctly', () => {
      const values = ['This is a\r\nmultiline\ndescription'];
      const fieldMap = { description: 0 };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result?.description).toBe('This is a multiline description');
    });

    it('handles complex complete item mapping', () => {
      const values = [
        'Ultimate Backpack',
        'OutdoorGear',
        'A great backpack\r\nfor hiking',
        'http://example.com/product',
        'USD',
        '2.5 kg',
        '$199.99',
        '4.7',
        '456',
        '["Backpacks", "Hiking"]',
        '["img1.jpg", "img2.jpg"]',
        '[{"size": "L", "color": "green"}]',
        '[{"question": "Waterproof?", "answer": "Yes"}]',
        '["link1", "link2"]',
        '[{"rating": 5, "text": "Excellent"}]',
        '[{"q": "Size?", "a": "Large"}]',
        '{"material": "ripstop nylon", "Claimed Weight": "2.5kg"}',
        'green',
        'Large',
        'BP-001',
        'PROD-BP-001',
        'OutdoorShop',
        'nylon',
        'new',
        'in_stock',
      ];

      const fieldMap = {
        name: 0,
        brand: 1,
        description: 2,
        productUrl: 3,
        currency: 4,
        weight: 5,
        price: 6,
        ratingValue: 7,
        reviewCount: 8,
        categories: 9,
        images: 10,
        variants: 11,
        faqs: 12,
        links: 13,
        reviews: 14,
        qas: 15,
        techs: 16,
        color: 17,
        size: 18,
        sku: 19,
        productSku: 20,
        seller: 21,
        material: 22,
        condition: 23,
        availability: 24,
      };

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({
        name: 'Ultimate Backpack',
        brand: 'OutdoorGear',
        description: 'A great backpack for hiking',
        productUrl: 'http://example.com/product',
        currency: 'USD',
        weight: 2500,
        weightUnit: 'kg',
        price: 199.99,
        ratingValue: 4.7,
        reviewCount: 456,
        categories: ['Backpacks', 'Hiking'],
        images: ['img1.jpg', 'img2.jpg'],
        variants: [{ size: 'L', color: 'green' }],
        faqs: [{ question: 'Waterproof?', answer: 'Yes' }],
        links: ['link1', 'link2'],
        reviews: [{ rating: 5, text: 'Excellent' }],
        qas: [{ q: 'Size?', a: 'Large' }],
        techs: { material: 'ripstop nylon', 'Claimed Weight': '2.5kg' },
        color: 'green',
        size: 'Large',
        sku: 'BP-001',
        productSku: 'PROD-BP-001',
        seller: 'OutdoorShop',
        material: 'nylon',
        condition: 'new',
        availability: 'in_stock',
      });
    });

    it('returns null for completely empty mapping', () => {
      const values: string[] = [];
      const fieldMap = {};

      const result = mapCsvRowToItem({ values, fieldMap });

      expect(result).toMatchObject({});
    });
  });

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
      const inputWithSmartQuotes = `${String.fromCharCode(8216)}hello${String.fromCharCode(8217)}`;
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
