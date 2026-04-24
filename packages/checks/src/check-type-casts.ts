#!/usr/bin/env bun
/**
 * Scans the monorepo for bare `as TypeName` type assertions and reports them.
 *
 * These are signs of unsafe narrowing at data boundaries. The preferred
 * pattern is to use guards from `@packrat/guards`:
 *
 *   BAD:  item.weightUnit = unit as WeightUnit
 *  GOOD:  item.weightUnit = parseWeightUnit(unit)
 *
 *   BAD:  category: pack.category as PackCategory
 *  GOOD:  use z.enum(PACK_CATEGORIES) in the schema so the type is already narrow
 *
 * Run:         bun check:casts
 * Strict mode: bun check:casts --strict   (exits 1 on violations)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCAN_ROOTS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', 'drizzle']);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const EXCLUDED_FILE_PATTERNS = [/\.test\./, /\.spec\./, /\.stories\./, /\.d\.ts$/];

// Safe casts that TypeScript requires and cannot be replaced with guards
const SAFE_CAST_PATTERNS = [
  /\bas\s+const\b/,
  /\bas\s+unknown\b/,
  /\bas\s+any\b/,
  /\bas\s+never\b/,
  /\bas\s+keyof\b/,
  /\bas\s+typeof\b/,
  /\bas\s+Parameters\b/,
  /\bas\s+ReturnType\b/,
  /\bas\s+InstanceType\b/,
  /\bas\s+Awaited\b/,
];

// Detects `as SomeType` where SomeType starts with uppercase or is a known type pattern
// Excludes HTML element casts which are necessary in DOM manipulation
const CAST_PATTERN = /\bas\s+([A-Z][A-Za-z0-9_<>[\]|&,\s]*?)(?=\s*[;,)\]}]|\s*\/\/|\s*$)/gm;
const IMPORT_BLOCK_START = /^\s*(import|export)(\s+type)?\s*\{/;
const IMPORT_LINE = /^\s*(import|export)\b/;
const ARRAY_LITERAL_CAST = /\]\s*as\s+[A-Z]/;
const COMMENT_LINE = /^\s*(\/\/|\*)/;
const LOWERCASE_TYPE = /^[a-z][a-z]*$/;

interface Violation {
  file: string;
  line: number;
  col: number;
  cast: string;
  source: string;
}

function isSafeCast(_line: string, castMatch: string): boolean {
  const full = `as ${castMatch}`;
  return SAFE_CAST_PATTERNS.some((p) => p.test(full));
}

function isTargetFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!TARGET_EXTENSIONS.has(ext)) return false;
  return !EXCLUDED_FILE_PATTERNS.some((p) => p.test(filePath));
}

function collectViolations(filePath: string): Violation[] {
  const source = readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const violations: Violation[] = [];
  let insideImportBlock = false;

  for (const [i, line] of lines.entries()) {
    const trimmed = line.trimStart();

    // Track multiline import blocks — `as` inside them is an alias, not a cast
    if (IMPORT_BLOCK_START.test(line)) {
      insideImportBlock = true;
    }
    if (insideImportBlock) {
      if (line.includes('}')) insideImportBlock = false;
      continue;
    }
    if (IMPORT_LINE.test(line)) continue;

    // Skip comment lines
    if (COMMENT_LINE.test(trimmed)) continue;

    // Skip array-literal type hints: `] as Type[]` in config/static data (no call expressions)
    if (ARRAY_LITERAL_CAST.test(line) && !line.includes('(') && !line.includes('=>')) continue;

    CAST_PATTERN.lastIndex = 0;
    for (let match = CAST_PATTERN.exec(line); match !== null; match = CAST_PATTERN.exec(line)) {
      const castType = match[1]?.trim();
      if (!castType || isSafeCast(line, castType)) continue;

      // Skip single-word lowercase types (string, number, boolean, void, etc.)
      if (LOWERCASE_TYPE.test(castType)) continue;

      // Skip `as keyof typeof X` — TypeScript sometimes requires this
      if (castType.startsWith('keyof')) continue;

      violations.push({
        file: filePath.replace(`${ROOT}/`, ''),
        line: i + 1,
        col: match.index + 1,
        cast: castType,
        source: line.trim(),
      });
    }
  }

  return violations;
}

const targetFiles: string[] = [];

function walkDir(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (EXCLUDED_DIRS.has(entry)) continue;
    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      walkDir(fullPath);
    } else if (isTargetFile(fullPath)) {
      targetFiles.push(fullPath);
    }
  }
}

for (const root of SCAN_ROOTS) {
  walkDir(join(ROOT, root));
}

const violations = targetFiles.flatMap(collectViolations);

if (violations.length === 0) {
  console.log('✓ No unsafe type casts found.');
  process.exit(0);
}

console.log(
  `Found ${violations.length} unsafe type cast(s). Replace with guards from @packrat/guards:\n`,
);

let lastFile = '';
for (const v of violations) {
  if (v.file !== lastFile) {
    console.log(`\n  ${v.file}`);
    lastFile = v.file;
  }
  console.log(`    line ${v.line}: as ${v.cast}`);
  console.log(`      ${v.source}`);
}

console.log('\nSuggested replacements:');
console.log('  as WeightUnit        →  fromZod(WeightUnitSchema)(value)');
console.log('  as PackCategory      →  use z.enum(PACK_CATEGORIES) in schema');
console.log('  as T (unknown data)  →  fromZod(schema)(value) or makeEnumGuard(values)(value)');
console.log('  value!               →  assertDefined(value) or isDefined(value)');
console.log('\nSee @packrat/guards for the full catalogue of guards and parsers.');

const strictMode = process.argv.includes('--strict');
if (strictMode) process.exit(1);
