import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from './config';
import { featureAccessKeyForFlag } from './featureKeys';

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
