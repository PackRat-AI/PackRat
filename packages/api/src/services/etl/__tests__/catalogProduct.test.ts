import type { NewCatalogItem } from '@packrat/db/schema';
import { describe, expect, it } from 'vitest';
import { catalogProductKey, groupItemsByProduct, normalizeCatalogWeight } from '../catalogProduct';

const listing = (sku: string, overrides: Partial<NewCatalogItem> = {}): NewCatalogItem => ({
  sku,
  name: 'FreeLite 2 Tent',
  productUrl: `https://example.com/${sku}`,
  brand: 'MSR',
  ...overrides,
});

describe('catalogProductKey', () => {
  it('ignores case, punctuation and spacing in the name', () => {
    expect(catalogProductKey({ brand: 'MSR', name: 'FreeLite™ 2-Person Tent' })).toBe(
      'msr|freelite2persontent',
    );
    expect(catalogProductKey({ brand: 'msr', name: 'freelite 2 person tent' })).toBe(
      'msr|freelite2persontent',
    );
  });

  it('treats a missing brand as empty', () => {
    expect(catalogProductKey({ brand: null, name: 'Spork' })).toBe('|spork');
  });
});

describe('normalizeCatalogWeight', () => {
  it.each([
    [
      { weight: 1049, weightUnit: 'g' as const },
      { weight: 1049, weightUnit: 'g' },
    ],
    [
      { weight: 10, weightUnit: 'oz' as const },
      { weight: 283.5, weightUnit: 'g' },
    ],
    [
      { weight: 2, weightUnit: 'lb' as const },
      { weight: 907.18, weightUnit: 'g' },
    ],
    [
      { weight: 1.06, weightUnit: 'kg' as const },
      { weight: 1060, weightUnit: 'g' },
    ],
  ])('converts %o to grams', (input, expected) => {
    expect(normalizeCatalogWeight(input)).toEqual(expected);
  });

  it.each([
    { weight: 157, weightUnit: 'lb' as const },
    { weight: 1, weightUnit: 'g' as const },
    { weight: 0, weightUnit: 'g' as const },
    { weight: 500, weightUnit: null },
  ])('drops the implausible weight %o', (input) => {
    expect(normalizeCatalogWeight(input)).toEqual({ weight: null, weightUnit: null });
  });
});

describe('groupItemsByProduct', () => {
  it('collapses listings of one product and keeps every listing as an offer', () => {
    const groups = groupItemsByProduct([
      listing('A', { color: 'Green', price: 499.95 }),
      listing('B', {
        name: 'FreeLite 2 tent',
        color: 'Red',
        price: 342,
        weight: 1049,
        weightUnit: 'g',
      }),
      listing('C', { brand: 'Big Agnes', name: 'Copper Spur' }),
    ]);

    expect(groups.map((g) => [g.productKey, g.offers.map((o) => o.sku)])).toEqual([
      ['msr|freelite2tent', ['A', 'B']],
      ['big agnes|copperspur', ['C']],
    ]);
    expect(groups[0]?.product).toMatchObject({
      sku: 'A',
      color: 'Green',
      price: 499.95,
      weight: 1049,
      weightUnit: 'g',
      productKey: 'msr|freelite2tent',
    });
  });
});
