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
 * - Local development: GitHub CLI token (from `gh auth token`) → PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN
 * - CI/CD: Uses PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN directly from secrets
 * - The token is used by bunfig.toml to authenticate with npm.pkg.github.com
 *
 * Requirements:
 * - Local development: GitHub CLI must be installed and authenticated with `read:packages` scope
 * - CI/CD: PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN environment variable must be set
 */

import { $ } from 'bun';

async function configureDeps() {
  try {
    // Check if we're in a CI environment
    const isCI = process.env.CI === '1' || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    if (isCI) {
      // In CI, bunfig.toml will use PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN
      if (!process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN) {
        console.error('❌ PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN not found in CI');
        console.error('Please ensure PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN is set in your CI secrets');
        process.exit(1);
      }
      console.log('✓ Using PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN for CI authentication');
      return;
    }

    // For local development, check if PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN is already set
    if (process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN) {
      console.log('✓ PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN already set in environment');
      return;
    }

    // Try to get token from GitHub CLI
    const ghStatus = await $`gh auth status`.quiet().nothrow();

    if (ghStatus.exitCode === 0) {
      // Note: gh auth status doesn't show read:packages in the output even when it's granted
      // The token will work if the user has followed the authentication steps

      // Get the GitHub token from gh CLI and set it as PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN
      const token = await $`gh auth token`.text();
      process.env.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN = token.trim();
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
