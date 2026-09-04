// Feature-flag resolution — the shared rule for turning an untrusted flag map
// (a persisted cache, an API response, a platform-native store) into a complete
// map with a boolean for every known key.
//
// The rule is one sentence: **an unknown or non-boolean value is `false`.**
//
// This matters because a flag map can arrive incomplete in ways the type system
// cannot see:
//
//   - a persisted cache written by an older build, before a key existed
//   - an API response that omits a key, or sends a non-boolean for one
//   - a native store (UserDefaults, AsyncStorage) rehydrated through an
//     unvalidated JSON cast
//
// In every one of those cases the honest answer for a key we cannot resolve is
// "off". A new feature must never appear because a stale cache happened not to
// mention it. That is the same principle the early-access resolver encodes for
// entitlements (see featureAccess.ts): not knowing is never a reason to unlock.
//
// Note the deliberate asymmetry with the *coded defaults* in config.ts. Those
// defaults are a decision someone wrote down, so a flag defaulting to `true`
// there is intentional and is honoured. This module only governs values that
// arrive from outside the binary, where absence carries no decision at all.

import { isBoolean, isObject } from '@packrat/guards';

/**
 * Normalize an untrusted flag map against a set of known keys and their coded
 * defaults, producing a complete map with a boolean for every known key.
 *
 * Keys present in `source` but not in `defaults` are dropped — the binary's key
 * set is authoritative, so a server cannot invent a flag the app has no code
 * for. Keys in `defaults` but missing from `source` resolve to `false`, not to
 * their coded default: `source` being present means a real map was fetched or
 * rehydrated, and a key absent from a real map is a key nobody has decided on.
 *
 * When `source` is absent entirely (null, undefined, not an object), the coded
 * defaults are returned unchanged — nothing has been fetched, so there is no
 * evidence to override the decisions compiled into the build.
 *
 * @param source   Untrusted map, or null/undefined when nothing is cached yet.
 * @param defaults The coded defaults from config.ts. Defines the known key set.
 */
export function normalizeFeatureFlags<K extends string>({
  source,
  defaults,
}: {
  source: unknown;
  defaults: Record<K, boolean>;
}): Record<K, boolean> {
  // Start from a copy of `defaults` rather than an empty object. That keeps the
  // value typed as Record<K, boolean> the whole way through with no assertion:
  // an empty `{}` would have to be asserted into shape, and the entries helpers
  // (objectKeys/objectFromEntries) widen K into a `${Exclude<K, symbol>}`
  // template literal that TS will not narrow back to K.
  const resolved: Record<K, boolean> = { ...defaults };

  // Nothing fetched or rehydrated — the coded decisions stand.
  if (!isObject(source)) return resolved;

  for (const key in resolved) {
    // Reflect.get reads an unknown-shaped object without asserting its type.
    const value = Reflect.get(source, key);
    resolved[key] = isBoolean(value) ? value : false;
  }

  return resolved;
}
