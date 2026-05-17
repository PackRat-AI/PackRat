#!/usr/bin/env bun
/**
 * Cleans up an ephemeral Neon database branch created for e2e testing.
 *
 * Usage:
 *   bun run packages/api/scripts/cleanup-e2e-db.ts /tmp/e2e-branch-1234567890.json
 *   # OR
 *   E2E_BRANCH_ID=br-xxx bun run packages/api/scripts/cleanup-e2e-db.ts
 *
 * Requires:
 *   - NEON_API_KEY: Neon API key for branch management
 *   - Either a branch info JSON file path as argument, or E2E_BRANCH_ID + NEON_PROJECT_ID env vars
 */

import { unlink } from 'node:fs/promises';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

interface BranchInfo {
  branchId: string;
  branchName: string;
  projectId: string;
  connectionUri: string;
  timestamp: number;
}

async function deleteBranch(apiKey: string, projectId: string, branchId: string): Promise<void> {
  console.log(`🗑️  Deleting branch ${branchId}...`);

  const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    // 404 is okay - branch might already be deleted
    if (response.status === 404) {
      console.log(`⚠️  Branch ${branchId} not found (may have been deleted already)`);
      return;
    }

    const errorText = await response.text();
    throw new Error(`Failed to delete branch: ${response.status} ${errorText}`);
  }

  console.log(`✅ Branch ${branchId} deleted successfully`);
}

async function main() {
  const neonApiKey = process.env.NEON_API_KEY;

  if (!neonApiKey) {
    throw new Error('NEON_API_KEY environment variable is required');
  }

  // Try to get branch info from file argument first
  const branchInfoFile = process.argv[2];
  let branchInfo: BranchInfo | null = null;

  if (branchInfoFile) {
    try {
      const file = Bun.file(branchInfoFile);
      const content = await file.text();
      branchInfo = JSON.parse(content);
      console.log(`📄 Loaded branch info from ${branchInfoFile}`);
    } catch (error) {
      console.error(`⚠️  Failed to read branch info file: ${error}`);
    }
  }

  // Fallback to environment variables
  if (!branchInfo) {
    const branchId = process.env.E2E_BRANCH_ID;
    const projectId = process.env.NEON_PROJECT_ID;

    if (!branchId || !projectId) {
      throw new Error(
        'Either provide a branch info JSON file as argument, or set E2E_BRANCH_ID and NEON_PROJECT_ID environment variables',
      );
    }

    branchInfo = {
      branchId,
      branchName: 'unknown',
      projectId,
      connectionUri: '',
      timestamp: Date.now(),
    };
    console.log(`🔧 Using environment variables for cleanup`);
  }

  console.log('🧹 Cleaning up E2E database branch...');
  console.log(`  Project: ${branchInfo.projectId}`);
  console.log(`  Branch: ${branchInfo.branchId} (${branchInfo.branchName})`);

  try {
    // Delete the branch
    await deleteBranch(neonApiKey, branchInfo.projectId, branchInfo.branchId);

    // Delete the branch info file if it exists
    if (branchInfoFile) {
      try {
        await unlink(branchInfoFile);
        console.log(`✅ Deleted branch info file: ${branchInfoFile}`);
      } catch (error) {
        console.log(`⚠️  Could not delete branch info file: ${error}`);
      }
    }

    console.log('');
    console.log('✅ E2E database cleanup complete!');
  } catch (error) {
    console.error('❌ Failed to cleanup E2E database:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
