#!/usr/bin/env bun
/**
 * Updates Cloudflare Workers environment variable for the dev API to use ephemeral database.
 *
 * Usage:
 *   E2E_DATABASE_URL=<url> CLOUDFLARE_API_TOKEN=<token> \
 *     bun run packages/api/scripts/update-cf-db-url.ts
 *
 * Requires:
 *   - E2E_DATABASE_URL: Connection string for the ephemeral database
 *   - CLOUDFLARE_API_TOKEN: Cloudflare API token with Workers edit permissions
 *   - CLOUDFLARE_ACCOUNT_ID: Cloudflare account ID
 *   - CLOUDFLARE_WORKER_NAME: Worker name (default: packrat-api-dev)
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

interface WorkerSecret {
  name: string;
  type: string;
}

async function updateWorkerSecret(
  apiToken: string,
  accountId: string,
  workerName: string,
  secretName: string,
  secretValue: string,
): Promise<void> {
  console.log(`🔧 Updating ${secretName} for worker ${workerName}...`);

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: secretName,
        text: secretValue,
        type: 'secret_text',
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update worker secret: ${response.status} ${errorText}`);
  }

  console.log(`✅ Updated ${secretName} successfully`);
}

async function main() {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const workerName = process.env.CLOUDFLARE_WORKER_NAME || 'packrat-api-dev';

  if (!databaseUrl) {
    throw new Error('E2E_DATABASE_URL environment variable is required');
  }
  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
  }
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
  }

  console.log('🚀 Updating Cloudflare Worker database configuration...');
  console.log(`  Worker: ${workerName}`);
  console.log(`  Account: ${accountId}`);

  try {
    // Update both read-write and readonly URLs
    await updateWorkerSecret(apiToken, accountId, workerName, 'NEON_DATABASE_URL', databaseUrl);
    await updateWorkerSecret(
      apiToken,
      accountId,
      workerName,
      'NEON_DATABASE_URL_READONLY',
      databaseUrl,
    );

    console.log('');
    console.log('✅ Cloudflare Worker database configuration updated!');
    console.log('⚠️  Remember to restore the original database URL after tests complete');
  } catch (error) {
    console.error('❌ Failed to update Cloudflare Worker configuration:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
