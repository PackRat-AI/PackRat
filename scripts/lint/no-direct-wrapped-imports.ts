#!/usr/bin/env bun
//
// no-direct-wrapped-imports.ts — enforces the apps/expo/lib/ wrapper convention.
//
// Platform-sensitive external dependencies (native modules, expo-* packages
// that are stubbed or throw on web, etc.) must be imported through a wrapper
// module in apps/expo/lib/ rather than directly. The wrapper's `.web.ts`
// variant handles browser behavior so callers need no `Platform.OS` branches
// and the web bundle (`expo export -p web`) keeps working.
//
// Each entry in WRAPPED maps a module specifier to the wrapper that should be
// imported instead. A direct import of a wrapped module anywhere in apps/expo
// (outside the wrapper itself and test/spec files) is a violation.
//
// Exit code:
//   0 — no violations
//   1 — violations found (details printed to stdout)
//
// Wired into the `lint:custom` script in root package.json.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const EXPO_ROOT = join(ROOT, 'apps', 'expo');

// module specifier (or specifier prefix) → wrapper import path the call site
// should use instead. The `wrapperFile` is the wrapper's source path relative
// to apps/expo, used to exempt the wrapper itself from the rule.
interface WrappedEntry {
  /** Import specifier that is forbidden outside the wrapper. */
  module: string;
  /** Wrapper path callers should import from instead. */
  wrapper: string;
  /** Wrapper source files (relative to apps/expo) exempt from the rule. */
  wrapperFiles: string[];
}

const WRAPPED: WrappedEntry[] = [
  {
    module: 'expo-secure-store',
    wrapper: 'expo-app/lib/secureStore',
    wrapperFiles: ['lib/secureStore.ts', 'lib/secureStore.web.ts'],
  },
  {
    module: 'expo-apple-authentication',
    wrapper: 'expo-app/lib/appleAuthentication',
    wrapperFiles: ['lib/appleAuthentication.ts', 'lib/appleAuthentication.web.ts'],
  },
  {
    module: 'expo-updates',
    wrapper: 'expo-app/lib/updates',
    wrapperFiles: ['lib/updates.ts', 'lib/updates.web.ts'],
  },
  {
    module: '@react-native-async-storage/async-storage',
    wrapper: 'expo-app/lib/asyncStorage',
    wrapperFiles: ['lib/asyncStorage.ts'],
  },
  {
    module: '@react-native-google-signin/google-signin',
    wrapper: 'expo-app/lib/googleSignin',
    wrapperFiles: ['lib/googleSignin.ts', 'lib/googleSignin.web.ts'],
  },
  {
    module: 'expo-sqlite/kv-store',
    wrapper: 'expo-app/lib/expoSqliteKvStore',
    wrapperFiles: ['lib/expoSqliteKvStore.ts', 'lib/expoSqliteKvStore.web.ts'],
  },
];

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.expo', '.wrangler']);

// app.config.ts / app.json reference plugin names as build-time strings, not
// runtime imports — they are not call sites and are exempt.
const EXEMPT_FILES = new Set(['app.config.ts', 'app.config.js', 'metro.config.js']);

function isTargetFile(name: string): boolean {
  return /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec)\.(ts|tsx|cts|mts)$/.test(name);
}

function buildImportPattern(module: string): RegExp {
  // Matches `from 'module'` and `from 'module/subpath'` in both import and
  // export-from statements, plus bare `import 'module'` side-effect imports.
  const escaped = module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:from|import)\\s+['"]${escaped}(?:/[^'"]*)?['"]`);
}

interface Violation {
  file: string;
  line: number;
  content: string;
  wrapper: string;
}

const wrapperFileSet = new Set(WRAPPED.flatMap((e) => e.wrapperFiles));
const patterns = WRAPPED.map((e) => ({ ...e, pattern: buildImportPattern(e.module) }));

function walkDir(dir: string, relPath: string, violations: Violation[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const entryFull = join(dir, entry);
    const entryRel = relPath ? `${relPath}/${entry}` : entry;

    let isDir = false;
    try {
      isDir = statSync(entryFull).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      walkDir(entryFull, entryRel, violations);
      continue;
    }

    if (!isTargetFile(entry)) continue;
    if (wrapperFileSet.has(entryRel)) continue;
    if (EXEMPT_FILES.has(entry)) continue;

    let content: string;
    try {
      content = readFileSync(entryFull, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const { pattern, wrapper } of patterns) {
        if (pattern.test(line)) {
          violations.push({ file: entryRel, line: i + 1, content: line.trim(), wrapper });
        }
      }
    }
  }
}

const violations: Violation[] = [];
walkDir(EXPO_ROOT, '', violations);

if (violations.length > 0) {
  console.log(
    `Direct imports of wrapped modules found (${violations.length}) — import from the lib/ wrapper instead:\n`,
  );
  for (const { file, line, content, wrapper } of violations) {
    console.log(`apps/expo/${file}:${line}: ${content}`);
    console.log(`  → import from '${wrapper}'\n`);
  }
  process.exit(1);
}

console.log('No direct imports of wrapped modules in apps/expo.');
