#!/usr/bin/env bun
//
// no-duplicate-deps.ts — checks for dependencies that should live in the bun
// catalog: section of the root package.json rather than being pinned in
// multiple workspace package.json files.
//
// What gets flagged:
//   - CATALOG CANDIDATES: a dep declared with a pinned version in 2+ packages
//   - VERSION MISMATCHES: same dep declared in 2+ packages with different
//     versions (higher priority — active drift)
//   - CATALOG VIOLATIONS: a dep already in the root catalog: section that is
//     still declared with a pinned version in a workspace package (should be
//     "catalog:" instead)
//
// Exit code:
//   0 — no version mismatches or catalog violations
//   1 — version mismatches or catalog violations found
//
// Catalog candidates (same version everywhere) produce warnings only and do
// not affect the exit code.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function relPath(abs: string): string {
  return relative(ROOT, abs);
}

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

function collectDeps(pkg: Record<string, unknown>): Map<string, string> {
  const result = new Map<string, string>();
  for (const section of DEP_SECTIONS) {
    const block = pkg[section];
    if (block && typeof block === 'object') {
      for (const [name, version] of Object.entries(block as Record<string, string>)) {
        if (typeof version === 'string') {
          result.set(name, version);
        }
      }
    }
  }
  return result;
}

// ── discover package.json files ───────────────────────────────────────────────

function discoverPackageJsons(): string[] {
  const paths: string[] = [join(ROOT, 'package.json')];
  for (const dir of ['apps', 'packages']) {
    const full = join(ROOT, dir);
    let entries: string[];
    try {
      entries = readdirSync(full);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === 'node_modules') continue;
      try {
        if (statSync(join(full, entry)).isDirectory()) {
          paths.push(join(full, entry, 'package.json'));
        }
      } catch {
        // skip unreadable entries
      }
    }
  }
  return paths;
}

// ── load all manifests ────────────────────────────────────────────────────────

interface Manifest {
  path: string;
  rel: string;
  isRoot: boolean;
  pkg: Record<string, unknown>;
  deps: Map<string, string>;
}

const rootPkgJsonPath = join(ROOT, 'package.json');
const allPaths = discoverPackageJsons();

const manifests: Manifest[] = [];

for (const p of allPaths) {
  const pkg = readJson(p);
  if (!pkg) continue;
  const isRoot = p === rootPkgJsonPath;
  manifests.push({ path: p, rel: relPath(p), isRoot, pkg, deps: collectDeps(pkg) });
}

const root = manifests.find((m) => m.isRoot);
const workspaces = manifests.filter((m) => !m.isRoot);

// ── read existing catalog ─────────────────────────────────────────────────────

const catalogRaw = root?.pkg.catalog;
const catalog: Map<string, string> =
  catalogRaw && typeof catalogRaw === 'object'
    ? new Map(Object.entries(catalogRaw as Record<string, string>))
    : new Map();

// ── build dep → {version → packages[]} index ─────────────────────────────────

// Only track pinned versions (not "catalog:")
const index = new Map<string, Map<string, string[]>>();

for (const { rel, deps } of workspaces) {
  for (const [name, version] of deps) {
    if (version === 'catalog:') continue; // already using catalog — skip
    if (!index.has(name)) index.set(name, new Map());
    // biome-ignore lint/style/noNonNullAssertion: we just set this above
    const versionMap = index.get(name)!;
    if (!versionMap.has(version)) versionMap.set(version, []);
    // biome-ignore lint/style/noNonNullAssertion: we just set this above
    versionMap.get(version)!.push(rel);
  }
}

// ── analysis ──────────────────────────────────────────────────────────────────

interface CatalogCandidate {
  name: string;
  version: string;
  packages: string[];
}

interface VersionMismatch {
  name: string;
  entries: Array<{ version: string; packages: string[] }>;
}

interface CatalogViolation {
  name: string;
  catalogVersion: string;
  packageRel: string;
  packageVersion: string;
}

const candidates: CatalogCandidate[] = [];
const mismatches: VersionMismatch[] = [];
const violations: CatalogViolation[] = [];

for (const [name, versionMap] of index) {
  const totalPackages = [...versionMap.values()].reduce((sum, pkgs) => sum + pkgs.length, 0);

  if (versionMap.size > 1) {
    // Multiple different versions — active drift
    mismatches.push({
      name,
      entries: [...versionMap.entries()]
        .map(([version, packages]) => ({ version, packages }))
        .sort((a, b) => a.version.localeCompare(b.version)),
    });
  } else if (totalPackages >= 2) {
    // Same version in 2+ packages — catalog candidate
    const firstEntry = [...versionMap.entries()][0];
    if (firstEntry) {
      candidates.push({ name, version: firstEntry[0], packages: firstEntry[1] });
    }
  }
}

// Catalog violations: dep in catalog but workspace uses a pinned version
for (const [catalogDep, catalogVersion] of catalog) {
  for (const { rel, deps } of workspaces) {
    const packageVersion = deps.get(catalogDep);
    if (packageVersion && packageVersion !== 'catalog:') {
      violations.push({
        name: catalogDep,
        catalogVersion,
        packageRel: rel,
        packageVersion,
      });
    }
  }
}

// ── output ────────────────────────────────────────────────────────────────────

let hasErrors = false;

if (mismatches.length === 0 && candidates.length === 0 && violations.length === 0) {
  console.log('No duplicate dependencies or catalog issues found.');
  process.exit(0);
}

// Print mismatches first (highest priority)
if (mismatches.length > 0) {
  hasErrors = true;
  console.log(
    `VERSION MISMATCH${mismatches.length > 1 ? 'ES' : ''} (active drift — fix immediately):\n`,
  );
  for (const { name, entries } of mismatches.sort((a, b) => a.name.localeCompare(b.name))) {
    const parts = entries.map(({ version, packages }) => `${packages.join(', ')} uses ${version}`);
    console.log(`  ${name}: ${parts.join(' | ')}`);
  }
  console.log('');
}

// Print catalog violations (errors)
if (violations.length > 0) {
  hasErrors = true;
  console.log(
    `CATALOG VIOLATION${violations.length > 1 ? 'S' : ''} (dep is in catalog: but workspace pins its own version):\n`,
  );
  for (const v of violations.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      `  ${v.name}@${v.packageVersion} — ${v.packageRel}  (catalog has ${v.catalogVersion}, use "catalog:" instead)`,
    );
  }
  console.log('');
}

// Print candidates (warnings only)
if (candidates.length > 0) {
  console.log(
    `CATALOG CANDIDATE${candidates.length > 1 ? 'S' : ''} (same version pinned in 2+ packages — consider moving to catalog:):\n`,
  );
  for (const { name, version, packages } of candidates.sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    console.log(
      `  ${name}@${version} — ${packages.join(', ')}  (appears in ${packages.length} package${packages.length > 1 ? 's' : ''})`,
    );
  }
  console.log('');
}

if (hasErrors) {
  process.exit(1);
}
