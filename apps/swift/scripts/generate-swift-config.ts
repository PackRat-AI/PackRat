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

for (const output of outputs) {
  const rendered = renderSwiftFeatureFlags({
    enumName: output.enumName,
    featureFlags: APP_CONFIG.featureFlags,
    sourceDescription,
  });
  writeFileSync(output.path, rendered, 'utf8');
  console.log(`✓ Generated ${output.path.replace(`${process.cwd()}/`, '')}`);
}
