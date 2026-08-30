import { normalizeFeatureFlags } from '@packrat/config';
import { appConfig } from 'expo-app/config';
import { atomWithAsyncStorage } from './atomWithAsyncStorage';

export type FeatureFlagKey = keyof typeof appConfig.featureFlags;
export type FeatureFlagsMap = Record<FeatureFlagKey, boolean>;

/**
 * The coded defaults, widened from the `as const` literal types (which narrow
 * each value to `true`/`false` rather than `boolean`).
 */
export const codedFeatureFlags: FeatureFlagsMap = { ...appConfig.featureFlags };

/**
 * Normalize a persisted or fetched flag map against the build's known keys.
 * A key the build knows about but the stored map lacks resolves to `false`,
 * never to its coded default — see packages/config/src/featureFlagResolution.ts
 * for why absence is treated as "off" rather than "unset".
 */
export function normalizeFlags(source: unknown): FeatureFlagsMap {
  return normalizeFeatureFlags(source, codedFeatureFlags);
}

// Persisted cache of the last-fetched effective flags. Seeded with the coded
// defaults so a cold start with no network renders exactly today's shipped
// behavior; useFeatureFlags() overwrites it once the server responds.
//
// Rehydration runs through `normalizeFlags`, so a cache written by an older
// build — one that predates a flag key — cannot leave that key `undefined`.
// Without this, `useFeatureFlag('enableNewThing')` returns undefined on a cold
// start until the network fetch lands, and any call site distinguishing
// `false` from `undefined` takes the wrong branch.
export const featureFlagsAtom = atomWithAsyncStorage<FeatureFlagsMap>({
  key: 'featureFlags:v1',
  initialValue: codedFeatureFlags,
  deserialize: normalizeFlags,
});
