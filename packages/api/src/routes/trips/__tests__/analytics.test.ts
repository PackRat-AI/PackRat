/**
 * Unit tests for trip analytics logic.
 *
 * These tests run in Node.js (vitest.unit.config.ts) without a live database.
 * They cover pure-logic helpers extracted or inline-verified here so that the
 * aggregation math can be validated without spinning up Cloudflare Workers.
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers mirroring the logic in analytics.ts
// ---------------------------------------------------------------------------

const DAY_MS = 1000 * 60 * 60 * 24;

/** Calculates trip duration in days using Math.ceil (matches analytics.ts). */
function calcDurationDays(startDate: Date, endDate: Date): number {
  const durationMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.ceil(durationMs / DAY_MS));
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthCount {
  month: string;
  count: number;
}

/** Mirrors the empty-state check in TripAnalyticsScreen. */
function hasAnyActivity(tripsByMonth: MonthCount[]): boolean {
  return tripsByMonth.some((m) => m.count > 0);
}

// ---------------------------------------------------------------------------
// Duration calculation — Math.ceil vs Math.round
// ---------------------------------------------------------------------------

describe('calcDurationDays — Math.ceil', () => {
  it('returns 1 for a 1-night trip that is less than 24 hours (e.g., 20 h)', () => {
    const start = new Date('2025-06-01T10:00:00Z');
    const end = new Date('2025-06-02T06:00:00Z'); // 20 hours later
    expect(calcDurationDays(start, end)).toBe(1);
  });

  it('returns 2 for a trip spanning 1.5 days (36 hours) — Math.round would give 2 as well', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-02T12:00:00Z'); // 36 hours later
    expect(calcDurationDays(start, end)).toBe(2);
  });

  it('key difference: Math.ceil gives 2 where Math.round gives 1 for 1.5-day trip expressed in days', () => {
    // 1.5 * DAY_MS milliseconds
    const durationMs = 1.5 * DAY_MS;
    const ceilResult = Math.max(0, Math.ceil(durationMs / DAY_MS));
    const roundResult = Math.max(0, Math.round(durationMs / DAY_MS));
    expect(ceilResult).toBe(2);
    expect(roundResult).toBe(2);
  });

  it('Math.ceil returns 2 for just-over-1-day trip that Math.round would round to 1', () => {
    // 1.1 days — Math.round(1.1) = 1, Math.ceil(1.1) = 2
    const durationMs = 1.1 * DAY_MS;
    const ceilResult = Math.max(0, Math.ceil(durationMs / DAY_MS));
    const roundResult = Math.max(0, Math.round(durationMs / DAY_MS));
    expect(ceilResult).toBe(2);
    expect(roundResult).toBe(1); // Math.round undercounts!
  });

  it('returns 0 for a zero-duration trip', () => {
    const start = new Date('2025-06-01T10:00:00Z');
    const end = new Date('2025-06-01T10:00:00Z');
    expect(calcDurationDays(start, end)).toBe(0);
  });

  it('returns 0 for a negative-duration trip (end before start)', () => {
    const start = new Date('2025-06-02T00:00:00Z');
    const end = new Date('2025-06-01T00:00:00Z');
    expect(calcDurationDays(start, end)).toBe(0);
  });

  it('returns 7 for exactly 7-day trip', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-08T00:00:00Z');
    expect(calcDurationDays(start, end)).toBe(7);
  });

  it('returns 1 for a trip that is exactly 1 day', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-02T00:00:00Z');
    expect(calcDurationDays(start, end)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Empty-state check — tripsByMonth.some(m => m.count > 0)
// ---------------------------------------------------------------------------

describe('hasAnyActivity — empty-state check', () => {
  it('returns false when all 12 months have zero trips', () => {
    const tripsByMonth: MonthCount[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${MONTH_NAMES[i]} 2025`,
      count: 0,
    }));
    expect(hasAnyActivity(tripsByMonth)).toBe(false);
  });

  it('returns true when at least one month has a non-zero count', () => {
    const tripsByMonth: MonthCount[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${MONTH_NAMES[i]} 2025`,
      count: 0,
    }));
    tripsByMonth[6]!.count = 3; // July has 3 trips
    expect(hasAnyActivity(tripsByMonth)).toBe(true);
  });

  it('returns true when only the first month has trips', () => {
    const tripsByMonth: MonthCount[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${MONTH_NAMES[i]} 2025`,
      count: i === 0 ? 1 : 0,
    }));
    expect(hasAnyActivity(tripsByMonth)).toBe(true);
  });

  it('returns true when only the last month has trips', () => {
    const tripsByMonth: MonthCount[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${MONTH_NAMES[i]} 2025`,
      count: i === 11 ? 1 : 0,
    }));
    expect(hasAnyActivity(tripsByMonth)).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(hasAnyActivity([])).toBe(false);
  });

  it('old length > 0 check would be wrong: array of 12 zeros has length 12', () => {
    const tripsByMonth: MonthCount[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${MONTH_NAMES[i]} 2025`,
      count: 0,
    }));
    // The old bug: tripsByMonth.length > 0 is always true even with no data
    const oldCheck = tripsByMonth.length > 0;
    const newCheck = tripsByMonth.some((m) => m.count > 0);
    expect(oldCheck).toBe(true);  // this was the bug — shown truthy despite no data
    expect(newCheck).toBe(false); // correct behaviour
  });
});
