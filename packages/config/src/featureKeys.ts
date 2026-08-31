// The naming rule that ties a feature's two gates together.
//
// Every new feature has both:
//   1. a `FeatureFlag` key in config.ts  — can we turn this on at all?
//   2. a `feature_access` row            — who is allowed to use it?
//
// These answer different questions and both are required. A flag alone ships a
// feature with no decision about who gets it; an access row alone leaves no way
// to switch the feature off. The convention is both, always — see
// docs/access-decisions.md.
//
// Before this rule the two namespaces were unrelated and nothing checked them
// against each other: the one live gate used the access key `'wildlife'` for a
// feature whose flag is `enableWildlifeIdentification`. Deriving one name from
// the other is what makes the pairing checkable rather than a matter of memory.
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
  const withoutPrefix = flagKey.startsWith(ENABLE_PREFIX)
    ? flagKey.slice(ENABLE_PREFIX.length)
    : flagKey;

  return kebabCase(withoutPrefix);
}

/**
 * kebab-cases a PascalCase or camelCase identifier, treating a run of capitals
 * as a single word.
 *
 * Hand-rolled rather than pulled from a utility library because the exact
 * acronym behaviour is part of the documented convention: most kebab-case
 * helpers turn `LocalAI` into `local-a-i`, which would make the rule
 * unpredictable for anyone naming a new feature.
 */
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
