#!/usr/bin/env bun

/**
 * Generates Swift config mirrors from the canonical TypeScript app config.
 *
 * Run from repo root:
 *   bun swift:config
 *
 * Outputs:
 *   apps/swift/Sources/PackRat/Config/AppFeatureFlags.swift
 *   apps/swift/Tests/PackRatUITests/UITestFeatureFlags.swift
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '@packrat/config/config';
import { renderSwiftFeatureFlags } from './lib/config-codegen';

const __dir = dirname(fileURLToPath(import.meta.url));
const sourceDescription = 'packages/config/src/config.ts';

const outputs = [
  {
    enumName: 'AppFeatureFlags',
    path: resolve(__dir, '../Sources/PackRat/Config/AppFeatureFlags.swift'),
  },
  {
    enumName: 'UITestFeatureFlags',
    path: resolve(__dir, '../Tests/PackRatUITests/UITestFeatureFlags.swift'),
  },
];

type FeatureFlags = typeof APP_CONFIG.featureFlags;
type FeatureFlagName = keyof FeatureFlags;

function parseFeatureFlagOverrides(): Partial<Record<FeatureFlagName, boolean>> {
  const raw = process.env.PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES;
  if (!raw?.trim()) return {};

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const knownFlags = new Set(Object.keys(APP_CONFIG.featureFlags));
  const overrides: Partial<Record<FeatureFlagName, boolean>> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!knownFlags.has(key)) {
      throw new Error(`Unknown PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES key: ${key}`);
    }
    if (typeof value !== 'boolean') {
      throw new Error(`PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES.${key} must be a boolean`);
    }
    overrides[key as FeatureFlagName] = value;
  }

  return overrides;
}

function featureFlagsForProfile(): FeatureFlags {
  const profile = process.env.PACKRAT_SWIFT_FEATURE_FLAG_PROFILE ?? 'default';
  const entries = Object.entries(APP_CONFIG.featureFlags) as [FeatureFlagName, boolean][];
  const baseFlags =
    profile === 'default'
      ? Object.fromEntries(entries)
      : profile === 'all-on'
        ? Object.fromEntries(entries.map(([key]) => [key, true]))
        : profile === 'all-off'
          ? Object.fromEntries(entries.map(([key]) => [key, false]))
          : undefined;

  if (!baseFlags) {
    throw new Error(
      `Unsupported PACKRAT_SWIFT_FEATURE_FLAG_PROFILE "${profile}". Use default, all-on, or all-off.`,
    );
  }

  return {
    ...baseFlags,
    ...parseFeatureFlagOverrides(),
  } as FeatureFlags;
}

const featureFlags = featureFlagsForProfile();

for (const output of outputs) {
  const rendered = renderSwiftFeatureFlags({
    enumName: output.enumName,
    featureFlags,
    sourceDescription,
  });
  writeFileSync(output.path, rendered, 'utf8');
  console.log(`✓ Generated ${output.path.replace(`${process.cwd()}/`, '')}`);
}
