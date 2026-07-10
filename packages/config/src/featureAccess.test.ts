import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EARLY_ACCESS_WEEKS,
  earlyAccessUntilFrom,
  hasFeatureAccess,
  isInEarlyAccess,
} from './featureAccess';

const NOW = new Date('2026-06-25T00:00:00.000Z');
const FUTURE = new Date('2026-08-01T00:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');

describe('isInEarlyAccess', () => {
  it('is false when there is no feature', () => {
    expect(isInEarlyAccess(null, NOW)).toBe(false);
    expect(isInEarlyAccess(undefined, NOW)).toBe(false);
  });

  it('is false when earlyAccessUntil is null (generally available)', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: null }, NOW)).toBe(false);
  });

  it('is true while the window is in the future', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: FUTURE }, NOW)).toBe(true);
  });

  it('is false once the window has passed (graduated)', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: PAST }, NOW)).toBe(false);
  });

  it('parses an ISO string date', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: FUTURE.toISOString() }, NOW)).toBe(true);
  });

  it('treats an unparseable date as not in early access (fail open)', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: 'not-a-date' }, NOW)).toBe(false);
  });

  it('defaults `now` to the current time', () => {
    expect(isInEarlyAccess({ earlyAccessUntil: PAST })).toBe(false);
  });
});

describe('hasFeatureAccess', () => {
  it('allows everyone for a generally-available feature', () => {
    expect(hasFeatureAccess({ earlyAccessUntil: null }, { hasPro: false, now: NOW })).toBe(true);
  });

  it('allows everyone once a feature has graduated', () => {
    expect(hasFeatureAccess({ earlyAccessUntil: PAST }, { hasPro: false, now: NOW })).toBe(true);
  });

  it('gates an in-window feature to Pro members only', () => {
    expect(hasFeatureAccess({ earlyAccessUntil: FUTURE }, { hasPro: false, now: NOW })).toBe(false);
    expect(hasFeatureAccess({ earlyAccessUntil: FUTURE }, { hasPro: true, now: NOW })).toBe(true);
  });

  it('fails open for an unconfigured feature', () => {
    expect(hasFeatureAccess(undefined, { hasPro: false, now: NOW })).toBe(true);
  });

  it('defaults `now` to the current time when omitted', () => {
    expect(hasFeatureAccess({ earlyAccessUntil: PAST }, { hasPro: false })).toBe(true);
  });
});

describe('earlyAccessUntilFrom', () => {
  it('adds the default window to the release date', () => {
    const until = earlyAccessUntilFrom(NOW);
    const expected = NOW.getTime() + DEFAULT_EARLY_ACCESS_WEEKS * 7 * 24 * 60 * 60 * 1000;
    expect(until.getTime()).toBe(expected);
  });

  it('honours a custom window length', () => {
    const until = earlyAccessUntilFrom(NOW, 2);
    expect(until.getTime()).toBe(NOW.getTime() + 2 * 7 * 24 * 60 * 60 * 1000);
  });

  it('defaults the release date to now', () => {
    const before = Date.now();
    const until = earlyAccessUntilFrom();
    const after = Date.now();
    const windowMs = DEFAULT_EARLY_ACCESS_WEEKS * 7 * 24 * 60 * 60 * 1000;
    expect(until.getTime()).toBeGreaterThanOrEqual(before + windowMs);
    expect(until.getTime()).toBeLessThanOrEqual(after + windowMs);
  });
});
