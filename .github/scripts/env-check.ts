#!/usr/bin/env bun
// Fail-fast environment check, run immediately before a local dev server boots.
//
// Regenerates the derived env files from the resolved source (so a worktree
// picks up keys added to the main checkout since its last `bun install`), then
// validates the result against the API's own Zod schema and refuses to start
// if anything required is absent. Naming the missing keys turns the silent
// per-worktree drift into an error you can act on.
//
// The schema — not .env.example — is the contract: it is what the Worker
// actually parses at boot, and it distinguishes required keys from optional
// ones, which a flat example file cannot.

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { apiEnvSchema } from '../../packages/api/src/utils/env-validation';
import { ENV_FILE_NAME, parseEnv, resolveEnvSource } from './env-source';

const checkoutRoot = path.join(import.meta.dirname, '..', '..');

function fail(lines: string[]): never {
  console.error('\n✗ Environment is not ready\n');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

const source = resolveEnvSource(checkoutRoot);
if (!source.exists) {
  fail([
    `No ${ENV_FILE_NAME} found for this checkout.`,
    `Looked in this worktree and in the main checkout (${source.path}).`,
    `Copy .env.example to ${ENV_FILE_NAME} in the main checkout and fill it in —`,
    'every worktree reads through to that one file.',
  ]);
}

// Always regenerate: the derived files are artefacts of the source, and a
// worktree's copy is stale the moment a key is added to the main checkout.
execFileSync('bun', ['run', path.join(checkoutRoot, '.github', 'scripts', 'env.ts')], {
  cwd: checkoutRoot,
  stdio: 'inherit',
});

// Validate the generated .dev.vars — that is the file the Worker will read,
// so it is the thing whose completeness actually matters.
const devVarsPath = path.join(checkoutRoot, 'packages', 'api', '.dev.vars');
if (!fs.existsSync(devVarsPath)) {
  fail([`Expected ${devVarsPath} to exist after generation, but it does not.`]);
}

const result = apiEnvSchema.safeParse(parseEnv(fs.readFileSync(devVarsPath, 'utf8')));
if (!result.success) {
  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(root)';
    return `· ${key} — ${issue.message}`;
  });
  fail([
    `${problems.length} problem(s) validating the API environment:`,
    '',
    ...problems,
    '',
    `Source: ${source.path}${source.inherited ? ' (main checkout)' : ''}`,
    'Fix it there — all worktrees inherit that one file.',
  ]);
}

console.log(`✅ Environment ready${source.inherited ? ' (inherited from the main checkout)' : ''}`);
