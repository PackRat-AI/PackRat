import { describe, expect, it } from 'vitest';
import {
  ClientPlatform,
  isClientPlatform,
  resolveFlagForPlatform,
  resolveFlagsForPlatform,
} from './featureFlagPlatforms';

// Mixes a true and a false default so "fell through to the default" and "fell
// through to off" are distinguishable outcomes rather than the same value by
// coincidence.
const DEFAULTS = { enableAlpha: true, enableBeta: false };

describe('isClientPlatform', () => {
  it('accepts the platforms the server can target', () => {
    expect(isClientPlatform('ios')).toBe(true);
    expect(isClientPlatform('android')).toBe(true);
    expect(isClientPlatform('macos')).toBe(true);
  });

  it('rejects anything else', () => {
    // `web` is deliberately not targetable: Expo's web build reads flags but
    // resolves them globally.
    expect(isClientPlatform('web')).toBe(false);
    expect(isClientPlatform('watchos')).toBe(false);
    expect(isClientPlatform('')).toBe(false);
    expect(isClientPlatform(undefined)).toBe(false);
    expect(isClientPlatform(7)).toBe(false);
  });

  it('exposes the platform values as constants', () => {
    expect(ClientPlatform.IOS).toBe('ios');
    expect(ClientPlatform.Android).toBe('android');
    expect(ClientPlatform.MacOS).toBe('macos');
  });
});

describe('resolveFlagForPlatform', () => {
  const resolve = (
    platformOverrides: Record<string, boolean>,
    globalOverrides: Record<string, boolean>,
  ) =>
    resolveFlagForPlatform({
      key: 'enableAlpha',
      platformOverrides,
      globalOverrides,
      defaults: DEFAULTS,
    });

  it('prefers the platform override over everything', () => {
    // Platform says off, global says on, default says on.
    expect(resolve({ enableAlpha: false }, { enableAlpha: true })).toBe(false);
  });

  it('prefers the platform override even when it agrees with nothing else', () => {
    expect(
      resolveFlagForPlatform({
        key: 'enableBeta',
        platformOverrides: { enableBeta: true },
        globalOverrides: {},
        defaults: DEFAULTS,
      }),
    ).toBe(true);
  });

  it('falls back to the global override when the platform has no opinion', () => {
    expect(resolve({}, { enableAlpha: false })).toBe(false);
  });

  it('falls back to the coded default when neither override exists', () => {
    expect(resolve({}, {})).toBe(true);
    expect(
      resolveFlagForPlatform({
        key: 'enableBeta',
        platformOverrides: {},
        globalOverrides: {},
        defaults: DEFAULTS,
      }),
    ).toBe(false);
  });

  it('resolves an unknown key to false rather than undefined', () => {
    expect(
      resolveFlagForPlatform({
        key: 'enableGhost',
        platformOverrides: {},
        globalOverrides: {},
        defaults: DEFAULTS,
      }),
    ).toBe(false);
  });

  it('treats a non-boolean override as absent', () => {
    // A malformed row must not win the precedence contest just by existing.
    const platformOverrides = { enableAlpha: 'yes' } as unknown as Record<string, boolean>;
    expect(
      resolveFlagForPlatform({
        key: 'enableAlpha',
        platformOverrides,
        globalOverrides: { enableAlpha: false },
        defaults: DEFAULTS,
      }),
    ).toBe(false);
  });
});

describe('resolveFlagsForPlatform', () => {
  it('resolves every known flag', () => {
    expect(
      resolveFlagsForPlatform({
        platformOverrides: { enableAlpha: false },
        globalOverrides: { enableBeta: true },
        defaults: DEFAULTS,
      }),
    ).toEqual({ enableAlpha: false, enableBeta: true });
  });

  it('returns the coded defaults when there are no overrides at all', () => {
    // The untargeted case, which is every flag today. Behaviour must be
    // identical to before platform targeting existed.
    expect(
      resolveFlagsForPlatform({ platformOverrides: {}, globalOverrides: {}, defaults: DEFAULTS }),
    ).toEqual(DEFAULTS);
  });

  it('ignores overrides for keys the build has no code for', () => {
    // A server cannot invent a flag; the binary's key set is authoritative.
    const result = resolveFlagsForPlatform({
      platformOverrides: { enableGhost: true },
      globalOverrides: { enableAlsoGhost: true },
      defaults: DEFAULTS,
    });
    expect(result).toEqual(DEFAULTS);
    expect('enableGhost' in result).toBe(false);
  });

  it('tolerates malformed override maps', () => {
    // Guards the boundary where these arrive from a DB query or a cache.
    expect(
      resolveFlagsForPlatform({
        platformOverrides: null,
        globalOverrides: 'not-a-map',
        defaults: DEFAULTS,
      }),
    ).toEqual(DEFAULTS);
  });

  it('returns a boolean for every key', () => {
    const result = resolveFlagsForPlatform({
      platformOverrides: {},
      globalOverrides: {},
      defaults: DEFAULTS,
    });
    for (const key of Object.keys(DEFAULTS)) {
      expect(typeof result[key]).toBe('boolean');
    }
  });

  it('handles an empty known-key set', () => {
    expect(
      resolveFlagsForPlatform({
        platformOverrides: { anything: true },
        globalOverrides: {},
        defaults: {},
      }),
    ).toEqual({});
  });
});
