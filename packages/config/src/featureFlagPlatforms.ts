// Platform targeting for feature flags.
//
// A flag resolves in three layers, most specific first:
//
//   1. a platform override for the caller's platform
//   2. the flag's global override
//   3. the coded default compiled into the build
//
// The layering is what makes targeting cheap: a flag with no platform opinion
// stores nothing extra and behaves exactly as it did before, while "on
// everywhere except macOS" is one row rather than one row per platform.
//
// An unrecognised platform — an old client, a surface with no targeting like
// Expo on web — falls through to the global value. Unknown platforms are not
// treated as "off": that would dark-launch every flag for any client the
// server did not recognise, which is a far worse failure than a flag being
// slightly too widely on.

import { isBoolean, isObject, isString } from '@packrat/guards';

/** Platforms a flag can be targeted at. Mirrors `client_platform` in the DB. */
export const ClientPlatform = Object.freeze({
  IOS: 'ios',
  Android: 'android',
  MacOS: 'macos',
} as const);

export type ClientPlatformValue = (typeof ClientPlatform)[keyof typeof ClientPlatform];

const PLATFORM_VALUES: readonly string[] = Object.values(ClientPlatform);

/**
 * Whether `value` names a platform the server can target.
 *
 * Used to validate the `platform` query parameter. A request that fails this
 * is served the untargeted flags rather than rejected — see the note above on
 * why unknown platforms must not fail closed.
 */
export function isClientPlatform(value: unknown): value is ClientPlatformValue {
  return isString(value) && PLATFORM_VALUES.includes(value);
}

/**
 * Resolves one flag against the three layers.
 *
 * @param platformOverrides Overrides for the caller's platform only. The caller
 *   has already selected these by platform; this function does not filter.
 */
export function resolveFlagForPlatform({
  key,
  platformOverrides,
  globalOverrides,
  defaults,
}: {
  key: string;
  platformOverrides: Record<string, boolean>;
  globalOverrides: Record<string, boolean>;
  defaults: Record<string, boolean>;
}): boolean {
  const platformValue = platformOverrides[key];
  if (isBoolean(platformValue)) return platformValue;

  const globalValue = globalOverrides[key];
  if (isBoolean(globalValue)) return globalValue;

  return defaults[key] ?? false;
}

/**
 * Resolves every known flag for one platform.
 *
 * Iterates the coded defaults rather than the override maps, so an override for
 * a key this build has no code for cannot invent a flag — the same rule
 * `normalizeFeatureFlags` applies on the client.
 */
export function resolveFlagsForPlatform({
  platformOverrides,
  globalOverrides,
  defaults,
}: {
  platformOverrides: unknown;
  globalOverrides: unknown;
  defaults: Record<string, boolean>;
}): Record<string, boolean> {
  // Reflect.get reads an unknown-shaped map without asserting a type onto it;
  // resolveFlagForPlatform already treats a non-boolean as absent.
  const read = ({ source, key }: { source: unknown; key: string }): boolean | undefined => {
    if (!isObject(source)) return undefined;
    const value = Reflect.get(source, key);
    return isBoolean(value) ? value : undefined;
  };

  const resolved: Record<string, boolean> = {};
  // Object.entries rather than Object.keys: it hands back the default value
  // alongside the key, so the fallback needs no indexed read that
  // noUncheckedIndexedAccess would widen to `boolean | undefined`.
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const platformValue = read({ source: platformOverrides, key });
    if (platformValue !== undefined) {
      resolved[key] = platformValue;
      continue;
    }

    const globalValue = read({ source: globalOverrides, key });
    resolved[key] = globalValue !== undefined ? globalValue : defaultValue;
  }
  return resolved;
}
