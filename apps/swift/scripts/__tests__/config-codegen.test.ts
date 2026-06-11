import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_CONFIG } from '@packrat/config/config';
import { describe, expect, it } from 'vitest';
import { renderSwiftFeatureFlags, swiftIdentifier } from '../lib/config-codegen';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const sourceDescription = 'packages/config/src/config.ts';

describe('swiftIdentifier', () => {
  it('keeps camelCase feature flag names as lower-camel Swift identifiers', () => {
    expect(swiftIdentifier('enableWildlifeIdentification')).toBe('enableWildlifeIdentification');
  });

  it('removes punctuation from generated identifiers', () => {
    expect(swiftIdentifier('Enable-Trails')).toBe('enableTrails');
  });
});

describe('renderSwiftFeatureFlags', () => {
  it('renders a deterministic Swift enum from feature flags', () => {
    expect(
      renderSwiftFeatureFlags({
        enumName: 'AppFeatureFlags',
        sourceDescription: 'packages/config/src/config.ts',
        featureFlags: {
          enableTrips: true,
          enableFeed: false,
        },
      }),
    ).toBe(`// @generated - DO NOT EDIT
// Run \`bun swift:config\` to regenerate from packages/config/src/config.ts.

import Foundation

enum AppFeatureFlags {
    static let enableFeed = false
    static let enableTrips = true
}
`);
  });

  it('keeps generated Swift feature flag files in sync with package config', () => {
    const outputs = [
      {
        enumName: 'AppFeatureFlags',
        path: resolve(repoRoot, 'apps/swift/Sources/PackRat/Config/AppFeatureFlags.swift'),
      },
      {
        enumName: 'UITestFeatureFlags',
        path: resolve(repoRoot, 'apps/swift/Tests/PackRatUITests/UITestFeatureFlags.swift'),
      },
    ];

    for (const output of outputs) {
      expect(readFileSync(output.path, 'utf8')).toBe(
        renderSwiftFeatureFlags({
          enumName: output.enumName,
          featureFlags: APP_CONFIG.featureFlags,
          sourceDescription,
        }),
      );
    }
  });
});
