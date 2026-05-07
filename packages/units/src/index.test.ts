import configureMeasurements from 'convert-units';
import mass from 'convert-units/definitions/mass';
import { describe, expect, it } from 'vitest';

// configure a minimal mass-only converter for cross-validation
const convert = configureMeasurements<
  'mass',
  'metric' | 'imperial',
  'mcg' | 'mg' | 'g' | 'kg' | 'mt' | 'oz' | 'lb' | 'st' | 't'
>({ mass });

import {
  displayWeight,
  fromGrams,
  isWeightUnit,
  normalize,
  convert as packratConvert,
  parseWeightUnit,
  WEIGHT_UNITS,
} from './index';

// ---------------------------------------------------------------------------
// NIST avoirdupois exact values (informational constants for assertions)
// ---------------------------------------------------------------------------
const OZ_TO_G = 28.349523125; // exactly
const LB_TO_G = 453.59237; // exactly
const KG_TO_G = 1000; // exactly

// ---------------------------------------------------------------------------
// WEIGHT_UNITS constant
// ---------------------------------------------------------------------------

describe('WEIGHT_UNITS', () => {
  it('contains exactly the four supported units', () => {
    expect([...WEIGHT_UNITS].sort()).toEqual(['g', 'kg', 'lb', 'oz']);
  });

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(WEIGHT_UNITS)).toBe(true);
  });

  it('every element passes isWeightUnit', () => {
    for (const u of WEIGHT_UNITS) {
      expect(isWeightUnit(u)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// normalize (→ grams)
// ---------------------------------------------------------------------------

describe('normalize (→ grams)', () => {
  it('g is a no-op', () => {
    expect(normalize(100, 'g')).toBe(100);
    expect(normalize(0, 'g')).toBe(0);
    expect(normalize(1, 'g')).toBe(1);
    expect(normalize(0.001, 'g')).toBe(0.001);
  });

  it('kg → g: 1 kg = 1000 g exactly', () => {
    expect(normalize(1, 'kg')).toBe(KG_TO_G);
    expect(normalize(2.5, 'kg')).toBe(2500);
    expect(normalize(0.5, 'kg')).toBe(500);
    expect(normalize(0.001, 'kg')).toBeCloseTo(1, 10);
    expect(normalize(10, 'kg')).toBe(10_000);
    expect(normalize(100, 'kg')).toBe(100_000);
  });

  it('oz → g: 1 oz = 28.349523125 g (NIST exact)', () => {
    expect(normalize(1, 'oz')).toBe(OZ_TO_G);
    expect(normalize(2, 'oz')).toBeCloseTo(OZ_TO_G * 2, 8);
    expect(normalize(0.5, 'oz')).toBeCloseTo(OZ_TO_G * 0.5, 8);
    expect(normalize(16, 'oz')).toBeCloseTo(LB_TO_G, 8); // 1 lb worth of oz
    expect(normalize(8, 'oz')).toBeCloseTo(LB_TO_G / 2, 8);
    expect(normalize(32, 'oz')).toBeCloseTo(LB_TO_G * 2, 8);
  });

  it('lb → g: 1 lb = 453.59237 g (NIST exact)', () => {
    expect(normalize(1, 'lb')).toBe(LB_TO_G);
    expect(normalize(2, 'lb')).toBe(LB_TO_G * 2);
    expect(normalize(0.5, 'lb')).toBeCloseTo(LB_TO_G * 0.5, 8);
    expect(normalize(3, 'lb')).toBeCloseTo(LB_TO_G * 3, 8);
    expect(normalize(10, 'lb')).toBeCloseTo(LB_TO_G * 10, 5);
  });

  it('handles fractional ultralight gear weights', () => {
    expect(normalize(0.1, 'oz')).toBeCloseTo(OZ_TO_G * 0.1, 8);
    expect(normalize(0.25, 'oz')).toBeCloseTo(OZ_TO_G * 0.25, 8);
    expect(normalize(0.3, 'oz')).toBeCloseTo(OZ_TO_G * 0.3, 8);
    expect(normalize(0.5, 'oz')).toBeCloseTo(OZ_TO_G * 0.5, 8); // ultralight stake
    expect(normalize(3.2, 'oz')).toBeCloseTo(OZ_TO_G * 3.2, 5); // water filter
  });

  it('handles typical backpacking item weights', () => {
    // Common gear weights in ounces
    const oz = (w: number) => normalize(w, 'oz');
    expect(oz(1.0)).toBeCloseTo(OZ_TO_G, 5); // headlamp
    expect(oz(4.1)).toBeCloseTo(OZ_TO_G * 4.1, 4); // rain jacket
    expect(oz(8.0)).toBeCloseTo(OZ_TO_G * 8.0, 4); // sleeping pad
    expect(oz(24.0)).toBeCloseTo(OZ_TO_G * 24.0, 4); // tent fly
    expect(oz(48.0)).toBeCloseTo(OZ_TO_G * 48.0, 4); // 3-lb tent = 48 oz

    // Common gear weights in lbs
    const lb = (w: number) => normalize(w, 'lb');
    expect(lb(1.0)).toBeCloseTo(LB_TO_G, 5);
    expect(lb(1.5)).toBeCloseTo(LB_TO_G * 1.5, 4);
    expect(lb(2.5)).toBeCloseTo(LB_TO_G * 2.5, 4);
    expect(lb(4.0)).toBeCloseTo(LB_TO_G * 4.0, 4);

    // Common gear weights in kg
    const kg = (w: number) => normalize(w, 'kg');
    expect(kg(0.8)).toBeCloseTo(800, 5);
    expect(kg(1.1)).toBeCloseTo(1100, 5);
    expect(kg(1.5)).toBeCloseTo(1500, 5);
    expect(kg(2.0)).toBeCloseTo(2000, 5);
  });

  it('handles zero for all units', () => {
    expect(normalize(0, 'g')).toBe(0);
    expect(normalize(0, 'oz')).toBe(0);
    expect(normalize(0, 'lb')).toBe(0);
    expect(normalize(0, 'kg')).toBe(0);
  });

  it('handles very small weights', () => {
    expect(normalize(0.001, 'oz')).toBeCloseTo(OZ_TO_G * 0.001, 10);
    expect(normalize(0.001, 'lb')).toBeCloseTo(LB_TO_G * 0.001, 10);
    expect(normalize(0.001, 'kg')).toBeCloseTo(1, 10);
  });

  it('handles very large weights', () => {
    expect(normalize(1000, 'kg')).toBe(1_000_000);
    expect(normalize(1000, 'lb')).toBeCloseTo(LB_TO_G * 1000, 2);
    expect(normalize(1000, 'oz')).toBeCloseTo(OZ_TO_G * 1000, 2);
  });

  it('handles negative weights (sign preserving)', () => {
    expect(normalize(-1, 'kg')).toBe(-1000);
    expect(normalize(-1, 'oz')).toBe(-OZ_TO_G);
    expect(normalize(-1, 'lb')).toBe(-LB_TO_G);
  });
});

// ---------------------------------------------------------------------------
// fromGrams (grams →)
// ---------------------------------------------------------------------------

describe('fromGrams (grams →)', () => {
  it('g is a no-op', () => {
    expect(fromGrams(100, 'g')).toBe(100);
    expect(fromGrams(0, 'g')).toBe(0);
    expect(fromGrams(1, 'g')).toBe(1);
  });

  it('g → kg', () => {
    expect(fromGrams(KG_TO_G, 'kg')).toBe(1);
    expect(fromGrams(500, 'kg')).toBe(0.5);
    expect(fromGrams(2500, 'kg')).toBe(2.5);
    expect(fromGrams(100, 'kg')).toBe(0.1);
    expect(fromGrams(1, 'kg')).toBe(0.001);
    expect(fromGrams(1_000_000, 'kg')).toBe(1000);
  });

  it('g → oz: 28.349523125 g = 1 oz (NIST exact)', () => {
    expect(fromGrams(OZ_TO_G, 'oz')).toBe(1);
    expect(fromGrams(OZ_TO_G * 2, 'oz')).toBeCloseTo(2, 10);
    expect(fromGrams(OZ_TO_G * 0.5, 'oz')).toBeCloseTo(0.5, 10);
    expect(fromGrams(OZ_TO_G * 16, 'oz')).toBeCloseTo(16, 8);
    expect(fromGrams(0, 'oz')).toBe(0);
    expect(fromGrams(1_000_000, 'oz')).toBeCloseTo(35273.96, 1);
  });

  it('g → lb: 453.59237 g = 1 lb (NIST exact)', () => {
    expect(fromGrams(LB_TO_G, 'lb')).toBe(1);
    expect(fromGrams(LB_TO_G * 2, 'lb')).toBeCloseTo(2, 10);
    expect(fromGrams(LB_TO_G * 0.5, 'lb')).toBeCloseTo(0.5, 10);
    expect(fromGrams(1000, 'lb')).toBeCloseTo(1000 / LB_TO_G, 10);
    expect(fromGrams(0, 'lb')).toBe(0);
    expect(fromGrams(1_000_000, 'lb')).toBeCloseTo(2204.62, 0);
  });

  it('handles very small gram values', () => {
    expect(fromGrams(1, 'kg')).toBe(0.001);
    expect(fromGrams(1, 'oz')).toBeCloseTo(1 / OZ_TO_G, 8);
    expect(fromGrams(1, 'lb')).toBeCloseTo(1 / LB_TO_G, 8);
  });

  it('handles negative grams', () => {
    expect(fromGrams(-1000, 'kg')).toBe(-1);
    expect(fromGrams(-OZ_TO_G, 'oz')).toBeCloseTo(-1, 10);
    expect(fromGrams(-LB_TO_G, 'lb')).toBeCloseTo(-1, 10);
  });
});

// ---------------------------------------------------------------------------
// Round-trip correctness: normalize / fromGrams
// ---------------------------------------------------------------------------

describe('normalize / fromGrams round-trips', () => {
  const units = ['g', 'kg', 'oz', 'lb'] as const;
  // Wide range of real backpacking weights + boundary values
  const testWeights = [
    0.01, 0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3.2, 5, 8, 10, 16, 24, 28, 32, 48, 100, 200, 453.59237,
    500, 1000, 5000,
  ];

  for (const unit of units) {
    for (const weight of testWeights) {
      it(`${weight} ${unit} → g → ${unit} round-trips exactly`, () => {
        const grams = normalize(weight, unit);
        const back = fromGrams(grams, unit);
        expect(back).toBeCloseTo(weight, 10);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// convert (cross-unit)
// ---------------------------------------------------------------------------

describe('convert', () => {
  it('same unit returns input unchanged (no float ops)', () => {
    expect(packratConvert(5, 'g', 'g')).toBe(5);
    expect(packratConvert(5, 'oz', 'oz')).toBe(5);
    expect(packratConvert(5, 'lb', 'lb')).toBe(5);
    expect(packratConvert(5, 'kg', 'kg')).toBe(5);
    expect(packratConvert(0, 'oz', 'oz')).toBe(0);
  });

  it('oz → lb: 16 oz = 1 lb', () => {
    expect(packratConvert(16, 'oz', 'lb')).toBeCloseTo(1, 10);
    expect(packratConvert(8, 'oz', 'lb')).toBeCloseTo(0.5, 10);
    expect(packratConvert(32, 'oz', 'lb')).toBeCloseTo(2, 10);
  });

  it('lb → oz: 1 lb = 16 oz', () => {
    expect(packratConvert(1, 'lb', 'oz')).toBeCloseTo(16, 10);
    expect(packratConvert(0.5, 'lb', 'oz')).toBeCloseTo(8, 10);
    expect(packratConvert(2, 'lb', 'oz')).toBeCloseTo(32, 10);
  });

  it('kg → lb: 1 kg ≈ 2.20462 lb', () => {
    expect(packratConvert(1, 'kg', 'lb')).toBeCloseTo(2.20462, 4);
    expect(packratConvert(2, 'kg', 'lb')).toBeCloseTo(4.40924, 4);
    expect(packratConvert(0.5, 'kg', 'lb')).toBeCloseTo(1.10231, 4);
  });

  it('lb → kg: 1 lb ≈ 0.453592 kg', () => {
    expect(packratConvert(1, 'lb', 'kg')).toBeCloseTo(0.453592, 5);
    expect(packratConvert(2.2046, 'lb', 'kg')).toBeCloseTo(1, 3);
    expect(packratConvert(10, 'lb', 'kg')).toBeCloseTo(4.53592, 4);
  });

  it('g → oz and back', () => {
    expect(packratConvert(OZ_TO_G, 'g', 'oz')).toBeCloseTo(1, 10);
    expect(packratConvert(100, 'g', 'oz')).toBeCloseTo(100 / OZ_TO_G, 8);
    expect(packratConvert(1000, 'g', 'oz')).toBeCloseTo(1000 / OZ_TO_G, 6);
  });

  it('g → kg and back', () => {
    expect(packratConvert(1000, 'g', 'kg')).toBe(1);
    expect(packratConvert(500, 'g', 'kg')).toBe(0.5);
    expect(packratConvert(1, 'kg', 'g')).toBe(1000);
  });

  it('g → lb and back', () => {
    expect(packratConvert(LB_TO_G, 'g', 'lb')).toBeCloseTo(1, 10);
    expect(packratConvert(100, 'g', 'lb')).toBeCloseTo(100 / LB_TO_G, 8);
  });

  it('kg → oz', () => {
    expect(packratConvert(1, 'kg', 'oz')).toBeCloseTo(1000 / OZ_TO_G, 5);
    expect(packratConvert(0.5, 'kg', 'oz')).toBeCloseTo(500 / OZ_TO_G, 5);
  });

  it('oz → kg', () => {
    expect(packratConvert(1, 'oz', 'kg')).toBeCloseTo(OZ_TO_G / 1000, 8);
    expect(packratConvert(35.274, 'oz', 'kg')).toBeCloseTo(1, 2);
  });

  it('all 12 unit pairs are round-trip exact at weight = 42', () => {
    const pairs: Array<['g' | 'kg' | 'oz' | 'lb', 'g' | 'kg' | 'oz' | 'lb']> = [
      ['g', 'oz'],
      ['g', 'lb'],
      ['g', 'kg'],
      ['oz', 'lb'],
      ['oz', 'kg'],
      ['oz', 'g'],
      ['lb', 'kg'],
      ['lb', 'g'],
      ['lb', 'oz'],
      ['kg', 'g'],
      ['kg', 'lb'],
      ['kg', 'oz'],
    ];
    for (const [a, b] of pairs) {
      const converted = packratConvert(42, a, b);
      const back = packratConvert(converted, b, a);
      expect(back).toBeCloseTo(42, 10);
    }
  });

  it('round-trips multiple weights for oz↔lb', () => {
    for (const oz of [0.5, 1, 2, 4, 8, 16, 32, 64]) {
      const lb = packratConvert(oz, 'oz', 'lb');
      const back = packratConvert(lb, 'lb', 'oz');
      expect(back).toBeCloseTo(oz, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// displayWeight
// ---------------------------------------------------------------------------

describe('displayWeight', () => {
  it('rounds to 2 decimal places by default', () => {
    expect(displayWeight(normalize(100, 'oz'), 'oz')).toBe(100);
    expect(displayWeight(normalize(1.5, 'lb'), 'lb')).toBe(1.5);
    expect(displayWeight(normalize(2.5, 'kg'), 'kg')).toBe(2.5);
  });

  it('strips trailing zeros', () => {
    expect(displayWeight(1000, 'kg')).toBe(1); // not 1.00
    expect(displayWeight(LB_TO_G, 'lb')).toBe(1); // not 1.00
    expect(displayWeight(500, 'kg')).toBe(0.5); // not 0.50
  });

  it('respects precision = 0', () => {
    expect(displayWeight(100, 'g', 0)).toBe(100);
    expect(displayWeight(28.7, 'g', 0)).toBe(29);
  });

  it('respects precision = 1', () => {
    expect(displayWeight(1234.56, 'g', 1)).toBe(1234.6);
    expect(displayWeight(normalize(1.23, 'oz'), 'oz', 1)).toBe(1.2);
  });

  it('respects precision = 4', () => {
    expect(displayWeight(OZ_TO_G, 'oz', 4)).toBe(1);
    expect(displayWeight(100, 'g', 4)).toBe(100);
  });

  it('handles typical backpacking display values', () => {
    // 3.2 oz water filter
    const grams = normalize(3.2, 'oz');
    expect(displayWeight(grams, 'oz')).toBe(3.2);
    // 1.1 kg tent displayed in kg
    const tentG = normalize(1.1, 'kg');
    expect(displayWeight(tentG, 'kg')).toBe(1.1);
    // tent in lb ≈ 2.43
    expect(displayWeight(tentG, 'lb')).toBeCloseTo(2.43, 1);
  });

  it('handles ultralight items', () => {
    // 0.5 oz stake → 14.17 g
    const stakeG = normalize(0.5, 'oz');
    expect(displayWeight(stakeG, 'oz')).toBe(0.5);
    expect(displayWeight(stakeG, 'g')).toBeCloseTo(14.17, 1);
  });

  it('zero weight displays as 0', () => {
    expect(displayWeight(0, 'oz')).toBe(0);
    expect(displayWeight(0, 'lb')).toBe(0);
    expect(displayWeight(0, 'kg')).toBe(0);
    expect(displayWeight(0, 'g')).toBe(0);
  });

  it('round-trips through normalize: displayWeight(normalize(w, u), u) = w for clean values', () => {
    const cases: Array<[number, 'g' | 'kg' | 'oz' | 'lb']> = [
      [100, 'g'],
      [1.5, 'kg'],
      [2.5, 'lb'],
      [8, 'oz'],
      [16, 'oz'],
      [0.5, 'kg'],
      [250, 'g'],
    ];
    for (const [w, u] of cases) {
      expect(displayWeight(normalize(w, u), u)).toBe(w);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-validation: @packrat/units vs convert-units
// ---------------------------------------------------------------------------

describe('cross-validation against convert-units library', () => {
  // We use precision=2 (±0.005) since convert-units may use slightly different
  // intermediate precision, but all values should match to at least 2 decimal places.

  it('normalize g→g matches convert-units', () => {
    for (const w of [1, 10, 100, 500, 1000]) {
      expect(normalize(w, 'g')).toBe(w); // trivially same
    }
  });

  it('normalize kg→g matches convert-units', () => {
    for (const w of [0.1, 0.5, 1, 1.5, 2, 5, 10]) {
      const expected = convert(w).from('kg').to('g') as number;
      expect(normalize(w, 'kg')).toBeCloseTo(expected, 2);
    }
  });

  it('normalize oz→g matches convert-units', () => {
    for (const w of [0.5, 1, 2, 4, 8, 16, 24, 32]) {
      const expected = convert(w).from('oz').to('g') as number;
      expect(normalize(w, 'oz')).toBeCloseTo(expected, 2);
    }
  });

  it('normalize lb→g matches convert-units', () => {
    for (const w of [0.5, 1, 1.5, 2, 2.5, 4, 10]) {
      const expected = convert(w).from('lb').to('g') as number;
      expect(normalize(w, 'lb')).toBeCloseTo(expected, 2);
    }
  });

  it('fromGrams g→kg matches convert-units', () => {
    for (const g of [100, 500, 1000, 2500, 5000]) {
      const expected = convert(g).from('g').to('kg') as number;
      expect(fromGrams(g, 'kg')).toBeCloseTo(expected, 5);
    }
  });

  it('fromGrams g→oz matches convert-units', () => {
    for (const g of [28.35, 100, 200, 500, 1000]) {
      const expected = convert(g).from('g').to('oz') as number;
      expect(fromGrams(g, 'oz')).toBeCloseTo(expected, 2);
    }
  });

  it('fromGrams g→lb matches convert-units', () => {
    for (const g of [100, 227, 453, 907, 1814]) {
      const expected = convert(g).from('g').to('lb') as number;
      expect(fromGrams(g, 'lb')).toBeCloseTo(expected, 2);
    }
  });

  it('packratConvert oz→lb matches convert-units', () => {
    for (const oz of [1, 4, 8, 12, 16, 32]) {
      const expected = convert(oz).from('oz').to('lb') as number;
      expect(packratConvert(oz, 'oz', 'lb')).toBeCloseTo(expected, 4);
    }
  });

  it('packratConvert lb→oz matches convert-units', () => {
    for (const lb of [0.5, 1, 1.5, 2, 3, 5]) {
      const expected = convert(lb).from('lb').to('oz') as number;
      expect(packratConvert(lb, 'lb', 'oz')).toBeCloseTo(expected, 4);
    }
  });

  it('packratConvert kg→lb matches convert-units', () => {
    for (const kg of [0.5, 1, 1.5, 2, 5, 10]) {
      const expected = convert(kg).from('kg').to('lb') as number;
      expect(packratConvert(kg, 'kg', 'lb')).toBeCloseTo(expected, 3);
    }
  });

  it('packratConvert lb→kg matches convert-units', () => {
    for (const lb of [1, 2.2046, 5, 10, 22.046]) {
      const expected = convert(lb).from('lb').to('kg') as number;
      expect(packratConvert(lb, 'lb', 'kg')).toBeCloseTo(expected, 3);
    }
  });

  it('packratConvert kg→oz matches convert-units', () => {
    for (const kg of [0.5, 1, 2, 5]) {
      const expected = convert(kg).from('kg').to('oz') as number;
      expect(packratConvert(kg, 'kg', 'oz')).toBeCloseTo(expected, 2);
    }
  });

  it('packratConvert oz→kg matches convert-units', () => {
    for (const oz of [1, 8, 16, 35.274]) {
      const expected = convert(oz).from('oz').to('kg') as number;
      expect(packratConvert(oz, 'oz', 'kg')).toBeCloseTo(expected, 4);
    }
  });

  it('packratConvert g→oz matches convert-units', () => {
    for (const g of [28.35, 100, 226.8, 453.6, 1000]) {
      const expected = convert(g).from('g').to('oz') as number;
      expect(packratConvert(g, 'g', 'oz')).toBeCloseTo(expected, 2);
    }
  });

  it('packratConvert g→lb matches convert-units', () => {
    for (const g of [100, 227, 454, 907, 2268]) {
      const expected = convert(g).from('g').to('lb') as number;
      expect(packratConvert(g, 'g', 'lb')).toBeCloseTo(expected, 4);
    }
  });
});

// ---------------------------------------------------------------------------
// Real backpacking pack scenarios
// ---------------------------------------------------------------------------

describe('pack calculation scenarios', () => {
  it('ultralight 3-season kit: base weight ≈ 4.5 lb', () => {
    // Cuben fiber tent: 680g, sleeping bag: 16oz, sleeping pad: 10oz,
    // pack: 600g, rain jacket: 4oz, first aid: 2oz, stove: 3oz
    const items = [
      { weight: 680, unit: 'g' as const },
      { weight: 16, unit: 'oz' as const },
      { weight: 10, unit: 'oz' as const },
      { weight: 600, unit: 'g' as const },
      { weight: 4, unit: 'oz' as const },
      { weight: 2, unit: 'oz' as const },
      { weight: 3, unit: 'oz' as const },
    ];
    const totalG = items.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    const totalLb = fromGrams(totalG, 'lb');
    // Should be roughly 4–6 lbs for a solid ultralight kit
    expect(totalLb).toBeGreaterThan(3.5);
    expect(totalLb).toBeLessThan(7);
    // Cross-validate display
    expect(displayWeight(totalG, 'lb')).toBeGreaterThan(3.5);
  });

  it('baseweight vs total weight: consumables excluded from base', () => {
    const items = [
      { weight: 500, unit: 'g' as const, consumable: false },
      { weight: 1.5, unit: 'lb' as const, consumable: false },
      { weight: 3, unit: 'lb' as const, consumable: true }, // food
      { weight: 1, unit: 'lb' as const, consumable: true }, // water (usually excluded)
    ];
    const baseG = items
      .filter((i) => !i.consumable)
      .reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    const totalG = items.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    const baseKg = fromGrams(baseG, 'kg');
    // base = 500g + 1.5lb = 500 + 680.38 = 1180.38g ≈ 1.18 kg
    expect(baseKg).toBeCloseTo(1.18, 1);
    // total = base + 4lb of consumables = 1180.38 + 1814.37 ≈ 2994.75g
    expect(displayWeight(totalG, 'lb')).toBeCloseTo(6.6, 0);
    expect(baseG).toBeLessThan(totalG);
  });

  it('worn weight excluded from base weight', () => {
    const items = [
      { weight: 800, unit: 'g' as const, worn: false },
      { weight: 400, unit: 'g' as const, worn: true }, // hiking boots
      { weight: 200, unit: 'g' as const, worn: true }, // clothes
    ];
    const baseG = items
      .filter((i) => !i.worn)
      .reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    expect(baseG).toBe(800);
  });

  it('multi-unit pack totals correctly (g + oz + lb + kg)', () => {
    // Deliberate mix of all 4 unit types
    const items = [
      { weight: 1, unit: 'kg' as const }, // 1000g
      { weight: 16, unit: 'oz' as const }, // ~453.6g = 1 lb
      { weight: 1, unit: 'lb' as const }, // 453.6g
      { weight: 100, unit: 'g' as const }, // 100g
    ];
    const totalG = items.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    // Expected: 1000 + 453.59 + 453.59 + 100 = 2007.18g
    expect(totalG).toBeCloseTo(2007.18, 0);
    expect(displayWeight(totalG, 'kg')).toBeCloseTo(2.01, 1);
    expect(displayWeight(totalG, 'lb')).toBeCloseTo(4.42, 1);
  });

  it('quantity multiplier applies correctly', () => {
    // 8 stakes × 0.5 oz each = 4 oz = ~113.4g
    const stakes = { weight: 0.5, unit: 'oz' as const, quantity: 8 };
    const totalG = normalize(stakes.weight, stakes.unit) * stakes.quantity;
    expect(totalG).toBeCloseTo(OZ_TO_G * 4, 5);
    expect(displayWeight(totalG, 'oz')).toBe(4);
  });

  it('category percentage calculation', () => {
    const items = [
      { weight: 500, unit: 'g' as const }, // 500g
      { weight: 300, unit: 'g' as const }, // 300g
      { weight: 200, unit: 'g' as const }, // 200g
    ];
    const totalG = items.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    const pcts = items.map((i) => (normalize(i.weight, i.unit) / totalG) * 100);
    expect(pcts[0]).toBeCloseTo(50, 5);
    expect(pcts[1]).toBeCloseTo(30, 5);
    expect(pcts[2]).toBeCloseTo(20, 5);
    expect(pcts.reduce((s, p) => s + p, 0)).toBeCloseTo(100, 10);
  });

  it('percentage is independent of preferred display unit', () => {
    // Weight percentages must not change when user switches display unit
    const items = [
      { weight: 1, unit: 'kg' as const },
      { weight: 500, unit: 'g' as const },
    ];
    const totalG = items.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    // 1000g / 1500g = 66.7%, 500g / 1500g = 33.3%
    const pct0 = (normalize(items[0].weight, items[0].unit) / totalG) * 100;
    const pct1 = (normalize(items[1].weight, items[1].unit) / totalG) * 100;
    expect(pct0).toBeCloseTo(66.67, 1);
    expect(pct1).toBeCloseTo(33.33, 1);
    // Same percentages regardless of whether we display in oz, lb, kg
    expect(pct0 + pct1).toBeCloseTo(100, 10);
  });

  it('Appalachian Trail thru-hiker pack scenario', () => {
    // Representative gear list in mixed units
    const baseItems = [
      { name: 'tent', weight: 1.3, unit: 'kg' as const },
      { name: 'sleeping bag', weight: 850, unit: 'g' as const },
      { name: 'sleeping pad', weight: 14, unit: 'oz' as const },
      { name: 'pack', weight: 2.2, unit: 'lb' as const },
      { name: 'rain jacket', weight: 6, unit: 'oz' as const },
      { name: 'water filter', weight: 3.2, unit: 'oz' as const },
      { name: 'stove', weight: 3, unit: 'oz' as const },
      { name: 'headlamp', weight: 1.5, unit: 'oz' as const },
    ];
    const totalG = baseItems.reduce((sum, i) => sum + normalize(i.weight, i.unit), 0);
    const totalLb = fromGrams(totalG, 'lb');
    // This kit should be in the 10–18 lb base weight range for a typical AT hiker
    expect(totalLb).toBeGreaterThan(8);
    expect(totalLb).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// Precision and numeric edge cases
// ---------------------------------------------------------------------------

describe('numeric edge cases', () => {
  it('OZ_TO_G and LB_TO_G are consistent: 16 oz = 1 lb', () => {
    expect(OZ_TO_G * 16).toBeCloseTo(LB_TO_G, 8);
  });

  it('normalize then fromGrams is identity for exact NIST values', () => {
    expect(fromGrams(normalize(1, 'oz'), 'oz')).toBe(1);
    expect(fromGrams(normalize(1, 'lb'), 'lb')).toBe(1);
    expect(fromGrams(normalize(1, 'kg'), 'kg')).toBe(1);
  });

  it('0.1 kg precision (common UI input)', () => {
    // User enters "0.1 kg" — must not drift
    expect(normalize(0.1, 'kg')).toBe(100);
    expect(fromGrams(100, 'kg')).toBe(0.1);
  });

  it('very precise sub-gram weights', () => {
    const mg = normalize(0.001, 'g'); // 0.001 g = 1 mg
    expect(mg).toBe(0.001);
    expect(fromGrams(mg, 'g')).toBe(0.001);
  });

  it('large pack weight 50 lb does not overflow', () => {
    const g = normalize(50, 'lb');
    expect(g).toBeCloseTo(LB_TO_G * 50, 2);
    expect(fromGrams(g, 'lb')).toBeCloseTo(50, 8);
  });

  it('convert same-unit short-circuits (no floating point ops)', () => {
    // IEEE 754 exact: if from===to we return the input directly
    const w = 1 / 3; // irrational in float
    expect(packratConvert(w, 'oz', 'oz')).toBe(w); // toBe = same reference value
    expect(packratConvert(w, 'lb', 'lb')).toBe(w);
    expect(packratConvert(w, 'kg', 'kg')).toBe(w);
    expect(packratConvert(w, 'g', 'g')).toBe(w);
  });

  it('16 oz equals 1 lb through convert', () => {
    // 16 oz → lb must equal exactly 1 lb → oz → lb
    const via_oz = packratConvert(16, 'oz', 'lb');
    const direct = packratConvert(1, 'lb', 'lb');
    expect(via_oz).toBeCloseTo(direct, 10);
  });
});

// ---------------------------------------------------------------------------
// isWeightUnit
// ---------------------------------------------------------------------------

describe('isWeightUnit', () => {
  it('returns true for all four valid units', () => {
    expect(isWeightUnit('g')).toBe(true);
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('oz')).toBe(true);
    expect(isWeightUnit('lb')).toBe(true);
  });

  it('rejects common plural / alternate spellings', () => {
    expect(isWeightUnit('lbs')).toBe(false);
    expect(isWeightUnit('grams')).toBe(false);
    expect(isWeightUnit('ounce')).toBe(false);
    expect(isWeightUnit('ounces')).toBe(false);
    expect(isWeightUnit('pound')).toBe(false);
    expect(isWeightUnit('pounds')).toBe(false);
    expect(isWeightUnit('kilogram')).toBe(false);
    expect(isWeightUnit('kilograms')).toBe(false);
    expect(isWeightUnit('gram')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isWeightUnit('G')).toBe(false);
    expect(isWeightUnit('KG')).toBe(false);
    expect(isWeightUnit('Kg')).toBe(false);
    expect(isWeightUnit('OZ')).toBe(false);
    expect(isWeightUnit('Oz')).toBe(false);
    expect(isWeightUnit('LB')).toBe(false);
    expect(isWeightUnit('Lb')).toBe(false);
  });

  it('rejects empty string and whitespace', () => {
    expect(isWeightUnit('')).toBe(false);
    expect(isWeightUnit(' ')).toBe(false);
    expect(isWeightUnit(' g')).toBe(false);
    expect(isWeightUnit('g ')).toBe(false);
    expect(isWeightUnit(' oz ')).toBe(false);
  });

  it('rejects non-string primitives', () => {
    expect(isWeightUnit(null)).toBe(false);
    expect(isWeightUnit(undefined)).toBe(false);
    expect(isWeightUnit(0)).toBe(false);
    expect(isWeightUnit(1)).toBe(false);
    expect(isWeightUnit(true)).toBe(false);
    expect(isWeightUnit(false)).toBe(false);
    expect(isWeightUnit(NaN)).toBe(false);
  });

  it('rejects objects and arrays', () => {
    expect(isWeightUnit({})).toBe(false);
    expect(isWeightUnit([])).toBe(false);
    expect(isWeightUnit(['oz'])).toBe(false);
    expect(isWeightUnit({ unit: 'oz' })).toBe(false);
  });

  it('rejects unit strings from other measurement systems', () => {
    expect(isWeightUnit('stone')).toBe(false);
    expect(isWeightUnit('mg')).toBe(false);
    expect(isWeightUnit('t')).toBe(false); // metric ton
    expect(isWeightUnit('mcg')).toBe(false);
    expect(isWeightUnit('mt')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseWeightUnit
// ---------------------------------------------------------------------------

describe('parseWeightUnit', () => {
  it('returns the unit unchanged for all four valid units', () => {
    expect(parseWeightUnit('g')).toBe('g');
    expect(parseWeightUnit('kg')).toBe('kg');
    expect(parseWeightUnit('oz')).toBe('oz');
    expect(parseWeightUnit('lb')).toBe('lb');
  });

  it('falls back to g by default for invalid input', () => {
    expect(parseWeightUnit('lbs')).toBe('g');
    expect(parseWeightUnit('KG')).toBe('g');
    expect(parseWeightUnit('stone')).toBe('g');
    expect(parseWeightUnit(null)).toBe('g');
    expect(parseWeightUnit(undefined)).toBe('g');
    expect(parseWeightUnit('')).toBe('g');
    expect(parseWeightUnit(42)).toBe('g');
    expect(parseWeightUnit({})).toBe('g');
  });

  it('uses the provided fallback for all four valid fallback units', () => {
    expect(parseWeightUnit('invalid', 'oz')).toBe('oz');
    expect(parseWeightUnit('invalid', 'lb')).toBe('lb');
    expect(parseWeightUnit('invalid', 'kg')).toBe('kg');
    expect(parseWeightUnit('invalid', 'g')).toBe('g');
  });

  it('does not apply fallback when input is valid', () => {
    expect(parseWeightUnit('oz', 'lb')).toBe('oz'); // valid → ignore fallback
    expect(parseWeightUnit('kg', 'oz')).toBe('kg');
  });

  it('handles real-world API inputs that may come as null/undefined', () => {
    // Simulating JSON parse of user preferences not yet set
    const prefs: Record<string, unknown> = {};
    expect(parseWeightUnit(prefs.weightUnit)).toBe('g');
    expect(parseWeightUnit(prefs.weightUnit, 'lb')).toBe('lb');
  });
});
