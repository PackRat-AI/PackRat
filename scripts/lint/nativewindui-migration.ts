#!/usr/bin/env bun
//
// nativewindui-migration.ts — tracks NativeWindUI → Expo UI migration progress.
//
// Reads packages/ui/nativewindui/index.ts and counts remaining export lines per
// phase. Scans apps/expo for any direct imports from @packrat-ai/nativewindui
// (which bypass the adapter and indicate a stale callsite).
//
// Exit codes:
//   0 — clean (no violations; progress printed to stdout)
//   1 — violations found (direct imports bypassing adapter)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const ADAPTER = join(ROOT, 'packages/ui/nativewindui/index.ts');
const EXPO_SRC = join(ROOT, 'apps/expo');

// ── 1. Count remaining exports per phase ────────────────────────────────────

const adapterLines = readFileSync(ADAPTER, 'utf8').split('\n');

type Phase = '1' | '2' | '3' | '4' | '5';
const phaseCounts: Record<Phase, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
const phaseNames: Record<Phase, string> = {
  '1': 'utilities (non-UI)               ',
  '2': 'expo-router native patterns      ',
  '3': '@expo/ui Universal → packages/ui ',
  '4': '@expo/ui platform-specific       ',
  '5': 'no @expo/ui equivalent           ',
};

// Snapshot total at migration start (update if new components are added to the adapter).
// Count: p1=2, p2=5, p3=10, p4=6, p5=1 = 24 tracked export groups
const TOTAL_AT_START = 24;

let currentPhase: Phase = '1';
for (const line of adapterLines) {
  const phaseMatch = line.match(/Phase (\d)/);
  if (phaseMatch) {
    currentPhase = phaseMatch[1] as Phase;
    continue;
  }
  if (line.startsWith('export')) {
    phaseCounts[currentPhase]++;
  }
}

const totalRemaining = Object.values(phaseCounts).reduce((a, b) => a + b, 0);
const totalMigrated = TOTAL_AT_START - totalRemaining;
const pct = Math.round((totalMigrated / TOTAL_AT_START) * 100);

console.log('\n── NativeWindUI → Expo UI migration progress ───────────────────');
for (const [phase, name] of Object.entries(phaseNames) as [Phase, string][]) {
  const count = phaseCounts[phase];
  const status = count === 0 ? '✓ done' : `${count} remaining`;
  console.log(`  Phase ${phase}  ${name}  ${status}`);
}
console.log(`\n  Overall: ${totalMigrated}/${TOTAL_AT_START} export groups migrated (${pct}%)`);
console.log('─────────────────────────────────────────────────────────────────\n');

// ── 2. Scan for direct @packrat-ai/nativewindui imports (adapter bypass) ───

const EXCLUDED = new Set(['node_modules', 'dist', 'build', '.expo', '.wrangler']);

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

const violations: string[] = [];
for (const file of walk(EXPO_SRC)) {
  const content = readFileSync(file, 'utf8');
  if (content.includes("from '@packrat-ai/nativewindui'")) {
    const rel = file.replace(ROOT + '/', '');
    const line =
      content.split('\n').findIndex((l) => l.includes("from '@packrat-ai/nativewindui'")) + 1;
    violations.push(`  ${rel}:${line}`);
  }
}

if (violations.length > 0) {
  console.error('✗ Direct @packrat-ai/nativewindui imports found (use @packrat/ui/nativewindui):');
  for (const v of violations) console.error(v);
  console.error('');
  process.exit(1);
}

console.log('✓ No adapter bypass violations found.\n');
