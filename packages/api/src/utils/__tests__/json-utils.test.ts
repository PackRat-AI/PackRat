import { describe, expect, it } from 'vitest';
import { isJsonlFile, mapJsonRowToItem } from '../json-utils';

describe('json-utils', () => {
  describe('isJsonlFile', () => {
    it('returns true for .jsonl extension', () => {
      expect(isJsonlFile('v2/brand/file.jsonl')).toBe(true);
    });

    it('returns true for .ndjson extension', () => {
      expect(isJsonlFile('v2/brand/file.ndjson')).toBe(true);
    });

    it('returns true for uppercase extensions', () => {
      expect(isJsonlFile('FILE.JSONL')).toBe(true);
      expect(isJsonlFile('FILE.NDJSON')).toBe(true);
    });

    it('returns false for .csv extension', () => {
      expect(isJsonlFile('v2/brand/file.csv')).toBe(false);
    });

    it('returns false for .json extension', () => {
      expect(isJsonlFile('v2/brand/file.json')).toBe(false);
    });
  });

  describe('mapJsonRowToItem', () => {
    it('maps basic string scalar fields', () => {
      const result = mapJsonRowToItem({
        name: '  Trail Shoe  ',
        brand: 'Salomon',
        model: 'XT-6',
        color: 'Black',
        size: 'M',
        sku: 'SKU-001',
        productSku: 'PROD-001',
        seller: 'REI',
        material: 'Mesh',
        condition: 'new',
        currency: 'USD',
        productUrl: '  https://example.com  ',
      });

      expect(result).toMatchObject({
        name: 'Trail Shoe',
        brand: 'Salomon',
        model: 'XT-6',
        color: 'Black',
        size: 'M',
        sku: 'SKU-001',
        productSku: 'PROD-001',
        seller: 'REI',
        material: 'Mesh',
        condition: 'new',
        currency: 'USD',
        productUrl: 'https://example.com',
      });
    });

    it('strips newlines from description', () => {
      const result = mapJsonRowToItem({
        description: 'Line one\nLine two\r\nLine three',
      });
      expect(result?.description).toBe('Line one Line two Line three');
    });

    it('maps reviewCount from number', () => {
      const result = mapJsonRowToItem({ reviewCount: 42.9 });
      expect(result?.reviewCount).toBe(42);
    });

    it('maps a sub-1 reviewCount number to 0 (|| 0 fallback)', () => {
      // Math.trunc(0.4) === 0, so the `|| 0` fallback branch must run.
      const result = mapJsonRowToItem({ reviewCount: 0.4 });
      expect(result?.reviewCount).toBe(0);
    });

    it('parses faqs and techs supplied as JSON strings', () => {
      const result = mapJsonRowToItem({
        name: 'X',
        faqs: '[{"question":"Q1","answer":"A1"}]',
        techs: '{"Material":"Nylon","Capacity":"40L"}',
      });
      expect(result?.faqs).toBeDefined();
      expect(result?.techs).toMatchObject({ Material: 'Nylon', Capacity: '40L' });
    });

    it('falls back to an empty faqs array when the faqs string is malformed', () => {
      const result = mapJsonRowToItem({ name: 'Y', faqs: '{not valid json' });
      expect(result?.faqs).toEqual([]);
    });

    it('maps techs to {} when the techs string parses to a JSON array', () => {
      // A JSON-array string is structurally valid JSON but not a key/value
      // record, so it must collapse to {} rather than index into the array.
      const result = mapJsonRowToItem({ name: 'Z', techs: '[1,2,3]' });
      expect(result?.techs).toEqual({});
    });

    it('maps techs to {} when the techs string is malformed', () => {
      // safeJsonParse returns [] on malformed input, which Array.isArray
      // collapses to {} — techs must never be left as an array.
      const result = mapJsonRowToItem({ name: 'Z', techs: '{not valid json' });
      expect(result?.techs).toEqual({});
    });

    it('does not derive weight from techs when no claimed/weight key is present', () => {
      // techs is a valid record but lacks 'Claimed Weight'/'weight', so the
      // claimedWeight-falsy branch of the weight fallback must run and leave
      // weight unset.
      const result = mapJsonRowToItem({ name: 'Z', techs: '{"Material":"Nylon"}' });
      expect(result?.techs).toEqual({ Material: 'Nylon' });
      expect(result?.weight).toBeUndefined();
      expect(result?.weightUnit).toBeUndefined();
    });

    it('maps reviewCount from string', () => {
      const result = mapJsonRowToItem({ reviewCount: '128' });
      expect(result?.reviewCount).toBe(128);
    });

    it('defaults reviewCount to 0 for invalid strings', () => {
      const result = mapJsonRowToItem({ reviewCount: 'not-a-number' });
      expect(result?.reviewCount).toBe(0);
    });

    it('defaults reviewCount to 0 for missing value', () => {
      const result = mapJsonRowToItem({});
      expect(result?.reviewCount).toBe(0);
    });

    it('maps price from number', () => {
      const result = mapJsonRowToItem({ price: 149.99 });
      expect(result?.price).toBe(149.99);
    });

    it('maps price from string', () => {
      const result = mapJsonRowToItem({ price: '$129.00' });
      expect(result?.price).toBeCloseTo(129.0);
    });

    it('ignores invalid price strings', () => {
      const result = mapJsonRowToItem({ price: 'contact for price' });
      expect(result?.price).toBeUndefined();
    });

    it('maps ratingValue from number', () => {
      const result = mapJsonRowToItem({ ratingValue: 4.5 });
      expect(result?.ratingValue).toBe(4.5);
    });

    it('maps ratingValue from string', () => {
      const result = mapJsonRowToItem({ ratingValue: '4.2' });
      expect(result?.ratingValue).toBeCloseTo(4.2);
    });

    it('sets ratingValue to null for invalid string', () => {
      const result = mapJsonRowToItem({ ratingValue: 'N/A' });
      expect(result?.ratingValue).toBeNull();
    });

    it('passes categories array through', () => {
      const result = mapJsonRowToItem({ categories: ['Footwear', 'Trail Running'] });
      expect(result?.categories).toEqual(['Footwear', 'Trail Running']);
    });

    it('filters non-string values from categories array', () => {
      const result = mapJsonRowToItem({ categories: ['Footwear', 42, null, 'Trail'] });
      expect(result?.categories).toEqual(['Footwear', 'Trail']);
    });

    it('splits categories from comma-separated string', () => {
      const result = mapJsonRowToItem({ categories: 'Footwear, Trail Running' });
      expect(result?.categories).toEqual(['Footwear', 'Trail Running']);
    });

    it('parses categories from JSON array string', () => {
      const result = mapJsonRowToItem({ categories: '["Footwear","Trail Running"]' });
      expect(result?.categories).toEqual(['Footwear', 'Trail Running']);
    });

    it('filters non-strings from JSON array string categories', () => {
      const result = mapJsonRowToItem({ categories: '["Footwear",42,null]' });
      expect(result?.categories).toEqual(['Footwear']);
    });

    it('wraps malformed JSON array categories in an array', () => {
      const result = mapJsonRowToItem({ categories: '["Footwear",' });
      expect(result?.categories).toEqual(['["Footwear",']);
    });

    it('wraps unparseable categories string in array', () => {
      const result = mapJsonRowToItem({ categories: 'Footwear' });
      expect(result?.categories).toEqual(['Footwear']);
    });

    it('ignores blank category strings', () => {
      const result = mapJsonRowToItem({ categories: '   ' });
      expect(result?.categories).toBeUndefined();
    });

    it('passes images array through, filtering non-strings', () => {
      const result = mapJsonRowToItem({ images: ['https://img1.jpg', 42, 'https://img2.jpg'] });
      expect(result?.images).toEqual(['https://img1.jpg', 'https://img2.jpg']);
    });

    it('maps weight from number with unit string', () => {
      const result = mapJsonRowToItem({ weight: 280, weightUnit: 'g' });
      expect(result?.weight).toBe(280);
      expect(result?.weightUnit).toBe('g');
    });

    it('maps weight from string', () => {
      const result = mapJsonRowToItem({ weight: '1.5 lbs' });
      expect(result?.weight).toBeGreaterThan(0);
    });

    it('ignores non-positive weight strings', () => {
      const result = mapJsonRowToItem({ weight: '-1 lb' });
      expect(result?.weight).toBeUndefined();
      expect(result?.weightUnit).toBeUndefined();
    });

    it('ignores weight of zero', () => {
      const result = mapJsonRowToItem({ weight: 0 });
      expect(result?.weight).toBeUndefined();
    });

    it('passes variants, links, reviews, qas arrays through', () => {
      const variants = [{ color: 'Red' }];
      const links = [{ url: 'https://example.com' }];
      const reviews = [{ text: 'Great!' }];
      const qas = [{ question: 'Size?', answer: 'True to size' }];
      const result = mapJsonRowToItem({ variants, links, reviews, qas });
      expect(result?.variants).toBe(variants);
      expect(result?.links).toBe(links);
      expect(result?.reviews).toBe(reviews);
      expect(result?.qas).toBe(qas);
    });

    it('passes faqs array through', () => {
      const faqs = [{ question: 'Is it waterproof?', answer: 'Yes' }];
      const result = mapJsonRowToItem({ faqs });
      expect(result?.faqs).toBe(faqs);
    });

    it('passes techs object through', () => {
      const techs = { 'Claimed Weight': '280g', Material: 'Mesh' };
      const result = mapJsonRowToItem({ techs });
      expect(result?.techs).toEqual(techs);
    });

    it('parses techs from JSON string', () => {
      const result = mapJsonRowToItem({
        techs: '{"Claimed Weight":"280g","Material":"Mesh"}',
      });
      expect(result?.techs).toEqual({ 'Claimed Weight': '280g', Material: 'Mesh' });
    });

    it('maps array-shaped techs strings to an empty object', () => {
      const result = mapJsonRowToItem({ techs: '["unexpected"]' });
      expect(result?.techs).toEqual({});
    });

    it('falls back to weight from techs Claimed Weight field', () => {
      const result = mapJsonRowToItem({ techs: { 'Claimed Weight': '280g' } });
      expect(result?.weight).toBeGreaterThan(0);
    });

    it('falls back to weight from techs weight field', () => {
      const result = mapJsonRowToItem({ techs: { weight: '1.2 lbs' } });
      expect(result?.weight).toBeGreaterThan(0);
    });

    it('ignores zero weight from techs Claimed Weight field', () => {
      const result = mapJsonRowToItem({ techs: { 'Claimed Weight': '0 g' } });
      expect(result?.weight).toBeUndefined();
      expect(result?.weightUnit).toBeUndefined();
    });

    it('maps availability from valid string', () => {
      const result = mapJsonRowToItem({ availability: 'in_stock' });
      expect(result?.availability).toBe('in_stock');
    });

    it('ignores invalid availability value', () => {
      const result = mapJsonRowToItem({ availability: 'InStock' });
      expect(result?.availability).toBeUndefined();
    });

    it('returns empty item for empty input object', () => {
      const result = mapJsonRowToItem({});
      expect(result).toBeDefined();
      expect(result?.reviewCount).toBe(0);
    });

    it('ignores non-string/non-number values for scalar fields', () => {
      const result = mapJsonRowToItem({ name: 42, brand: null, price: [] });
      expect(result?.name).toBeUndefined();
      expect(result?.brand).toBeUndefined();
      expect(result?.price).toBeUndefined();
    });
  });
});
