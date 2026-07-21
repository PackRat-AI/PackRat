import { appConfig } from 'expo-app/config';
import { atomWithAsyncStorage } from './atomWithAsyncStorage';

export type FeatureFlagKey = keyof typeof appConfig.featureFlags;
export type FeatureFlagsMap = Record<FeatureFlagKey, boolean>;

// Persisted cache of the last-fetched effective flags. Seeded with the coded
// defaults so a cold start with no network renders exactly today's shipped
// behavior; useFeatureFlags() overwrites it once the server responds.
// Explicitly typed as the widened Record (not `typeof appConfig.featureFlags`,
// whose `as const` values narrow to per-key `true`/`false` literals) since
// this atom holds a value that legitimately flips between true and false.
export const featureFlagsAtom = atomWithAsyncStorage<FeatureFlagsMap>({
  key: 'featureFlags:v1',
  initialValue: appConfig.featureFlags,
});
