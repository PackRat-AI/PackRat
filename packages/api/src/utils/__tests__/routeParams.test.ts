import { describe, expect, it } from 'vitest';
import { integerIdSchema, parseIntegerId } from '../routeParams';

describe('integerIdSchema', () => {
  it('accepts a valid positive integer string', () => {
    expect(integerIdSchema.safeParse('1').success).toBe(true);
    expect(integerIdSchema.safeParse('42').success).toBe(true);
    expect(integerIdSchema.safeParse('2147483647').success).toBe(true); // PG_INT4_MAX
  });

  it('rejects zero', () => {
    expect(integerIdSchema.safeParse('0').success).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(integerIdSchema.safeParse('-1').success).toBe(false);
    expect(integerIdSchema.safeParse('-100').success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(integerIdSchema.safeParse('abc').success).toBe(false);
    expect(integerIdSchema.safeParse('').success).toBe(false);
  });

  it('rejects leading zeros', () => {
    expect(integerIdSchema.safeParse('007').success).toBe(false);
    expect(integerIdSchema.safeParse('01').success).toBe(false);
  });

  it('rejects hex format', () => {
    expect(integerIdSchema.safeParse('0x10').success).toBe(false);
  });

  it('rejects scientific notation', () => {
    expect(integerIdSchema.safeParse('1e2').success).toBe(false);
  });

  it('rejects floats', () => {
    expect(integerIdSchema.safeParse('4.0').success).toBe(false);
    expect(integerIdSchema.safeParse('3.14').success).toBe(false);
  });

  it('rejects values exceeding PG_INT4_MAX', () => {
    expect(integerIdSchema.safeParse('2147483648').success).toBe(false);
    expect(integerIdSchema.safeParse('9999999999').success).toBe(false);
  });

  it('rejects whitespace-padded numbers', () => {
    expect(integerIdSchema.safeParse('  42  ').success).toBe(false);
    expect(integerIdSchema.safeParse(' 1').success).toBe(false);
  });

  it('coerces valid string to number in output', () => {
    const result = integerIdSchema.safeParse('99');
    expect(result.success).toBe(true);
    if (result.success) expect(typeof result.data).toBe('number');
  });
});

describe('parseIntegerId', () => {
  it('returns the parsed number for a valid id', () => {
    expect(parseIntegerId('1')).toBe(1);
    expect(parseIntegerId('42')).toBe(42);
    expect(parseIntegerId('2147483647')).toBe(2147483647);
  });

  it('returns null for undefined', () => {
    expect(parseIntegerId(undefined)).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseIntegerId('abc')).toBeNull();
    expect(parseIntegerId('')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parseIntegerId('0')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseIntegerId('-1')).toBeNull();
  });

  it('returns null for values exceeding PG_INT4_MAX', () => {
    expect(parseIntegerId('2147483648')).toBeNull();
  });

  it('returns null for leading-zero strings', () => {
    expect(parseIntegerId('007')).toBeNull();
  });

  it('returns null for floats', () => {
    expect(parseIntegerId('3.14')).toBeNull();
  });

  it('returns null for hex-format strings', () => {
    expect(parseIntegerId('0x1A')).toBeNull();
  });

  it('returns null for scientific notation', () => {
    expect(parseIntegerId('1e5')).toBeNull();
  });
});
