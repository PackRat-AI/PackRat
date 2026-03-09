#!/usr/bin/env bun

/**
 * Configure dependencies for installation
 *
 * This script ensures that GitHub packages authentication is properly set up
 * for installing private packages from the GitHub Package Registry.
 *
 * It runs automatically before `bun install` via the preinstall hook.
 *
 * Token Usage Pattern:
 * - Local development: GitHub CLI token (from `gh auth token`) → written to .npmrc
 * - CI/CD: PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN from secrets → written to .npmrc
 * - The .npmrc file is used by bun to authenticate with npm.pkg.github.com
 *
 * Why .npmrc and not process.env?
 * - The preinstall script runs as a child process of `bun install`.
 *   Any env var set via process.env only affects the child process and is NOT
 *   propagated back to the parent `bun install` process that reads bunfig.toml.
 *   Writing .npmrc is the reliable cross-process solution.
 *
 * Requirements:
 * - Local development: GitHub CLI must be installed and authenticated with `read:packages` scope
 *   Run: gh auth refresh -h github.com -s read:packages
 * - CI/CD: PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN environment variable must be set
 */

import { $ } from 'bun';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const NPMRC_PATH = join(process.cwd(), '.npmrc');
const GITHUB_REGISTRY_LINE_PREFIX = '//npm.pkg.github.com/:_authToken=';

function writeNpmrc(token: string): void {
  if (!token) {
    console.error('❌ Token is empty, cannot write .npmrc');
    process.exit(1);
  }

  const newAuthLine = `${GITHUB_REGISTRY_LINE_PREFIX}${token}`;

  if (existsSync(NPMRC_PATH)) {
    // Merge: update existing auth line or append if absent
    const existing = readFileSync(NPMRC_PATH, 'utf8');
    const lines = existing.split('\n');
    const idx = lines.findIndex((l) => l.startsWith(GITHUB_REGISTRY_LINE_PREFIX));
    if (idx !== -1) {
      lines[idx] = newAuthLine;
    } else {
      // Append before any trailing newline
      lines.push(newAuthLine);
    }
    writeFileSync(NPMRC_PATH, lines.join('\n'), { mode: 0o600 });
  } else {
    writeFileSync(NPMRC_PATH, `${newAuthLine}\n`, { mode: 0o600 });
  }

  console.log('✓ Written .npmrc with GitHub Package Registry auth token');
}

async function configureDeps() {
  try {
    // Check if we're in a CI environment
    const isCI =
      process.env.CI === '1' || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    if (isCI) {
      if (!process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN) {
        console.error('❌ PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN not found in CI');
        console.error('Please ensure PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN is set in your CI secrets');
        process.exit(1);
      }
      writeNpmrc(process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN);
      console.log('✓ Using PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN for CI authentication');
      return;
    }

    // For local development, check if PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN is already set
    if (process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN) {
      writeNpmrc(process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN);
      console.log('✓ PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN already set in environment');
      return;
    }

    // Try to get token from GitHub CLI
    const ghStatus = await $`gh auth status`.quiet().nothrow();

    if (ghStatus.exitCode === 0) {
      // Note: gh auth status doesn't show read:packages in the output even when it's granted
      // The token will work if the user has followed the authentication steps

      // Get the GitHub token from gh CLI and write it to .npmrc
      const token = await $`gh auth token`.text();
      writeNpmrc(token.trim());
      console.log('✓ Using GitHub CLI token for authentication');
    } else {
      console.error('❌ GitHub CLI not found or not authenticated');
      console.error('\nTo fix this:');
      console.error('1. Install GitHub CLI: https://cli.github.com');
      console.error('2. Authenticate: gh auth login');
      console.error('3. Add packages scope: gh auth refresh -h github.com -s read:packages');
      console.error(
        '\nAlternatively, set PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN environment variable with a personal access token',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Configuration failed:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.main) {
  configureDeps();
}
