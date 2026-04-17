#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const APPS_DIR = join(ROOT, 'apps');
const PACKAGE_JSON = 'package.json';
const SCRIPT_NAME = 'doctor:react';
const DIVIDER = '─'.repeat(52);
const MAX_SUMMARY_LENGTH = 80;
const SUMMARY_TRUNCATE_LENGTH = 77;
const DISPLAY_NAME_WIDTH = 32;
const HEADER_LINES = 2;

interface AppPackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface ReactAppConfig {
  appDirName: string;
  displayName: string;
  script: string;
}

interface ReactAppRunResult {
  appDirName: string;
  displayName: string;
  passed: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

function hasReactDependency(pkg: AppPackageJson): boolean {
  return Boolean(
    pkg.dependencies?.react || pkg.devDependencies?.react || pkg.peerDependencies?.react,
  );
}

function loadReactApps(): {
  runnableApps: ReactAppConfig[];
  missingScriptApps: { appDirName: string; displayName: string }[];
} {
  const entries = readdirSync(APPS_DIR);
  const runnableApps: ReactAppConfig[] = [];
  const missingScriptApps: { appDirName: string; displayName: string }[] = [];

  for (const entry of entries) {
    const appDir = join(APPS_DIR, entry);
    let isDirectory = false;

    try {
      isDirectory = statSync(appDir).isDirectory();
    } catch {
      continue;
    }

    if (!isDirectory) continue;

    const packagePath = join(appDir, PACKAGE_JSON);
    let packageData: AppPackageJson;

    try {
      packageData = JSON.parse(readFileSync(packagePath, 'utf8')) as AppPackageJson;
    } catch {
      continue;
    }

    if (!hasReactDependency(packageData)) continue;

    const displayName = packageData.name ?? entry;
    const script = packageData.scripts?.[SCRIPT_NAME];

    if (!script) {
      missingScriptApps.push({ appDirName: entry, displayName });
      continue;
    }

    runnableApps.push({
      appDirName: entry,
      displayName,
      script,
    });
  }

  return { runnableApps, missingScriptApps };
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function padRight(str: string, width: number): string {
  return str.length >= width ? str : `${str}${' '.repeat(width - str.length)}`;
}

function firstSummaryLine(output: string): string {
  const trimmed = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!trimmed) return '';
  return trimmed.length > MAX_SUMMARY_LENGTH
    ? `${trimmed.slice(0, SUMMARY_TRUNCATE_LENGTH)}…`
    : trimmed;
}

function getCursorResetLineCount(appCount: number): number {
  return appCount + HEADER_LINES;
}

async function runDoctor(app: ReactAppConfig): Promise<ReactAppRunResult> {
  const startedAt = performance.now();
  const proc = Bun.spawn(['bun', 'run', SCRIPT_NAME], {
    cwd: join(APPS_DIR, app.appDirName),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    appDirName: app.appDirName,
    displayName: app.displayName,
    passed: exitCode === 0,
    durationMs: performance.now() - startedAt,
    stdout,
    stderr,
  };
}

const { runnableApps, missingScriptApps } = loadReactApps();

if (runnableApps.length === 0 && missingScriptApps.length === 0) {
  console.log('No React apps found in apps/.');
  process.exit(0);
}

if (missingScriptApps.length > 0) {
  console.log('\nReact Doctor checks');
  console.log(DIVIDER);
  console.log('Missing required `doctor:react` package.json scripts:\n');
  for (const app of missingScriptApps) {
    console.log(`- ${app.displayName} (apps/${app.appDirName})`);
  }
  console.log('\nAdd a `doctor:react` script to each React app package.json.');
  process.exit(1);
}

console.log('\nReact Doctor checks');
console.log(DIVIDER);
for (const app of runnableApps) {
  console.log(`⏳  ${app.displayName}…`);
}

const results = await Promise.all(runnableApps.map(runDoctor));

process.stdout.write(`\x1b[${getCursorResetLineCount(runnableApps.length)}A\x1b[0J`);
console.log('\nReact Doctor checks');
console.log(DIVIDER);

for (const result of results) {
  const icon = result.passed ? '✅' : '❌';
  const name = padRight(result.displayName, DISPLAY_NAME_WIDTH);
  let row = `${icon}  ${name} (${formatDuration(result.durationMs)})`;

  if (!result.passed) {
    const summary = firstSummaryLine(`${result.stdout}\n${result.stderr}`);
    if (summary) row += `  — ${summary}`;
  }

  console.log(row);
}

console.log(DIVIDER);
const failed = results.filter((result) => !result.passed);
console.log(`${results.length - failed.length} passed · ${failed.length} failed`);

if (failed.length > 0) {
  for (const result of failed) {
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (!output) continue;

    console.log(`\n${'─'.repeat(72)}`);
    console.log(`Output from ${result.displayName}`);
    console.log(`${'─'.repeat(72)}`);
    console.log(output);
  }
}

process.exit(failed.length > 0 ? 1 : 0);
