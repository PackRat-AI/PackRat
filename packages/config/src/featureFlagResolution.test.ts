import { describe, expect, it } from 'vitest';
import { normalizeFeatureFlags } from './featureFlagResolution';

// Stand-in for the coded defaults. Deliberately mixes a true and a false
// default so "honours the coded default" and "falls back to off" are
// distinguishable outcomes rather than the same value by coincidence.
const DEFAULTS = { enableAlpha: true, enableBeta: false } as const;

describe('normalizeFeatureFlags', () => {
  it('returns the coded defaults when nothing has been fetched or rehydrated', () => {
    // No evidence to override the build's decisions, so enableAlpha stays on.
    expect(normalizeFeatureFlags(null, DEFAULTS)).toEqual({
      enableAlpha: true,
      enableBeta: false,
    });
    expect(normalizeFeatureFlags(undefined, DEFAULTS)).toEqual({
      enableAlpha: true,
      enableBeta: false,
    });
    expect(normalizeFeatureFlags('not-a-map', DEFAULTS)).toEqual({
      enableAlpha: true,
      enableBeta: false,
    });
  });

  it('applies boolean values from the source', () => {
    expect(normalizeFeatureFlags({ enableAlpha: false, enableBeta: true }, DEFAULTS)).toEqual({
      enableAlpha: false,
      enableBeta: true,
    });
  });

  it('resolves a key missing from a present source to false, not to its coded default', () => {
    // The regression this module exists for: a cache persisted by an older
    // build predates enableAlpha, so the key is simply absent. Falling back to
    // the coded `true` would light up a feature nobody decided to ship in this
    // session; the honest answer is off until the server says otherwise.
    expect(normalizeFeatureFlags({ enableBeta: true }, DEFAULTS)).toEqual({
      enableAlpha: false,
      enableBeta: true,
    });
  });

  it('resolves a non-boolean value to false', () => {
    expect(normalizeFeatureFlags({ enableAlpha: 'yes', enableBeta: 0 }, DEFAULTS)).toEqual({
      enableAlpha: false,
      enableBeta: false,
    });
  });

  it('drops keys the source contains but the build has no code for', () => {
    // A server cannot invent a flag: the binary's key set is authoritative.
    const result = normalizeFeatureFlags(
      { enableAlpha: true, enableBeta: true, enableGhost: true },
      DEFAULTS,
    );
    expect(result).toEqual({ enableAlpha: true, enableBeta: true });
    expect('enableGhost' in result).toBe(false);
  });

  it('returns a complete map for every known key', () => {
    // Every known key must carry a real boolean — never undefined — so call
    // sites that distinguish false from undefined cannot take a wrong branch.
    const result = normalizeFeatureFlags({}, DEFAULTS);
    for (const key of Object.keys(DEFAULTS)) {
      expect(typeof result[key as keyof typeof DEFAULTS]).toBe('boolean');
    }
  });

  it('handles an empty known-key set', () => {
    expect(normalizeFeatureFlags({ anything: true }, {})).toEqual({});
  });
});
