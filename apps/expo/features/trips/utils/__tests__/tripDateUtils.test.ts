import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countdownLabel, formatDateRange } from '../tripDateUtils';

// Minimal translation mock covering only the keys tripDateUtils uses
const t = ((key: string, opts?: Record<string, unknown>) => {
  if (key === 'trips.today') return 'Today';
  if (key === 'trips.tomorrow') return 'Tomorrow';
  if (key === 'trips.inDays') return `In ${opts?.count} days`;
  return key;
}) as unknown as TranslationFunction;

describe('countdownLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for an empty dateString', () => {
    vi.setSystemTime(new Date('2024-06-01T00:00:00'));
    expect(countdownLabel({ dateString: '', t })).toBe('');
  });

  it('returns empty string for an invalid dateString', () => {
    vi.setSystemTime(new Date('2024-06-01T00:00:00'));
    expect(countdownLabel({ dateString: 'not-a-date', t })).toBe('');
  });

  it('returns "Today" when the date is the same calendar day', () => {
    vi.setSystemTime(new Date('2024-06-15T09:30:00'));
    expect(countdownLabel({ dateString: '2024-06-15', t })).toBe('Today');
  });

  it('returns "Today" regardless of the time of day', () => {
    vi.setSystemTime(new Date('2024-06-15T23:59:59'));
    expect(countdownLabel({ dateString: '2024-06-15', t })).toBe('Today');
  });

  it('returns "Tomorrow" when the date is one day away', () => {
    vi.setSystemTime(new Date('2024-06-15T08:00:00'));
    expect(countdownLabel({ dateString: '2024-06-16', t })).toBe('Tomorrow');
  });

  it('returns "In N days" for dates further in the future', () => {
    vi.setSystemTime(new Date('2024-06-01T00:00:00'));
    expect(countdownLabel({ dateString: '2024-06-05', t })).toBe('In 4 days');
  });

  it('returns "In N days" for a date 30 days away', () => {
    vi.setSystemTime(new Date('2024-06-01T00:00:00'));
    expect(countdownLabel({ dateString: '2024-07-01', t })).toBe('In 30 days');
  });
});

describe('formatDateRange', () => {
  it('returns empty string when start is undefined', () => {
    expect(formatDateRange({ start: undefined, end: undefined })).toBe('');
  });

  it('returns empty string when start is an empty string', () => {
    expect(formatDateRange({ start: '', end: undefined })).toBe('');
  });

  it('returns formatted start date only when end is omitted', () => {
    const result = formatDateRange({ start: '2024-06-15' });
    expect(result).toBe('Jun 15');
  });

  it('returns formatted start date only when end is undefined', () => {
    const result = formatDateRange({ start: '2024-06-15', end: undefined });
    expect(result).toBe('Jun 15');
  });

  it('returns a range string when both start and end are provided', () => {
    const result = formatDateRange({ start: '2024-06-15', end: '2024-07-04' });
    expect(result).toBe('Jun 15 – Jul 4, 2024');
  });

  it('handles same-month range correctly', () => {
    const result = formatDateRange({ start: '2024-08-01', end: '2024-08-10' });
    expect(result).toBe('Aug 1 – Aug 10, 2024');
  });

  it('handles cross-year range correctly', () => {
    const result = formatDateRange({ start: '2024-12-28', end: '2025-01-03' });
    expect(result).toBe('Dec 28 – Jan 3, 2025');
  });
});
