#!/usr/bin/env bun
/**
 * check-route-schemas.ts — enforces that no named Zod schema is defined
 * inside packages/api/src/routes/ or packages/api/src/services/.
 *
 * All schemas must live in @packrat/schemas (packages/schemas/src/).
 * Route files must only import — never define.
 *
 * A "named schema" is a top-level const at column 0:
 *   const FooSchema = z.    ← VIOLATION
 *
 * Inline anonymous schemas in route config are fine:
 *   body: z.object({...})   ← OK (indented)
 *
 * Run:         bun ./src/check-route-schemas.ts
 * Strict mode: bun ./src/check-route-schemas.ts --strict
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCAN_ROOTS = ['packages/api/src/routes', 'packages/api/src/services'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '__tests__']);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx']);

// Top-level named schema: starts at column 0, no leading whitespace
const NAMED_SCHEMA_PATTERN = /^const \w+Schema\s*=\s*z\./;

// Legitimate exceptions: AI response parsing schemas and auth middleware internals
// that validate private service boundaries, not API wire types.
const ALLOWED_FILES = new Set([
  'packages/api/src/services/packService.ts',
  'packages/api/src/services/imageDetectionService.ts',
  'packages/api/src/services/wildlifeIdentificationService.ts',
  'packages/api/src/middleware/cfAccess.ts',
]);

interface Violation {
  file: string;
  line: number;
  text: string;
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (TARGET_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

const violations: Violation[] = [];

for (const root of SCAN_ROOTS) {
  const absRoot = join(ROOT, root);
  for (const file of collectFiles(absRoot)) {
    const rel = file.slice(ROOT.length + 1);
    if (ALLOWED_FILES.has(rel)) continue;
    const lines = readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && NAMED_SCHEMA_PATTERN.test(line)) {
        violations.push({ file: rel, line: i + 1, text: line.trim() });
      }
    }
  }
}

if (violations.length === 0) {
  console.log('✓ No inline route/service schemas found.');
  process.exit(0);
}

console.log(`Found ${violations.length} inline schema definition(s) in route/service files.\n`);
console.log('All Zod schemas must live in packages/schemas/src/.\n');
for (const v of violations) {
  console.log(`  ${v.file}:${v.line}`);
  console.log(`    ${v.text}\n`);
}

const strict = process.argv.includes('--strict');
if (strict) {
  process.exit(1);
}
