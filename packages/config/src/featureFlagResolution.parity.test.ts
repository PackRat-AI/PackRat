import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeFeatureFlags } from './featureFlagResolution';

// Parity suite. Drives the TypeScript resolver from the same fixture the Swift
// suite reads (apps/swift/Tests/PackRatTests/FeatureFlagResolutionTests.swift),
// so a behavioural change on one platform fails the other's build.
//
// Add cases to the fixture, never to this file — a case that lives in only one
// language is the drift this suite exists to catch.

interface ParityCase {
  name: string;
  defaults: Record<string, boolean>;
  source: Record<string, unknown> | null;
  expected: Record<string, boolean>;
}

const fixturePath = resolve(__dirname, '../fixtures/feature-flag-resolution.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { cases: ParityCase[] };

describe('feature-flag resolution parity fixture', () => {
  it('the fixture is non-empty', () => {
    // Guards against a malformed fixture silently reducing this suite to a no-op.
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      expect(
        normalizeFeatureFlags({ source: testCase.source, defaults: testCase.defaults }),
      ).toEqual(testCase.expected);
    });
  }
});
