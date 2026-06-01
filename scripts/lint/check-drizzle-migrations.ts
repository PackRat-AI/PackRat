#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const MIGRATION_TARGETS = [
  { name: 'packages/api', allowManual: new Set(['0010_great_colleen_wing.sql']) },
  { name: 'packages/osm-db', allowManual: new Set(['0000_extensions.sql']) },
];

const DRIZZLE_FILE_PATTERN = /^\d{4}_[a-z0-9]+(?:_[a-z0-9]+)+\.sql$/;
const DRIZZLE_TEMPLATE_COMMENT = '-- Custom SQL migration file, put your code below! --';

interface Violation {
  packageName: string;
  message: string;
}

function checkTarget(target: (typeof MIGRATION_TARGETS)[number], violations: Violation[]): void {
  const drizzleDir = join(ROOT, target.name, 'drizzle');
  if (!existsSync(drizzleDir)) return;

  const sqlFiles = readdirSync(drizzleDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    if (target.allowManual.has(file)) continue;

    if (!DRIZZLE_FILE_PATTERN.test(file)) {
      violations.push({
        packageName: target.name,
        message: `${file}: migration name must match drizzle-kit format (NNNN_word_word.sql)`,
      });
    }

    const content = readFileSync(join(drizzleDir, file), 'utf-8');
    if (content.includes(DRIZZLE_TEMPLATE_COMMENT)) {
      violations.push({
        packageName: target.name,
        message: `${file}: contains drizzle template comment; regenerate via drizzle-kit instead of hand-writing`,
      });
    }
  }
}

const violations: Violation[] = [];
for (const target of MIGRATION_TARGETS) checkTarget(target, violations);

if (violations.length > 0) {
  console.log(`Drizzle migration checks failed (${violations.length}):\n`);
  for (const violation of violations) {
    console.log(`${violation.packageName}: ${violation.message}`);
  }
  process.exit(1);
}

console.log('Drizzle migration checks passed.');
