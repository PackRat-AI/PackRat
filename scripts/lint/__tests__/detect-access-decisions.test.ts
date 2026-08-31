import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  configDiffSlice,
  DECISION_BLOCK_HEADING,
  DECLARATIONS,
  newFeatureFlagKeys,
  newFlagsDefaultingTrue,
  parseDecision,
  validateConvention,
  validateDecision,
} from '../detect-access-decisions';

// A diff that adds one flag key to the FeatureFlag map.
const DIFF_WITH_NEW_FLAG = `diff --git a/packages/config/src/config.ts b/packages/config/src/config.ts
index 1111111..2222222 100644
--- a/packages/config/src/config.ts
+++ b/packages/config/src/config.ts
@@ -14,6 +14,7 @@ const FeatureFlag = Object.freeze({
   EnableTrails: 'enableTrails',
   EnableRevenueCat: 'enableRevenueCat',
+  EnableSummitLog: 'enableSummitLog',
 });
`;

// A diff that touches config.ts without adding a flag — the common case this
// detector must stay quiet for.
const DIFF_WITHOUT_NEW_FLAG = `diff --git a/packages/config/src/config.ts b/packages/config/src/config.ts
index 1111111..2222222 100644
--- a/packages/config/src/config.ts
+++ b/packages/config/src/config.ts
@@ -60,7 +60,7 @@ const APP_CONFIG_SOURCE = {
-    [FeatureFlag.EnableTrails]: false,
+    [FeatureFlag.EnableTrails]: true,
   },
`;

describe('newFeatureFlagKeys', () => {
  it('finds a flag key added to the FeatureFlag map', () => {
    expect(newFeatureFlagKeys(DIFF_WITH_NEW_FLAG)).toEqual(['enableSummitLog']);
  });

  it('a value flip is not a new key', () => {
    // Flipping an existing default is a decision already made; only a brand-new
    // key means a feature nobody has ruled on yet.
    expect(newFeatureFlagKeys(DIFF_WITHOUT_NEW_FLAG)).toEqual([]);
  });

  it('an empty diff yields no keys', () => {
    expect(newFeatureFlagKeys('')).toEqual([]);
  });

  it('a removed key is not counted as added', () => {
    const removal = `--- a/packages/config/src/config.ts
+++ b/packages/config/src/config.ts
-  EnableOldThing: 'enableOldThing',
`;
    expect(newFeatureFlagKeys(removal)).toEqual([]);
  });

  it('finds several keys added at once', () => {
    const twoKeys = `+++ b/packages/config/src/config.ts
+  EnableAlpha: 'enableAlpha',
+  EnableBeta: 'enableBeta',
`;
    expect(newFeatureFlagKeys(twoKeys)).toEqual(['enableAlpha', 'enableBeta']);
  });
});

describe('configDiffSlice', () => {
  it('returns the config.ts section of a multi-file diff', () => {
    const multi = `diff --git a/README.md b/README.md
+some docs
${DIFF_WITH_NEW_FLAG}diff --git a/other.ts b/other.ts
+  Unrelated: 'unrelated',
`;
    const slice = configDiffSlice(multi);
    expect(slice).toContain('enableSummitLog');
    // The unrelated file's added entry must not leak into the slice, or an
    // ordinary object literal elsewhere would trip the gate.
    expect(slice).not.toContain('unrelated');
  });

  it('returns empty string when config.ts is untouched', () => {
    expect(configDiffSlice('diff --git a/README.md b/README.md\n+docs\n')).toBe('');
  });
});

describe('parseDecision', () => {
  it('returns null when the body has no decision block', () => {
    const { decision, errors } = parseDecision('Just a normal PR description.');
    expect(decision).toBeNull();
    expect(errors).toEqual([]);
  });

  it('parses a complete early-access decision', () => {
    const body = `Some context.

${DECISION_BLOCK_HEADING}
declaration: new-feature
audience: early-access
feature-key: summit-log
expiry: 2026-10-15
`;
    const { decision, errors } = parseDecision(body);
    expect(errors).toEqual([]);
    expect(decision).toEqual({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.EarlyAccess,
      featureKey: 'summit-log',
      expiry: '2026-10-15',
    });
  });

  it('parses a `none` declaration', () => {
    const { decision } = parseDecision(`${DECISION_BLOCK_HEADING}\ndeclaration: none\n`);
    expect(decision?.declaration).toBe(DECLARATIONS.None);
  });

  it('tolerates list markers, bold, and mixed case', () => {
    const body = `${DECISION_BLOCK_HEADING}
- **Declaration:** New-Feature
- **Audience:** Everyone
- **Feature-key:** summit-log
`;
    const { decision, errors } = parseDecision(body);
    expect(errors).toEqual([]);
    expect(decision?.declaration).toBe(DECLARATIONS.NewFeature);
    expect(decision?.audience).toBe(AUDIENCES.Everyone);
    expect(decision?.featureKey).toBe('summit-log');
  });

  it('stops at the next heading so later prose is not absorbed', () => {
    const body = `${DECISION_BLOCK_HEADING}
declaration: none

## Testing
feature-key: not-a-real-decision
`;
    const { decision } = parseDecision(body);
    expect(decision?.featureKey).toBeUndefined();
  });

  it('a block with no declaration field is an error, not silence', () => {
    const { decision, errors } = parseDecision(`${DECISION_BLOCK_HEADING}\naudience: everyone\n`);
    expect(decision).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('an unknown declaration is rejected rather than guessed at', () => {
    const { decision, errors } = parseDecision(
      `${DECISION_BLOCK_HEADING}\ndeclaration: probably-fine\n`,
    );
    expect(decision).toBeNull();
    expect(errors[0]).toContain('Unknown declaration');
  });

  it('an unknown audience is reported', () => {
    const { errors } = parseDecision(
      `${DECISION_BLOCK_HEADING}\ndeclaration: new-feature\naudience: some-users\n`,
    );
    expect(errors[0]).toContain('Unknown audience');
  });
});

describe('validateDecision', () => {
  it('a missing decision gates', () => {
    expect(validateDecision(null).length).toBeGreaterThan(0);
  });

  it('declaring `none` against a diff that adds a flag gates', () => {
    // validateDecision is only reached when a new key was detected, so `none`
    // here means the agent's classification contradicts the diff.
    const problems = validateDecision({ declaration: DECLARATIONS.None });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain('declaration says `none`');
  });

  it('a new feature with no audience gates — an agent must not choose', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      featureKey: 'summit-log',
    });
    expect(problems.some((p) => p.includes('audience'))).toBe(true);
  });

  it('a new feature with no feature-key gates', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.Everyone,
    });
    expect(problems.some((p) => p.includes('feature-key'))).toBe(true);
  });

  it('early-access without an expiry gates', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.EarlyAccess,
      featureKey: 'summit-log',
    });
    expect(problems.some((p) => p.includes('expiry'))).toBe(true);
  });

  it('early-access with a malformed expiry gates', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.EarlyAccess,
      featureKey: 'summit-log',
      expiry: 'next month',
    });
    expect(problems.some((p) => p.includes('ISO date'))).toBe(true);
  });

  it('early-access with an impossible date gates', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.EarlyAccess,
      featureKey: 'summit-log',
      expiry: '2026-02-31',
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('a complete early-access decision passes', () => {
    expect(
      validateDecision({
        declaration: DECLARATIONS.NewFeature,
        audience: AUDIENCES.EarlyAccess,
        featureKey: 'summit-log',
        expiry: '2026-10-15',
      }),
    ).toEqual([]);
  });

  it('a complete everyone decision passes', () => {
    expect(
      validateDecision({
        declaration: DECLARATIONS.NewFeature,
        audience: AUDIENCES.Everyone,
        featureKey: 'summit-log',
      }),
    ).toEqual([]);
  });

  it('an expiry on an everyone decision gates — GA has no window', () => {
    const problems = validateDecision({
      declaration: DECLARATIONS.NewFeature,
      audience: AUDIENCES.Everyone,
      featureKey: 'summit-log',
      expiry: '2026-10-15',
    });
    expect(problems.some((p) => p.includes('omitted'))).toBe(true);
  });
});

describe('newFlagsDefaultingTrue', () => {
  it('flags a new default added as true', () => {
    // A new feature that ships on for everyone at merge — the undecided
    // rollout the gate exists to prevent, and one no PR-body edit can undo.
    const diff = `+++ b/packages/config/src/config.ts
+    [FeatureFlag.EnableSummitLog]: true,
`;
    expect(newFlagsDefaultingTrue(diff)).toEqual(['EnableSummitLog']);
  });

  it('ignores a new default added as false', () => {
    const diff = `+++ b/packages/config/src/config.ts
+    [FeatureFlag.EnableSummitLog]: false,
`;
    expect(newFlagsDefaultingTrue(diff)).toEqual([]);
  });

  it('ignores a removed true default', () => {
    const diff = `-    [FeatureFlag.EnableOldThing]: true,
`;
    expect(newFlagsDefaultingTrue(diff)).toEqual([]);
  });

  it('returns nothing for an empty diff', () => {
    expect(newFlagsDefaultingTrue('')).toEqual([]);
  });
});

describe('validateConvention', () => {
  it('is silent when no flag was added', () => {
    // Most PRs. The convention only applies to new features.
    expect(validateConvention({ flagKeys: [] })).toEqual([]);
  });

  it('requires a feature-key when a flag was added', () => {
    const problems = validateConvention({ flagKeys: ['enableSummitLog'] });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain('also needs a feature_access key');
  });

  it('names the expected derived key so the fix is obvious', () => {
    const problems = validateConvention({ flagKeys: ['enableSummitLog'] });
    expect(problems.join(' ')).toContain('summit-log');
  });

  it('accepts a feature-key matching the derived name', () => {
    expect(
      validateConvention({ flagKeys: ['enableSummitLog'], declaredKey: 'summit-log' }),
    ).toEqual([]);
  });

  it('rejects a feature-key that does not match the flag', () => {
    // The pairing is what makes the two gates checkable rather than a matter
    // of memory, so a mismatched name has to fail.
    const problems = validateConvention({
      flagKeys: ['enableSummitLog'],
      declaredKey: 'summitlog',
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain('does not match');
  });

  it('accepts any one of several added flags', () => {
    // A PR adding two flags declares one access key; requiring one per flag
    // would block a legitimately paired feature.
    expect(
      validateConvention({
        flagKeys: ['enableSummitLog', 'enableTrailPhotos'],
        declaredKey: 'trail-photos',
      }),
    ).toEqual([]);
  });

  it('applies the acronym rule when deriving the expected key', () => {
    expect(validateConvention({ flagKeys: ['enableLocalAI'], declaredKey: 'local-ai' })).toEqual(
      [],
    );
  });
});
