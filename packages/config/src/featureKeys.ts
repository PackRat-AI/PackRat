// The naming rule that ties a feature's two gates together.
//
// Every new feature has both:
//   1. a `FeatureFlag` key in config.ts  — can we turn this on at all?
//   2. a `feature_access` row            — who is allowed to use it?
//
// These answer different questions and both are required. A flag alone ships a
// feature with no decision about who gets it; an access row alone leaves no way
// to switch the feature off. The convention is both, always — see
// docs/feature-gating.md.
//
// Before this rule the two namespaces were unrelated and nothing checked them
// against each other: the one live gate used the access key `'wildlife'` for a
// feature whose flag is `enableWildlifeIdentification`. That route now derives
// its key like everything else. Deriving one name from the other is what makes
// the pairing checkable rather than a matter of memory.
//
// The rule: drop the `enable` prefix, then kebab-case the rest.
//
//   enableSummitLog                → summit-log
//   enableTrips                    → trips
//   enableWildlifeIdentification   → wildlife-identification
//   enableLocalAI                  → local-ai
//   enableOAuth                    → oauth
//
// Acronyms are the interesting case. A run of capitals is one word, so `AI`
// becomes `ai` rather than `a-i`, and `OAuth` becomes `oauth` rather than
// `o-auth`. Splitting them would read badly and, worse, would be hard to
// predict — the whole point is that a human can derive the access key from the
// flag name without looking anything up.

const ENABLE_PREFIX = 'enable';

/**
 * Derives a feature's `feature_access` key from its `FeatureFlag` key.
 *
 * Total and deterministic: the same flag always yields the same access key, so
 * CI can verify the pairing rather than trusting that someone remembered it.
 *
 * @param flagKey A `FeatureFlag` value, e.g. `enableSummitLog`.
 * @returns The matching `feature_access` key, e.g. `summit-log`.
 */
export function featureAccessKeyForFlag(flagKey: string): string {
  return kebabCase(stripEnablePrefix(flagKey));
}

/**
 * A human-readable label for a feature, derived from its flag key.
 *
 *   enableSummitLog              → "Summit Log"
 *   enableWildlifeIdentification → "Wildlife Identification"
 *   enableLocalAI                → "Local AI"
 *   enableOAuth                  → "OAuth"
 *
 * Derived rather than hand-written so that adding a feature is one line in
 * config.ts and nothing else. A second place to register a label is a second
 * place to forget one.
 *
 * `feature_access.label` is only display text for the admin UI, so an
 * approximate label is fine: edit the row to something better whenever you
 * like, and the seed will leave it alone (every insert is ON CONFLICT DO
 * NOTHING).
 */
export function featureLabelForFlag(flagKey: string): string {
  const words = kebabCase(stripEnablePrefix(flagKey)).split('-');

  return words
    .map((word) => {
      // A word that was an acronym in the flag name reads better fully
      // capitalised — "ai" → "AI", "oauth" → "OAuth" — but re-deriving which
      // ones those were means going back to the original casing.
      const original = findOriginalCasing({ flagKey, lowercased: word });
      return original ?? word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function stripEnablePrefix(flagKey: string): string {
  return flagKey.startsWith(ENABLE_PREFIX) ? flagKey.slice(ENABLE_PREFIX.length) : flagKey;
}

/**
 * Recovers a word's original casing from the flag key, so acronyms survive the
 * round trip through kebab-case. Returns undefined when the original carries no
 * capitalisation worth keeping, in which case the caller title-cases it.
 */
function findOriginalCasing({
  flagKey,
  lowercased,
}: {
  flagKey: string;
  lowercased: string;
}): string | undefined {
  // The word always appears: it came from kebab-casing this very key, and
  // kebab-casing only inserts separators and lowercases. So no not-found guard
  // here — an unreachable branch is worse than none, since it can never be
  // covered or verified.
  const index = flagKey.toLowerCase().indexOf(lowercased);
  const slice = flagKey.slice(index, index + lowercased.length);

  // Keep the original spelling whenever it carries capitalisation the
  // lowercased form lost — "AI" and "OAuth" both qualify, and title-casing
  // either would read as a mistake ("Ai", "Oauth"). A word that is simply
  // lowercase in the flag name has nothing to preserve, so it title-cases
  // normally.
  return slice !== slice.toLowerCase() ? slice : undefined;
}

// Hoisted to module scope: these run on every derivation, and re-compiling a
// literal per call is what Biome's useTopLevelRegex rule guards against.
//
// A capital run followed by a capitalised word starts a new word:
// "APIKeyRotation" → "API KeyRotation".
//
// Requiring at least two capitals is deliberate. After the `enable` prefix is
// stripped, "OAuth" is a *single* capital followed by a capitalised word, and
// splitting there would give "o-auth" rather than "oauth". Two-or-more keeps a
// genuine acronym run ("APIKey") splitting correctly while leaving a word that
// merely starts capitalised intact.
const ACRONYM_BOUNDARY = /([A-Z]{2,})([A-Z][a-z])/g;

/** A lowercase or digit followed by a capital: "summitLog" → "summit Log". */
const WORD_BOUNDARY = /([a-z0-9])([A-Z])/g;

const WHITESPACE_RUN = /\s+/;

/**
 * kebab-cases a PascalCase or camelCase identifier, treating a run of capitals
 * as a single word.
 *
 * Hand-rolled rather than pulled from a utility library because the exact
 * acronym behaviour is part of the documented convention: most kebab-case
 * helpers turn `LocalAI` into `local-a-i`, which would make the rule
 * unpredictable for anyone naming a new feature.
 */
function kebabCase(value: string): string {
  return value
    .replace(ACRONYM_BOUNDARY, '$1 $2')
    .replace(WORD_BOUNDARY, '$1 $2')
    .trim()
    .toLowerCase()
    .split(WHITESPACE_RUN)
    .filter((part) => part.length > 0)
    .join('-');
}
