#!/usr/bin/env bun

/**
 * Verify that GitHub Packages auth is available for `bun install`.
 *
 * IMPORTANT: Bun reads bunfig.toml at process startup, BEFORE this preinstall
 * hook runs. That means we cannot inject PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN
 * into the parent process — the variable must already be exported in the
 * shell that invokes `bun install`. This script's job is to detect a missing
 * token early and print the exact command to fix it.
 *
 * Expected flow:
 * - Local dev: `export PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=$(gh auth token)` then `bun install`
 * - CI/CD:     PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN set from repo secrets
 */

import { $ } from 'bun';

const TOKEN_VAR = 'PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN';

function isCI(): boolean {
  return (
    process.env.CI === '1' || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
  );
}

function printLocalFix(): void {
  console.error(`\n❌ ${TOKEN_VAR} is not exported in your shell.`);
  console.error('\nBun reads bunfig.toml before the preinstall hook runs, so the token');
  console.error('must be present in the parent shell. Run one of:\n');
  console.error('  # Inline');
  console.error(`  export ${TOKEN_VAR}=$(gh auth token)`);
  console.error('  bun install\n');
  console.error('  # One-liner');
  console.error(`  ${TOKEN_VAR}=$(gh auth token) bun install\n`);
  console.error('  # Persist — add to ~/.zshrc or ~/.bashrc');
  console.error(`  export ${TOKEN_VAR}=$(gh auth token 2>/dev/null)\n`);
  console.error('If gh is not set up yet:');
  console.error('  gh auth login');
  console.error('  gh auth refresh -h github.com -s read:packages');
}

async function configureDeps() {
  if (process.env[TOKEN_VAR]) {
    console.log(`✓ ${TOKEN_VAR} is set — bun install will authenticate to GitHub Packages`);
    return;
  }

  if (isCI()) {
    console.error(`❌ ${TOKEN_VAR} not found in CI environment`);
    console.error(`Set ${TOKEN_VAR} in your CI secrets and expose it to this job.`);
    process.exit(1);
  }

  const ghStatus = await $`gh auth status`.quiet().nothrow();
  if (ghStatus.exitCode !== 0) {
    console.error('❌ GitHub CLI not found or not authenticated.\n');
    console.error('1. Install GitHub CLI: https://cli.github.com');
    console.error('2. Authenticate: gh auth login');
    console.error('3. Add packages scope: gh auth refresh -h github.com -s read:packages');
    console.error(`4. Then export ${TOKEN_VAR}=$(gh auth token) and re-run bun install.`);
    process.exit(1);
  }

  printLocalFix();
  process.exit(1);
}

if (import.meta.main) {
  configureDeps();
}
