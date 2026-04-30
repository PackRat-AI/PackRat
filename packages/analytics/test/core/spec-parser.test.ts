import {
  extractSpecsFromRow,
  parseCapacityLiters,
  parseFillPower,
  parseGender,
  parseSeasons,
  parseTempRatingF,
  parseWaterproofRating,
  parseWeightGrams,
} from '@packrat/analytics/core/spec-parser';
import { describe, expect, it } from 'vitest';

describe('parseWeightGrams', () => {
  it('parses compound lbs + oz', () => {
    expect(parseWeightGrams('2 lbs 3 oz')).toBeCloseTo(992.23, 0);
  });

  it('parses grams', () => {
    expect(parseWeightGrams('850g ultralight')).toBe(850);
  });

  it('parses kilograms', () => {
    expect(parseWeightGrams('weighs 1.28 kg')).toBeCloseTo(1280, 0);
  });

  it('parses ounces', () => {
    expect(parseWeightGrams('only 35.9 oz')).toBeCloseTo(1017.95, 0);
  });

  it('parses pounds', () => {
    expect(parseWeightGrams('3 lbs packed')).toBeCloseTo(1360.78, 0);
  });

  it('returns null for no weight', () => {
    expect(parseWeightGrams('great tent')).toBeNull();
  });
});

describe('parseCapacityLiters', () => {
  it('parses liters', () => {
    expect(parseCapacityLiters('65L backpack')).toBe(65);
  });

  it('parses "liters" spelled out', () => {
    expect(parseCapacityLiters('40 liters capacity')).toBe(40);
  });

  it('returns null for no capacity', () => {
    expect(parseCapacityLiters('daypack')).toBeNull();
  });
});

describe('parseTempRatingF', () => {
  it('parses Fahrenheit', () => {
    expect(parseTempRatingF('rated to 20F')).toBe(20);
  });

  it('parses Celsius and converts', () => {
    expect(parseTempRatingF('comfort -6C')).toBe(21); // -6*9/5+32 = 21.2 → 21
  });

  it('parses range and takes lower bound', () => {
    expect(parseTempRatingF('20/30F rating')).toBe(20);
  });

  it('parses negative temps', () => {
    expect(parseTempRatingF('-40F extreme')).toBe(-40);
  });

  it('returns null for no temp', () => {
    expect(parseTempRatingF('warm sleeping bag')).toBeNull();
  });
});

describe('parseFillPower', () => {
  it('parses fill power', () => {
    expect(parseFillPower('850 fill down')).toBe(850);
  });

  it('parses with hyphen', () => {
    expect(parseFillPower('900-fill goose down')).toBe(900);
  });

  it('parses fp suffix', () => {
    expect(parseFillPower('700fp insulation')).toBe(700);
  });

  it('rejects out of range', () => {
    expect(parseFillPower('50 fill')).toBeNull();
  });

  it('returns null for no fill power', () => {
    expect(parseFillPower('synthetic jacket')).toBeNull();
  });
});

describe('parseWaterproofRating', () => {
  it('parses mm rating', () => {
    expect(parseWaterproofRating('20000mm waterproof')).toBe(20000);
  });

  it('parses with comma separators', () => {
    expect(parseWaterproofRating('20,000mm membrane')).toBe(20000);
  });

  it('parses K notation', () => {
    expect(parseWaterproofRating('20k mm rating')).toBe(20000);
  });

  it('returns null for no rating', () => {
    expect(parseWaterproofRating('water resistant')).toBeNull();
  });
});

describe('parseSeasons', () => {
  it('parses 3-season', () => {
    expect(parseSeasons('3-season tent')).toBe('3-season');
  });

  it('parses 4 season', () => {
    expect(parseSeasons('4 season mountaineering')).toBe('4-season');
  });

  it('returns null for no season info', () => {
    expect(parseSeasons('backpacking tent')).toBeNull();
  });
});

describe('parseGender', () => {
  it('parses mens', () => {
    expect(parseGender("men's medium jacket")).toBe('men');
  });

  it('parses womens', () => {
    expect(parseGender("women's large")).toBe('women');
  });

  it('parses unisex', () => {
    expect(parseGender('unisex fit')).toBe('unisex');
  });

  it('parses youth/kids', () => {
    expect(parseGender('kids sleeping bag')).toBe('youth');
  });

  it('returns null for no gender', () => {
    expect(parseGender('sleeping bag')).toBeNull();
  });
});

describe('extractSpecsFromRow', () => {
  it('extracts multiple specs from combined text', () => {
    const specs = extractSpecsFromRow({
      site: 'rei',
      name: "Men's 850 Fill Down Sleeping Bag 20F",
      brand: 'REI Co-op',
      category: 'Sleeping Bags',
      price: 299.95,
      product_url: 'https://rei.com/bag',
      description: 'Lightweight at 2 lbs 3 oz, rated to 20F, 850 fill power goose down',
      tags: '3-season camping',
    });

    expect(specs.site).toBe('rei');
    expect(specs.gender).toBe('men');
    expect(specs.fill_power).toBe(850);
    expect(specs.temp_rating_f).toBe(20);
    expect(specs.weight_grams).toBeCloseTo(992.23, 0);
    expect(specs.seasons).toBe('3-season');
  });

  it('returns nulls for products with no specs', () => {
    const specs = extractSpecsFromRow({
      site: 'rei',
      name: 'Camp Chair',
      brand: 'REI',
      category: 'Furniture',
      price: 49.95,
      product_url: '',
      description: 'Comfortable camp chair',
      tags: '',
    });

    expect(specs.weight_grams).toBeNull();
    expect(specs.fill_power).toBeNull();
    expect(specs.seasons).toBeNull();
  });
});
