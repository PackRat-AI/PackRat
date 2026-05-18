import { describe, expect, it } from 'vitest';
import { formatLocalDate, parseLocalDate } from '../dateUtils';

describe('parseLocalDate', () => {
  it('returns null for undefined', () => {
    expect(parseLocalDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseLocalDate('')).toBeNull();
  });

  it('parses YYYY-MM-DD as a local date with correct year, month, and day', () => {
    const result = parseLocalDate('2024-01-15');
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(0); // January
    expect(result?.getDate()).toBe(15);
  });

  it('parses end-of-year date correctly', () => {
    const result = parseLocalDate('2023-12-31');
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2023);
    expect(result?.getMonth()).toBe(11); // December
    expect(result?.getDate()).toBe(31);
  });

  it('returns null for an invalid YYYY-MM-DD date (month 13)', () => {
    expect(parseLocalDate('2024-13-01')).toBeNull();
  });

  it('returns null for an invalid YYYY-MM-DD date (day 32)', () => {
    expect(parseLocalDate('2024-01-32')).toBeNull();
  });

  it('parses ISO datetime strings', () => {
    const result = parseLocalDate('2024-06-15T10:30:00Z');
    expect(result).not.toBeNull();
    expect(result?.getUTCFullYear()).toBe(2024);
    expect(result?.getUTCMonth()).toBe(5); // June
  });

  it('returns null for completely invalid input', () => {
    expect(parseLocalDate('not-a-date')).toBeNull();
  });

  it('returns null for a non-standard pattern that looks date-like', () => {
    expect(parseLocalDate('foo-bar-baz')).toBeNull();
  });

  it('YYYY-MM-DD parses as local time (not UTC)', () => {
    const result = parseLocalDate('2024-03-10');
    expect(result).not.toBeNull();
    // date-fns parse() with 'yyyy-MM-dd' sets hours to 0 in local time
    expect(result?.getHours()).toBe(0);
    expect(result?.getMinutes()).toBe(0);
  });
});

describe('formatLocalDate', () => {
  it('returns em dash for undefined', () => {
    expect(formatLocalDate(undefined)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(formatLocalDate('')).toBe('—');
  });

  it('returns a non-empty locale string for a valid YYYY-MM-DD date', () => {
    const result = formatLocalDate('2024-01-15');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns em dash for a completely invalid date string', () => {
    expect(formatLocalDate('not-a-date')).toBe('—');
  });

  it('returns a formatted string for ISO datetime', () => {
    const result = formatLocalDate('2024-06-15T10:30:00Z');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
  });

  it('returns a formatted string for end-of-year date', () => {
    const result = formatLocalDate('2023-12-31');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
  });
});
