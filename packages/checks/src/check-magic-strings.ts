#!/usr/bin/env bun
//
// check-magic-strings.ts — flags string literals that appear in 3+ distinct source files.
//
// A string repeated across many files is a candidate for a shared constant, enum value,
// or config entry. Cross-file detection catches what per-file checks miss: a value used
// once per file but scattered across the codebase.
//
// Strings are excluded when they:
//   - Contain spaces (Tailwind combos, sentences — not constant candidates)
//   - Look like URLs, relative/absolute paths, hex colors, or CSS custom properties
//   - Are under 3 or over 80 characters
//   - Appear only on import/export/comment lines
//   - Live in build artifacts: out/, dist/, build/, .next/, .expo/, node_modules/
//   - Live in test/spec/stories files
//
// Run with --strict to exit 1 on violations (default: advisory, exit 0).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCAN_ROOTS = ['apps', 'packages'];

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.expo',
  '.turbo',
  'coverage',
  '__generated__',
]);

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const EXCLUDED_FILE_PATTERNS = [/\.test\./, /\.spec\./, /\.stories\./, /\.d\.ts$/];

const MIN_LITERAL_LENGTH = 3;
const MAX_LITERAL_LENGTH = 80;
const MIN_FILES = 3;

// These appear everywhere by design and are not worth flagging.
const ALLOWLIST = new Set([
  // HTTP verbs
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  // TypeScript primitive names (appear in Zod schemas, error messages)
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'function',
  'null',
  'undefined',
  // Boolean-string representations
  'true',
  'false',
  // Common config/tooling directory names (appear as string args in build configs)
  'node_modules',
  'dist',
  'build',
  'apps',
  'packages',
  'src',
  'out',
  '.next',
  '.expo',
]);

// Matches single- and double-quoted string literals (not across newlines).
const STRING_LITERAL = /(['"])((?:\\.|(?!\1)[^\n])+)\1/g;

// Ignore patterns — all hoisted to top level for Biome useTopLevelRegex compliance.
const RE_RELATIVE_PATH = /^\.{0,2}\//;
const RE_ABSOLUTE_PATH = /^\/[\w-]/;
const RE_HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const RE_SLASH_PATH = /^[\w.-]+(\/[\w.-]+)+$/;
const RE_NUMERIC = /^\d+(\.\d+)?$/;
// CSS utility class pattern (Tailwind): all lowercase+digits connected by dashes.
// Matches flex-1, text-lg, bg-primary, text-muted-foreground, space-y-4, etc.
const RE_CSS_UTILITY = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const RE_SEMVER = /^\d+\.\d+\.\d+/;
// CSS dimension values: 1rem, 1.5rem, 100vh, 9999px, 0.5rem, 100%, etc.
const RE_CSS_DIMENSION = /^\d+(\.\d+)?(%|rem|em|px|vh|vw|ch|pt|ex|deg|fr|s|ms)$/;

function isTargetFile(relPath: string): boolean {
  const ext = relPath.slice(relPath.lastIndexOf('.'));
  if (!TARGET_EXTENSIONS.has(ext)) return false;
  return !EXCLUDED_FILE_PATTERNS.some((p) => p.test(relPath));
}

function shouldIgnoreLiteral(value: string): boolean {
  if (value.length < MIN_LITERAL_LENGTH || value.length > MAX_LITERAL_LENGTH) return true;
  if (ALLOWLIST.has(value)) return true;
  if (value.includes(' ')) return true; // multi-word: Tailwind combos, prose, not constants
  if (value.includes('${')) return true; // template-literal fragment
  if (value.startsWith('http://') || value.startsWith('https://')) return true;
  if (RE_RELATIVE_PATH.test(value)) return true; // relative paths
  if (RE_ABSOLUTE_PATH.test(value)) return true; // absolute paths / routes
  if (RE_HEX_COLOR.test(value)) return true; // hex colors
  if (value.startsWith('--')) return true; // CSS custom properties
  if (RE_SLASH_PATH.test(value)) return true; // slash-separated path-like
  if (RE_NUMERIC.test(value)) return true; // numeric strings
  if (RE_CSS_UTILITY.test(value)) return true; // Tailwind utility classes
  if (value.startsWith('@')) return true; // package import paths
  if (value.includes(',')) return true; // comma-separated values (MIME types, accept headers)
  if (value.includes('(')) return true; // function-like (CSS functions, e.g. hsl(var(...)))
  if (value.includes('*') || value.includes('?')) return true; // glob patterns
  if (RE_SEMVER.test(value)) return true; // semver / version strings
  if (value.includes(':')) return true; // Tailwind variant syntax (ios:, hover:), URL schemes
  if (RE_CSS_DIMENSION.test(value)) return true; // CSS dimension values
  return false;
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export {') ||
    trimmed.startsWith('export type {') ||
    trimmed.startsWith('// ') ||
    trimmed.startsWith('//\t') ||
    trimmed === '//' ||
    trimmed.startsWith('* ') ||
    trimmed === '*' ||
    trimmed.startsWith('/*')
  );
}

// Maps literal value → set of distinct relative file paths it appears in.
const literalFiles = new Map<string, Set<string>>();

const allFiles: string[] = [];

function collectFiles(dir: string, relDir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = `${relDir}/${entry}`;
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      collectFiles(full, rel);
    } else if (isTargetFile(rel)) {
      allFiles.push(rel);
    }
  }
}

function scanFile(relPath: string): void {
  let content: string;
  try {
    content = readFileSync(join(ROOT, relPath), 'utf8');
  } catch {
    return;
  }

  const seenInFile = new Set<string>(); // one entry per file, regardless of repetition count

  for (const line of content.split('\n')) {
    if (shouldSkipLine(line)) continue;

    STRING_LITERAL.lastIndex = 0;
    for (;;) {
      const match = STRING_LITERAL.exec(line);
      if (match === null) break;
      const value = match[2];
      if (!value || shouldIgnoreLiteral(value)) continue;
      if (seenInFile.has(value)) continue;
      seenInFile.add(value);
      const files = literalFiles.get(value) ?? new Set<string>();
      files.add(relPath);
      literalFiles.set(value, files);
    }
  }
}

for (const root of SCAN_ROOTS) {
  collectFiles(join(ROOT, root), root);
}

for (const f of allFiles) {
  scanFile(f);
}

const violations = [...literalFiles.entries()]
  .filter(([, files]) => files.size >= MIN_FILES)
  .sort((a, b) => b[1].size - a[1].size);

if (violations.length === 0) {
  console.log(`✓ No cross-file magic strings found (scanned ${allFiles.length} files).`);
  process.exit(0);
}

console.log(
  `Magic string candidates (${violations.length}) appearing in ${MIN_FILES}+ distinct files — prefer shared constants/enums:\n`,
);

for (const [literal, files] of violations) {
  const sorted = [...files].sort();
  console.log(`  "${literal}"  (${files.size} files)`);
  for (const f of sorted) {
    console.log(`    ${f}`);
  }
}

console.log(
  '\nTip: move repeated literals to a frozen constant or enum in a shared package (e.g. packages/config).',
);

const strictMode = process.argv.includes('--strict');
if (strictMode) process.exit(1);
