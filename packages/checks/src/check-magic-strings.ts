#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCAN_ROOTS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo']);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const EXCLUDED_FILE_PATTERNS = [/\.test\./, /\.spec\./, /\.stories\./, /\.d\.ts$/];
const RELATIVE_PATH_PATTERN = /^\.{0,2}\//;
const SLASHED_WORD_PATH_PATTERN = /^[\w.-]+(\/[\w.-]+)+$/;
const WHITESPACE_PATTERN = /\s+/;

const MIN_LITERAL_LENGTH = 4;
const MIN_OCCURRENCES_PER_FILE = 3;
const MAX_LITERAL_LENGTH = 80;

const ALLOWLIST = new Set([
  'use client',
  'dark',
  'light',
  'system',
  'POST',
  'GET',
  'PUT',
  'DELETE',
  'PATCH',
]);

// Matches single-quoted and double-quoted string literals (including escaped quotes).
const STRING_LITERAL_PATTERN = /(['"])((?:\\.|(?!\1).)+)\1/g;

interface LiteralLocation {
  line: number;
}

interface FileViolation {
  file: string;
  literal: string;
  count: number;
  lines: number[];
}

function isTargetFile(filePath: string): boolean {
  const extension = filePath.slice(filePath.lastIndexOf('.'));
  if (!TARGET_EXTENSIONS.has(extension)) return false;
  return !EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function shouldIgnoreLiteral(value: string): boolean {
  if (ALLOWLIST.has(value)) return true;
  if (value.length < MIN_LITERAL_LENGTH || value.length > MAX_LITERAL_LENGTH) return true;
  if (value.includes('${')) return true;
  if (value.startsWith('http://') || value.startsWith('https://')) return true;
  if (RELATIVE_PATH_PATTERN.test(value)) return true;
  if (SLASHED_WORD_PATH_PATTERN.test(value)) return true;
  const words = value.trim().split(WHITESPACE_PATTERN);
  if (words.length > 3) return true;
  if (value.startsWith('#')) return true;
  if (value.startsWith('--')) return true;
  return false;
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export ') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  );
}

function collectFileViolations(file: string): FileViolation[] {
  const fullPath = join(ROOT, file);
  let content = '';

  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    return [];
  }

  const byLiteral = new Map<string, LiteralLocation[]>();
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (shouldSkipLine(line)) continue;

    const matches = line.matchAll(STRING_LITERAL_PATTERN);
    for (const match of matches) {
      const value = match[2];
      if (!value || shouldIgnoreLiteral(value)) continue;

      const current = byLiteral.get(value) ?? [];
      current.push({ line: index + 1 });
      byLiteral.set(value, current);
    }
  }

  const violations: FileViolation[] = [];
  for (const [literal, locations] of byLiteral.entries()) {
    if (locations.length < MIN_OCCURRENCES_PER_FILE) continue;
    violations.push({
      file,
      literal,
      count: locations.length,
      lines: locations.map((location) => location.line),
    });
  }

  return violations.sort((a, b) => b.count - a.count);
}

const targetFiles: string[] = [];

function walkDir(dir: string, relDir: string): void {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const relPath = `${relDir}/${entry}`;
    let isDirectory = false;

    try {
      isDirectory = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    if (isDirectory) {
      walkDir(fullPath, relPath);
      continue;
    }

    if (isTargetFile(relPath)) targetFiles.push(relPath);
  }
}

for (const root of SCAN_ROOTS) {
  walkDir(join(ROOT, root), root);
}

const violations = targetFiles.flatMap((file) => collectFileViolations(file));

if (violations.length === 0) {
  console.log('No repeated magic strings found.');
  process.exit(0);
}

console.log('Magic string candidates found. Prefer constants/enums in shared config objects:\n');
for (const violation of violations) {
  console.log(
    `${violation.file}: "${violation.literal}" appears ${violation.count} times (lines: ${violation.lines.join(', ')})`,
  );
}

console.log(
  '\nTip: centralize repeated literals into frozen constants (Object.freeze) or enum-like objects.',
);

const strictMode = process.argv.includes('--strict');
if (strictMode) process.exit(1);
