#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import ts from 'typescript';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCAN_ROOTS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.expo',
  'drizzle',
  'coverage',
  'ios',
  'android',
]);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const EXCLUDED_FILE_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.stories\./,
  /\.d\.ts$/,
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
  /\/node_modules\//,
  /\/dist\//,
  /\/build\//,
];

const ALLOW_ANNOTATION = /@allow-multi-param/;

interface Violation {
  file: string;
  line: number;
  col: number;
  params: number;
  kind: string;
  snippet: string;
}

function isTargetFile(filePath: string): boolean {
  if (!TARGET_EXTENSIONS.has(extname(filePath))) return false;
  return !EXCLUDED_FILE_PATTERNS.some((p) => p.test(filePath));
}

function getKindLabel(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return 'function declaration';
  if (ts.isMethodDeclaration(node)) return 'method declaration';
  if (ts.isArrowFunction(node)) return 'arrow function';
  if (ts.isFunctionExpression(node)) return 'function expression';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  return 'function-like';
}

function isCallbackForInvocation(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent)) return false;
  return parent.arguments.some((arg) => arg === node);
}

function hasAllowAnnotation(source: ts.SourceFile, node: ts.Node): boolean {
  const fullText = source.getFullText();
  const leading = ts.getLeadingCommentRanges(fullText, node.getFullStart()) ?? [];
  for (const range of leading) {
    if (ALLOW_ANNOTATION.test(fullText.slice(range.pos, range.end))) {
      return true;
    }
  }
  return false;
}

function collectViolations(filePath: string): Violation[] {
  const code = readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionLike(node) &&
      node.parameters.length > 1 &&
      !hasAllowAnnotation(source, node) &&
      !isCallbackForInvocation(node)
    ) {
      const start = source.getLineAndCharacterOfPosition(node.getStart());
      const end = Math.min(node.getEnd(), node.getStart() + 120);
      const snippet = source.getText().slice(node.getStart(), end).replace(/\s+/g, ' ').trim();
      violations.push({
        file: filePath.replace(`${ROOT}/`, ''),
        line: start.line + 1,
        col: start.character + 1,
        params: node.parameters.length,
        kind: getKindLabel(node),
        snippet,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
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
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      walkDir(fullPath);
      continue;
    }

    if (isTargetFile(fullPath)) {
      targetFiles.push(fullPath);
    }
  }
}

for (const root of SCAN_ROOTS) {
  walkDir(join(ROOT, root));
}

const violations = targetFiles.flatMap(collectViolations);

if (violations.length === 0) {
  console.log('✓ No multi-parameter functions found.');
  process.exit(0);
}

console.log(`Found ${violations.length} function(s) with more than 1 parameter:\n`);
let lastFile = '';
for (const v of violations) {
  if (v.file !== lastFile) {
    console.log(`\n  ${v.file}`);
    lastFile = v.file;
  }
  console.log(`    ${v.line}:${v.col} ${v.kind} (${v.params} params)`);
  console.log(`      ${v.snippet}`);
}

console.log('\nPrefer a single typed object parameter.');
console.log('Add @allow-multi-param in a leading comment only when a workaround is required.');
process.exit(1);
