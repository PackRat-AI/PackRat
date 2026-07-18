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
import { nodeEnv } from '@packrat/env/node';
import { isObject } from '@packrat/guards';
import { safeJsonParse } from '@packrat/utils';
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

function isFeatureFlagName(value: string): value is FeatureFlagName {
  return Object.hasOwn(APP_CONFIG.featureFlags, value);
}

function featureFlagsWithValue(value: boolean): FeatureFlags {
  const flags = { ...APP_CONFIG.featureFlags };
  for (const key of Object.keys(flags)) {
    if (isFeatureFlagName(key)) flags[key] = value;
  }
  return flags;
}

function parseFeatureFlagOverrides(): Partial<Record<FeatureFlagName, boolean>> {
  const raw = nodeEnv.PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES;
  if (!raw?.trim()) return {};

  const parsed = safeJsonParse(raw);
  if (!isObject(parsed)) {
    throw new Error('PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES must be a JSON object');
  }
  const overrides: Partial<Record<FeatureFlagName, boolean>> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!isFeatureFlagName(key)) {
      throw new Error(`Unknown PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES key: ${key}`);
    }
    if (value !== true && value !== false) {
      throw new Error(`PACKRAT_SWIFT_FEATURE_FLAG_OVERRIDES.${key} must be a boolean`);
    }
    overrides[key] = value;
  }

  return overrides;
}

function featureFlagsForProfile(): FeatureFlags {
  const profile = nodeEnv.PACKRAT_SWIFT_FEATURE_FLAG_PROFILE ?? 'default';
  const baseFlags =
    profile === 'default'
      ? { ...APP_CONFIG.featureFlags }
      : profile === 'all-on'
        ? featureFlagsWithValue(true)
        : profile === 'all-off'
          ? featureFlagsWithValue(false)
          : undefined;

  if (!baseFlags) {
    throw new Error(
      `Unsupported PACKRAT_SWIFT_FEATURE_FLAG_PROFILE "${profile}". Use default, all-on, or all-off.`,
    );
  }

  return {
    ...baseFlags,
    ...parseFeatureFlagOverrides(),
  };
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
