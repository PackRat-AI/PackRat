import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasFeatureAccess, isInEarlyAccess } from './featureAccess';

// Parity suite. Drives the TypeScript resolver from the same fixture the Swift
// suite reads (apps/swift/Tests/PackRatTests/FeatureAccessTests.swift), so a
// behavioural change on one platform fails the other's build.
//
// This resolver is enforced server-side and mirrored on both clients. When the
// implementations disagree, a user is shown a feature the API then refuses to
// serve — or is denied one they have paid for.
//
// Add cases to the fixture, never to this file.

interface ParityCase {
  name: string;
  earlyAccessUntil: string | null;
  hasPro: boolean;
  expectedInEarlyAccess: boolean;
  expectedHasAccess: boolean;
}

const fixturePath = resolve(__dirname, '../fixtures/feature-access-resolution.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  now: string;
  cases: ParityCase[];
};

const now = new Date(fixture.now);

describe('feature-access resolution parity fixture', () => {
  it('the fixture is non-empty and its clock parses', () => {
    // Guards against a malformed fixture silently reducing this suite to a
    // no-op, or an unparseable `now` making every case pass vacuously.
    expect(fixture.cases.length).toBeGreaterThan(0);
    expect(Number.isNaN(now.getTime())).toBe(false);
  });

  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      const feature = { earlyAccessUntil: testCase.earlyAccessUntil };

      expect(isInEarlyAccess(feature, now)).toBe(testCase.expectedInEarlyAccess);
      expect(hasFeatureAccess(feature, { hasPro: testCase.hasPro, now })).toBe(
        testCase.expectedHasAccess,
      );
    });
  }
});
