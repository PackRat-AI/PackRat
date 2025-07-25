#!/usr/bin/env bun

/**
 * Configure dependencies for installation
 *
 * This script ensures that GitHub packages authentication is properly set up
 * for installing private packages from the GitHub Package Registry.
 *
 * It runs automatically before `bun install` via the preinstall hook.
 *
 * Requirements:
 * - Local development: GitHub CLI must be installed and authenticated with `read:packages` scope
 * - CI/CD: GITHUB_TOKEN environment variable must be set
 */

import { $ } from 'bun';

async function configureDeps() {
  try {
    // Check if we're in a CI environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    if (isCI) {
      // In CI, the GITHUB_TOKEN should already be set
      if (!process.env.GITHUB_TOKEN) {
        console.error('❌ GITHUB_TOKEN environment variable is not set in CI');
        console.error('Please ensure GITHUB_TOKEN is available in your CI environment');
        process.exit(1);
      }
      console.log('✓ Using CI-provided GITHUB_TOKEN for authentication');
      return;
    }

    // For local development, check if GITHUB_TOKEN is already set
    if (process.env.GITHUB_TOKEN) {
      console.log('✓ GITHUB_TOKEN already set in environment');
      return;
    }

    // Try to get token from GitHub CLI
    const ghStatus = await $`gh auth status`.quiet().nothrow();

    if (ghStatus.exitCode === 0) {
      // Note: gh auth status doesn't show read:packages in the output even when it's granted
      // The token will work if the user has followed the authentication steps

      // Get the GitHub token from gh CLI
      const token = await $`gh auth token`.text();
      process.env.GITHUB_TOKEN = token.trim();
      console.log('✓ Using GitHub CLI token for authentication');
    } else {
      console.error('❌ GitHub CLI not found or not authenticated');
      console.error('\nTo fix this:');
      console.error('1. Install GitHub CLI: https://cli.github.com');
      console.error('2. Authenticate: gh auth login');
      console.error('3. Add packages scope: gh auth refresh -h github.com -s read:packages');
      console.error(
        '\nAlternatively, set GITHUB_TOKEN environment variable with a personal access token',
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
