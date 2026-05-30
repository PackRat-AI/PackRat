#!/usr/bin/env bun
//
// no-owned-max-params.ts - enforces object params for owned functions.
//
// Biome's useMaxParams rule is intentionally broad, so it also catches JS,
// React, test, and framework callbacks whose positional signatures are not
// ours to redesign. Biome stays at max: 2 as a general backstop. This check
// adds the project-specific rule: owned function definitions should take at
// most one parameter, while inline callbacks passed to other APIs are ignored.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import ts from 'typescript';

const ROOT = join(import.meta.dir, '..', '..');
const SCAN_ROOTS = ['apps', 'packages'];
const MAX_OWNED_PARAMS = 1;

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.expo',
  '.turbo',
  '.wrangler',
  'coverage',
]);

const EXCLUDED_PATH_PARTS = [
  '/test/',
  '/__tests__/',
  // Hand-written stubs of external/framework classes (e.g. the Cloudflare
  // `WorkflowEntrypoint` base) must mirror the framework's positional
  // constructor/method signatures, not our object-param convention.
  '/__test-stubs__/',
  '/mocks/',
  '/playwright/',
];
const EXCLUDED_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
const EXCLUDED_FILES = new Set([
  // This service intentionally mirrors Cloudflare R2's positional API.
  'packages/api/src/services/r2-bucket.ts',
  // These build scripts override globalThis.fetch with a shim that must
  // match the runtime's (input, init) signature.
  'apps/landing/scripts/generate-og-images.ts',
  'apps/guides/scripts/generate-og-images.ts',
  'apps/trails/scripts/generate-og-images.ts',
  // CLI dev script: its two 2-param functions are a JS `Proxy` `get` trap
  // (signature fixed by the language) and an inline `AgentContext.registerFlaggedTool`
  // implementation (signature fixed by that interface) — neither is an owned API.
  'packages/mcp/scripts/dump-catalog.ts',
]);
// Cloudflare Workers/Workflows runtime entrypoint handlers — the runtime calls
// these with fixed positional args, exactly like `fetch`/`queue`.
const FRAMEWORK_METHOD_NAMES = new Set(['fetch', 'queue', 'scheduled', 'run', 'resolveRequest']);
const EXTERNAL_CALLBACK_NAMES = new Set([
  'fetcher',
  'keyExtractor',
  'list',
  'onChange',
  'onContentSizeChange',
  'onError',
  'onSettled',
  'onSuccess',
  'orderBy',
  'renderItem',
  'set',
  'setItem',
  'webpack',
]);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

interface Violation {
  file: string;
  line: number;
  column: number;
  name: string;
  count: number;
}

function isTargetFile(relPath: string): boolean {
  if (EXCLUDED_FILES.has(relPath)) return false;
  if (EXCLUDED_PATH_PARTS.some((part) => relPath.includes(part))) return false;
  if (EXCLUDED_SUFFIXES.some((suffix) => relPath.endsWith(suffix))) return false;
  return TARGET_EXTENSIONS.has(extname(relPath));
}

function collectFiles(dir: string, relDir: string, files: string[]): void {
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
      collectFiles(full, rel, files);
    } else if (isTargetFile(rel)) {
      files.push(rel);
    }
  }
}

function scriptKindForPath(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))
    return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function unwrapExpressionParent(node: ts.Node): ts.Node {
  let current: ts.Node = node;

  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent) ||
    ts.isTypeAssertionExpression(current.parent) ||
    ts.isNonNullExpression(current.parent)
  ) {
    current = current.parent;
  }

  return current.parent;
}

function isInlineCallback(node: ts.FunctionLikeDeclaration): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;

  const parent = unwrapExpressionParent(node);
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    return (
      parent.arguments?.some((argument) => {
        let current: ts.Node = node;
        while (current.parent && current.parent !== parent) current = current.parent;
        return current === argument;
      }) === true
    );
  }

  return false;
}

function hasBody(node: ts.FunctionLikeDeclaration): boolean {
  return 'body' in node && node.body !== undefined;
}

function isAssertionPredicate(node: ts.FunctionLikeDeclaration): boolean {
  const type = node.type;
  if (!type) return false;
  return ts.isTypePredicateNode(type) && type.assertsModifier !== undefined;
}

function functionName(node: ts.FunctionLikeDeclaration): string {
  if ('name' in node && node.name) return node.name.getText();

  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent)) return parent.name.getText();
  if (ts.isBinaryExpression(parent) && ts.isPropertyAccessExpression(parent.left)) {
    return parent.left.name.text;
  }

  return '<anonymous>';
}

function isFrameworkObjectMethod(node: ts.FunctionLikeDeclaration): boolean {
  if (
    !ts.isMethodDeclaration(node) &&
    !ts.isFunctionExpression(node) &&
    !ts.isArrowFunction(node)
  ) {
    return false;
  }

  const name = functionName(node).replace(/^['"]|['"]$/g, '');
  return FRAMEWORK_METHOD_NAMES.has(name);
}

function isExternalCallback(node: ts.FunctionLikeDeclaration): boolean {
  if (EXTERNAL_CALLBACK_NAMES.has(functionName(node).replace(/^['"]|['"]$/g, ''))) return true;

  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  const parent = unwrapExpressionParent(node);

  if (ts.isPropertyAssignment(parent)) {
    return EXTERNAL_CALLBACK_NAMES.has(parent.name.getText().replace(/^['"]|['"]$/g, ''));
  }

  if (
    ts.isJsxExpression(parent) &&
    parent.parent &&
    ts.isJsxAttribute(parent.parent) &&
    ts.isIdentifier(parent.parent.name)
  ) {
    return EXTERNAL_CALLBACK_NAMES.has(parent.parent.name.text);
  }

  return false;
}

function shouldCheck(node: ts.FunctionLikeDeclaration): boolean {
  if (!hasBody(node)) return false;
  if (isInlineCallback(node)) return false;
  if (isExternalCallback(node)) return false;
  if (isAssertionPredicate(node)) return false;
  if (isFrameworkObjectMethod(node)) return false;
  if (ts.isGetAccessor(node) || ts.isSetAccessor(node)) return false;
  return true;
}

function scanFile(relPath: string, violations: Violation[]): void {
  let content: string;
  try {
    content = readFileSync(join(ROOT, relPath), 'utf8');
  } catch {
    return;
  }

  const sourceFile = ts.createSourceFile(
    relPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(relPath),
  );

  function visit(node: ts.Node): void {
    if (ts.isFunctionLike(node) && shouldCheck(node) && node.parameters.length > MAX_OWNED_PARAMS) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        file: relPath,
        line: pos.line + 1,
        column: pos.character + 1,
        name: functionName(node),
        count: node.parameters.length,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const files: string[] = [];
for (const root of SCAN_ROOTS) {
  collectFiles(join(ROOT, root), root, files);
}

const violations: Violation[] = [];
for (const file of files) {
  scanFile(file, violations);
}

if (violations.length > 0) {
  console.log(
    `Owned functions with too many params found (${violations.length}). Use one object parameter for owned APIs; inline callbacks passed to external APIs are ignored:\n`,
  );

  for (const violation of violations) {
    console.log(
      `${violation.file}:${violation.line}:${violation.column}: ${violation.name} has ${violation.count} params`,
    );
  }

  process.exit(1);
}

console.log('No owned functions exceed one parameter.');
