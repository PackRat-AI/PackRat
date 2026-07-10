// Early-access resolver — the single source of truth shared by the API
// (server-side enforcement) and the mobile app (UI gating).
//
// The monetization model has exactly two states per feature, both encoded in
// one timestamp, `earlyAccessUntil`:
//
//   - null OR in the past  → generally available: free for everyone
//   - in the future        → early access: Pro members only, until it passes
//
// Graduation is automatic and temporal: when `earlyAccessUntil` passes, the
// same row starts resolving as free for everyone with no flip or migration.
// Nothing is ever taken away from a user — a feature only ever moves from
// "Pro-first" to "free for all".

/** Default early-access window applied to a new feature, in weeks. */
export const DEFAULT_EARLY_ACCESS_WEEKS = 6;

/** Minimal shape the resolver reads — a row from the `feature_access` table. */
export interface FeatureAccessLike {
  // `Date` from a direct DB read, `string` when serialized over the API.
  earlyAccessUntil: Date | string | null;
}

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Whether the feature is currently inside its early-access window — i.e. still
 * Pro-gated for non-members. Independent of who the viewer is.
 */
export function isInEarlyAccess(
  feature: FeatureAccessLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const until = toTime(feature?.earlyAccessUntil);
  return until !== null && now.getTime() < until;
}

/**
 * Whether the viewer may use the feature right now.
 *
 * Fails open (returns `true`) for unknown features or unparseable dates: the
 * model never takes access away, so missing/bad config defaults to free rather
 * than wrongly locking anyone out.
 *
 * @param feature  The `feature_access` row, or null/undefined if not configured.
 * @param viewer   `hasPro`: whether the viewer holds the active Pro entitlement;
 *                 `now`: clock override for deterministic tests.
 */
export function hasFeatureAccess(
  feature: FeatureAccessLike | null | undefined,
  viewer: { hasPro: boolean; now?: Date },
): boolean {
  const now = viewer.now ?? new Date();
  if (!isInEarlyAccess(feature, now)) return true; // GA / graduated → free
  return viewer.hasPro; // still in the window → Pro only
}

/**
 * Compute an `earlyAccessUntil` timestamp from a release date and a window
 * length. Use when inserting a feature into early access at ship time.
 */
export function earlyAccessUntilFrom(
  releasedAt: Date = new Date(),
  weeks: number = DEFAULT_EARLY_ACCESS_WEEKS,
): Date {
  return new Date(releasedAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}
