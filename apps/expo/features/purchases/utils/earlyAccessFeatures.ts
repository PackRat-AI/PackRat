import { type FeatureAccessLike, isInEarlyAccess } from '@packrat/config';

/**
 * Picks the other features currently in early access, for the paywall to list
 * as what else a subscription unlocks.
 *
 * The Expo half of `FeatureAccessStore.otherEarlyAccessFeatures(excluding:)` in
 * `apps/swift/Sources/PackRat/Subscriptions/FeatureAccessStore.swift`. Sorted
 * by key for a stable order — an unsorted list reshuffles between renders as
 * the config's row order changes, which reads as flicker — and capped, because
 * the point is to suggest breadth rather than enumerate a catalogue.
 */

/** Four names is enough to read as "and more" without becoming a list. */
export const MAX_FEATURE_SLOTS = 4;

interface LabelledFeature extends FeatureAccessLike {
  key: string;
  label?: string | null;
}

/** Everything but the config, which every call has to pass. */
export interface OtherEarlyAccessOptions {
  /**
   * The feature the paywall was opened for, excluded from the list. Null when
   * opened from Settings, where no one feature prompted it and all of them are
   * worth naming.
   */
  excludingKey?: string | null;
  /** Clock override for deterministic tests. */
  now?: Date;
  /** How many names to return. */
  limit?: number;
}

/**
 * Display names of features in an active early-access window, excluding the
 * one the paywall was opened for.
 *
 * Falls back to the key when a row carries no label so a feature is never
 * silently dropped from the list — a missing label is a copy gap, not a reason
 * to under-sell what the subscription includes.
 */
export function otherEarlyAccessFeatureNames(
  features: readonly LabelledFeature[] | undefined,
  {
    excludingKey = null,
    now = new Date(),
    limit = MAX_FEATURE_SLOTS,
  }: OtherEarlyAccessOptions = {},
): string[] {
  if (!features) return [];

  return features
    .filter((feature) => feature.key !== excludingKey && isInEarlyAccess(feature, now))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((feature) => feature.label?.trim() || feature.key);
}
