import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from './config';
import { featureAccessKeyForFlag, featureLabelForFlag } from './featureKeys';

describe('featureAccessKeyForFlag', () => {
  it('drops the enable prefix and kebab-cases the rest', () => {
    expect(featureAccessKeyForFlag('enableSummitLog')).toBe('summit-log');
    expect(featureAccessKeyForFlag('enableTrips')).toBe('trips');
  });

  it('treats a run of capitals as one word', () => {
    // The documented acronym behaviour. `local-a-i` — what most kebab-case
    // helpers produce — would make the rule unpredictable for anyone naming a
    // feature, which defeats the point of a derivable name.
    expect(featureAccessKeyForFlag('enableLocalAI')).toBe('local-ai');
    expect(featureAccessKeyForFlag('enableOAuth')).toBe('oauth');
  });

  it('splits a capital run from a following capitalised word', () => {
    expect(featureAccessKeyForFlag('enableAPIKeyRotation')).toBe('api-key-rotation');
  });

  it('passes through a key that does not start with enable', () => {
    // Not expected in practice, but the function stays total rather than
    // throwing — a lint reporting a bad name is more useful than a crash.
    expect(featureAccessKeyForFlag('summitLog')).toBe('summit-log');
  });

  it('handles digits as part of the preceding word', () => {
    expect(featureAccessKeyForFlag('enablePack2Sync')).toBe('pack2-sync');
  });

  it('is deterministic', () => {
    // CI verifies the flag/access pairing by re-deriving it, so the same input
    // must always give the same output.
    expect(featureAccessKeyForFlag('enableSharedPacks')).toBe(
      featureAccessKeyForFlag('enableSharedPacks'),
    );
  });

  it('derives a distinct, non-empty key for every shipped flag', () => {
    // Pins the rule's real output across the whole current flag set, and proves
    // no two flags collapse to the same access key — a collision would silently
    // gate two features on one row.
    const derived = Object.keys(APP_CONFIG.featureFlags).map(featureAccessKeyForFlag);

    for (const key of derived) {
      expect(key.length).toBeGreaterThan(0);
      // Access keys are lower-kebab: no capitals, no underscores, no spaces.
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }

    expect(new Set(derived).size).toBe(derived.length);
  });

  it('derives the documented keys for the shipped flags', () => {
    // An explicit table, so a change to the rule shows up as a readable diff
    // rather than as an opaque assertion failure.
    expect(featureAccessKeyForFlag('enableWildlifeIdentification')).toBe('wildlife-identification');
    expect(featureAccessKeyForFlag('enablePackInsights')).toBe('pack-insights');
    expect(featureAccessKeyForFlag('enableShoppingList')).toBe('shopping-list');
    expect(featureAccessKeyForFlag('enableSharedPacks')).toBe('shared-packs');
    expect(featureAccessKeyForFlag('enablePackTemplates')).toBe('pack-templates');
    expect(featureAccessKeyForFlag('enableTrailConditions')).toBe('trail-conditions');
    expect(featureAccessKeyForFlag('enableRevenueCat')).toBe('revenue-cat');
    expect(featureAccessKeyForFlag('enableFeed')).toBe('feed');
    expect(featureAccessKeyForFlag('enableTrails')).toBe('trails');
  });
});

describe('featureLabelForFlag', () => {
  it('title-cases the words of a flag name', () => {
    expect(featureLabelForFlag('enableSummitLog')).toBe('Summit Log');
    expect(featureLabelForFlag('enableTrips')).toBe('Trips');
  });

  it('keeps acronyms capitalised', () => {
    // "Local A I" or "Local Ai" would both read as a mistake in the admin UI.
    expect(featureLabelForFlag('enableLocalAI')).toBe('Local AI');
    expect(featureLabelForFlag('enableOAuth')).toBe('OAuth');
  });

  it('handles a multi-word flag with an acronym', () => {
    expect(featureLabelForFlag('enableAPIKeyRotation')).toBe('API Key Rotation');
  });

  it('derives a non-empty label for every shipped flag', () => {
    for (const flagKey of Object.keys(APP_CONFIG.featureFlags)) {
      const label = featureLabelForFlag(flagKey);
      expect(label.length).toBeGreaterThan(0);
      // No leftover kebab hyphens or camelCase runs.
      expect(label).not.toContain('-');
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    }
  });

  it('derives the documented labels for the shipped flags', () => {
    expect(featureLabelForFlag('enableWildlifeIdentification')).toBe('Wildlife Identification');
    expect(featureLabelForFlag('enablePackTemplates')).toBe('Pack Templates');
    expect(featureLabelForFlag('enableTrailConditions')).toBe('Trail Conditions');
    expect(featureLabelForFlag('enableRevenueCat')).toBe('Revenue Cat');
  });
});

describe('featureLabelForFlag edge cases', () => {
  it('title-cases a word whose original spelling is plain lowercase', () => {
    // Exercises the branch where the original casing carries nothing worth
    // preserving, so the word is title-cased normally.
    expect(featureLabelForFlag('enabletrips')).toBe('Trips');
  });

  it('handles a flag key that is only the prefix', () => {
    // Degenerate but total: no words left after stripping `enable`.
    expect(featureLabelForFlag('enable')).toBe('');
  });

  it('title-cases a word that does not appear verbatim in the flag key', () => {
    // A digit boundary splits "pack2sync" into words that are still findable,
    // whereas this one exercises the not-found path in the casing lookup.
    expect(featureLabelForFlag('enableFoo')).toBe('Foo');
  });
});
