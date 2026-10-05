#!/usr/bin/env bun

/**
 * Builds the bundled **core species pack** shipped inside the iOS app.
 *
 * Run from repo root:
 *   bun swift:species-pack
 *
 * Output:
 *   apps/swift/Resources/SpeciesPacks/core.json
 *
 * The species content is generated from `apps/expo/features/wildlife/data/
 * speciesDatabase.ts` rather than hand-copied into Swift, because that file is
 * the canonical domain shape for both platforms (see docs/features/
 * offline-wildlife-id.md). Copying it would let iOS and Android drift on the
 * one field that matters most — `dangerLevel`.
 *
 * The pack is versioned independently of the app binary so a content-only
 * correction can ship through the regional-pack pipeline without a release.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeJsonStringify } from '@packrat/utils';
import { SPECIES_DATABASE } from '../../expo/features/wildlife/data/speciesDatabase';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dir, '../Resources/SpeciesPacks/core.json');

/**
 * Bumped by hand when the pack's *content* changes. The app compares this
 * against the version of any downloaded pack to decide which to prefer, so it
 * must move whenever a species is added, removed, or has its danger level
 * corrected.
 */
const PACK_VERSION = 1;

const pack = {
  id: 'core',
  version: PACK_VERSION,
  // Stated plainly rather than implied — the app tells the user what its
  // loaded packs actually cover.
  displayName: 'Core species',
  regions: [...new Set(SPECIES_DATABASE.flatMap((s) => s.regions))].sort(),
  species: [...SPECIES_DATABASE].sort((a, b) => a.id.localeCompare(b.id)),
};

writeFileSync(outputPath, `${safeJsonStringify(pack, null, 2)}\n`);
// The pack is a checked-in generated file, so it has to satisfy the same
// Biome formatter the pre-commit hook runs over everything else.
spawnSync('bunx', ['biome', 'format', '--write', outputPath], { stdio: 'inherit' });
console.log(`✓ Generated ${outputPath} (${pack.species.length} species, v${PACK_VERSION})`);
