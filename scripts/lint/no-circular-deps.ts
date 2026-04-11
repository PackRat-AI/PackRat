#!/usr/bin/env bun
//
// no-circular-deps.ts — detects circular import dependencies across the monorepo.
//
// Scans TypeScript/JavaScript source files in:
//   - apps/expo/  (skipping node_modules, .expo, dist)
//   - packages/*/src/
//
// Builds an import graph via static analysis (regex-based import/require parsing),
// then runs DFS cycle detection. Resolves @packrat/* workspace aliases and relative
// imports. Only follows imports that resolve to files within the repository.
//
// Output format:
//   CIRCULAR: packages/api/src/routes/trips/index.ts
//     → packages/api/src/routes/trips/analytics.ts
//     → packages/api/src/routes/trips/index.ts
//
// Exit code:
//   0 — no cycles found
//   1 — one or more cycles found

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const ROOT = resolve(join(import.meta.dir, '..', '..'));

// Regex for stripping trailing /* from tsconfig path aliases
const TRAILING_GLOB_RE = /\/\*$/;

// ---------------------------------------------------------------------------
// Path-alias map built from tsconfig.json paths + package.json exports
// ---------------------------------------------------------------------------

interface AliasEntry {
  prefix: string; // e.g. "@packrat/api/"
  target: string; // absolute path, e.g. /…/packages/api/src/
  stripSlash: boolean; // true when prefix ends with /
}

function buildAliasMap(): AliasEntry[] {
  const aliases: AliasEntry[] = [];

  // Read tsconfig paths
  try {
    const tsconfig = JSON.parse(readFileSync(join(ROOT, 'tsconfig.json'), 'utf-8'));
    const paths: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {};
    for (const [alias, targets] of Object.entries(paths)) {
      if (!targets[0]) continue;
      // Strip trailing /* from alias and target
      const aliasClean = alias.replace(TRAILING_GLOB_RE, '');
      const targetClean = targets[0].replace(TRAILING_GLOB_RE, '');
      aliases.push({
        prefix: aliasClean,
        target: resolve(ROOT, targetClean),
        stripSlash: alias.endsWith('/*'),
      });
    }
  } catch {
    // ignore parse errors
  }

  // Also register each workspace package by name → src/index
  const pkgDirs = safeReaddir(join(ROOT, 'packages'));
  for (const pkg of pkgDirs) {
    if (pkg === 'node_modules') continue;
    const pkgJsonPath = join(ROOT, 'packages', pkg, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const name: string = pkgJson.name ?? '';
      if (!name) continue;

      // Register the exact package name pointing to its src dir
      const srcDir = join(ROOT, 'packages', pkg, 'src');
      if (!aliases.some((a) => a.prefix === name)) {
        aliases.push({ prefix: name, target: srcDir, stripSlash: false });
      }
    } catch {
      // ignore
    }
  }

  // Sort longest-prefix first so more specific aliases win
  aliases.sort((a, b) => b.prefix.length - a.prefix.length);
  return aliases;
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules',
  '.expo',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
]);

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

function isSourceFile(name: string): boolean {
  return SOURCE_EXTS.some((ext) => name.endsWith(ext));
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function walkDir(dir: string, collected: string[]): void {
  for (const entry of safeReaddir(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      walkDir(full, collected);
    } else if (isSourceFile(entry)) {
      collected.push(full);
    }
  }
}

function collectFiles(): string[] {
  const files: string[] = [];

  // apps/expo — all source files, skip SKIP_DIRS
  walkDir(join(ROOT, 'apps', 'expo'), files);

  // packages/*/src — each package's src tree
  for (const pkg of safeReaddir(join(ROOT, 'packages'))) {
    if (pkg === 'node_modules') continue;
    const srcDir = join(ROOT, 'packages', pkg, 'src');
    if (existsSync(srcDir)) {
      walkDir(srcDir, files);
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Import resolution
// ---------------------------------------------------------------------------

// Matches static import/export … from '…' and require('…') / import('…')
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractImports(source: string): string[] {
  const specifiers: string[] = [];

  IMPORT_RE.lastIndex = 0;
  let importMatch = IMPORT_RE.exec(source);
  while (importMatch !== null) {
    if (importMatch[1]) specifiers.push(importMatch[1]);
    importMatch = IMPORT_RE.exec(source);
  }

  REQUIRE_RE.lastIndex = 0;
  let requireMatch = REQUIRE_RE.exec(source);
  while (requireMatch !== null) {
    if (requireMatch[1]) specifiers.push(requireMatch[1]);
    requireMatch = REQUIRE_RE.exec(source);
  }

  return specifiers;
}

function tryResolveFile(base: string): string | null {
  if (existsSync(base) && !statSync(base).isDirectory()) return base;

  // Try adding known extensions
  for (const ext of SOURCE_EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }

  // Try as directory index
  for (const ext of SOURCE_EXTS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function resolveSpecifier(
  specifier: string,
  fromFile: string,
  aliases: AliasEntry[],
): string | null {
  // Skip built-ins and bare external packages (no alias match)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    // Try alias map
    for (const alias of aliases) {
      if (specifier === alias.prefix) {
        return tryResolveFile(alias.target);
      }
      if (alias.stripSlash && specifier.startsWith(`${alias.prefix}/`)) {
        const rest = specifier.slice(alias.prefix.length + 1);
        return tryResolveFile(join(alias.target, rest));
      }
    }
    // No alias match → external package, skip
    return null;
  }

  // Relative or absolute
  const base = specifier.startsWith('/') ? specifier : resolve(dirname(fromFile), specifier);

  return tryResolveFile(base);
}

// ---------------------------------------------------------------------------
// Graph building
// ---------------------------------------------------------------------------

type Graph = Map<string, Set<string>>;

function buildGraph(files: string[], aliases: AliasEntry[]): Graph {
  const graph: Graph = new Map();
  const fileSet = new Set(files);

  for (const file of files) {
    graph.set(file, new Set());
  }

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const specifiers = extractImports(source);
    for (const spec of specifiers) {
      const resolved = resolveSpecifier(spec, file, aliases);
      if (!resolved) continue;
      const norm = normalize(resolved);
      if (fileSet.has(norm)) {
        graph.get(file)?.add(norm);
      }
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Cycle detection — iterative DFS (Tarjan-style path tracking)
// ---------------------------------------------------------------------------

function findCycles(graph: Graph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  // Track which cycles we've already recorded (by sorted join to deduplicate)
  const seenCycles = new Set<string>();

  function dfs(node: string): void {
    visited.add(node);
    onStack.add(node);
    stack.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (onStack.has(neighbor)) {
        // Found a cycle — extract it from the stack
        const cycleStart = stack.indexOf(neighbor);
        const cycle = [...stack.slice(cycleStart), neighbor];
        // Deduplicate: normalize to the lexicographically smallest rotation
        const key = normalizeCycleKey(cycle);
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push(cycle);
        }
      }
    }

    stack.pop();
    onStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function normalizeCycleKey(cycle: string[]): string {
  // cycle is [a, b, c, a] — take the interior nodes [a, b, c] and find
  // the rotation that starts with the smallest element
  const nodes = cycle.slice(0, -1); // remove the repeated last node
  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if ((nodes[i] ?? '') < (nodes[minIdx] ?? '')) minIdx = i;
  }
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  return rotated.join('|');
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function toRel(abs: string): string {
  return relative(ROOT, abs);
}

function reportCycles(cycles: string[][]): void {
  for (const cycle of cycles) {
    const [first, ...rest] = cycle;
    console.log(`CIRCULAR: ${toRel(first ?? '')}`);
    for (const node of rest) {
      console.log(`  → ${toRel(node)}`);
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Scanning for circular dependencies…\n');

const aliases = buildAliasMap();
const files = collectFiles();
console.log(`Found ${files.length} source files across apps/expo and packages/*/src\n`);

const graph = buildGraph(files, aliases);
const cycles = findCycles(graph);

if (cycles.length === 0) {
  console.log('No circular dependencies found.');
  process.exit(0);
} else {
  console.log(`Found ${cycles.length} circular dependency chain(s):\n`);
  reportCycles(cycles);
  process.exit(1);
}
