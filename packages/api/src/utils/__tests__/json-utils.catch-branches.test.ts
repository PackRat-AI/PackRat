// Covers the defensive fallback branches in mapJsonRowToItem that real
// csv-utils helpers cannot trigger:
//   - parseFaqs / safeJsonParse never throw, so the faqs `[]` / techs `{}`
//     catch branches need the helpers forced to throw.
//   - parseWeight always yields a non-null weight + a schema-valid unit for a
//     positive weightStr, so the `weight ?? undefined` (null) and
//     `parsedUnit.success ? : undefined` (false) branches across all three
//     weight paths need parseWeight forced to return a null/invalid result.
// The happy-path behaviour lives in json-utils.test.ts.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@packrat/api/utils/csv-utils', async (importActual) => {
  const actual = await importActual<typeof import('../csv-utils')>();
  return {
    ...actual,
    parseFaqs: vi.fn(() => {
      throw new Error('boom: parseFaqs');
    }),
    safeJsonParse: vi.fn(() => {
      throw new Error('boom: safeJsonParse');
    }),
    // Null weight + a unit the WeightUnitSchema rejects, so both the nullish
    // and the safeParse-failure branches run.
    parseWeight: vi.fn(() => ({ weight: null, unit: 'INVALID_UNIT' })),
  };
});

const { mapJsonRowToItem } = await import('../json-utils');

describe('mapJsonRowToItem — catch fallbacks', () => {
  it('falls back to an empty faqs array when parseFaqs throws', () => {
    const result = mapJsonRowToItem({ name: 'X', faqs: '[{"question":"Q","answer":"A"}]' });
    expect(result?.faqs).toEqual([]);
  });

  it('falls back to an empty techs record when safeJsonParse throws', () => {
    const result = mapJsonRowToItem({ name: 'X', techs: '{"Material":"Nylon"}' });
    expect(result?.techs).toEqual({});
  });
});

describe('mapJsonRowToItem — weight fallback branches (null weight / invalid unit)', () => {
  it('leaves weight/weightUnit unset for a numeric weight when parseWeight yields null/invalid', () => {
    const result = mapJsonRowToItem({ weight: 280, weightUnit: 'g' });
    expect(result?.weight).toBeUndefined();
    expect(result?.weightUnit).toBeUndefined();
  });

  it('leaves weight/weightUnit unset for a string weight when parseWeight yields null/invalid', () => {
    const result = mapJsonRowToItem({ weight: '1.5 lbs' });
    expect(result?.weight).toBeUndefined();
    expect(result?.weightUnit).toBeUndefined();
  });

  it('leaves weight/weightUnit unset for techs-derived weight when parseWeight yields null/invalid', () => {
    const result = mapJsonRowToItem({ techs: { 'Claimed Weight': '280g' } });
    expect(result?.weight).toBeUndefined();
    expect(result?.weightUnit).toBeUndefined();
  });
});
