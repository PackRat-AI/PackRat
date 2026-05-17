#!/usr/bin/env bun
/**
 * Provisions an ephemeral Neon database branch for e2e testing.
 *
 * Creates a dedicated branch from the parent database, runs migrations,
 * and seeds a test user. Returns the connection string for the new branch.
 *
 * Usage:
 *   bun run packages/api/scripts/provision-e2e-db.ts
 *
 * Requires:
 *   - NEON_API_KEY: Neon API key for branch management
 *   - NEON_PROJECT_ID: Parent Neon project ID
 *   - NEON_PARENT_BRANCH_ID: Parent branch to fork from (e.g., 'main')
 *   - E2E_TEST_EMAIL: Email for the test user
 *   - E2E_TEST_PASSWORD: Password for the test user
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

interface NeonBranch {
  id: string;
  name: string;
  created_at: string;
  current_state: string;
}

interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
  current_state: string;
}

interface CreateBranchResponse {
  branch: NeonBranch;
  endpoints: NeonEndpoint[];
  connection_uris: Array<{
    connection_uri: string;
    connection_parameters: {
      database: string;
      role: string;
      host: string;
    };
  }>;
}

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

async function createNeonBranch(
  apiKey: string,
  projectId: string,
  parentBranchId: string,
  branchName: string,
): Promise<CreateBranchResponse> {
  const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: {
        parent_id: parentBranchId,
        name: branchName,
      },
      endpoints: [
        {
          type: 'read_write',
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Neon branch: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function waitForBranchReady(
  apiKey: string,
  projectId: string,
  branchId: string,
  maxAttempts = 30,
): Promise<void> {
  console.log(`⏳ Waiting for branch ${branchId} to become ready...`);

  for (let i = 1; i <= maxAttempts; i++) {
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check branch status: ${response.status}`);
    }

    const data = (await response.json()) as { branch: NeonBranch };
    const state = data.branch.current_state;

    if (state === 'ready') {
      console.log(`✅ Branch ${branchId} is ready`);
      return;
    }

    console.log(`  Attempt ${i}/${maxAttempts}: Branch state is ${state}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Branch ${branchId} did not become ready in time`);
}

async function waitForEndpointReady(
  apiKey: string,
  projectId: string,
  endpointId: string,
  maxAttempts = 30,
): Promise<void> {
  console.log(`⏳ Waiting for endpoint ${endpointId} to become ready...`);

  for (let i = 1; i <= maxAttempts; i++) {
    const response = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/endpoints/${endpointId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to check endpoint status: ${response.status}`);
    }

    const data = (await response.json()) as { endpoint: NeonEndpoint };
    const state = data.endpoint.current_state;

    if (state === 'idle' || state === 'active') {
      console.log(`✅ Endpoint ${endpointId} is ready`);
      return;
    }

    console.log(`  Attempt ${i}/${maxAttempts}: Endpoint state is ${state}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Endpoint ${endpointId} did not become ready in time`);
}

async function runMigrations(connectionString: string): Promise<void> {
  console.log('🔧 Running database migrations...');

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Read and execute all migration files
    const migrationsDir = join(process.cwd(), 'packages/api/drizzle');
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
    console.log(`📦 Found ${sqlFiles.length} migration files`);

    for (const file of sqlFiles) {
      const migrationSql = await readFile(join(migrationsDir, file), 'utf-8');
      await client.query(migrationSql);
      console.log(`  ✅ Applied migration: ${file}`);
    }

    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Failed to run database migrations:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function seedTestUser(
  connectionString: string,
  email: string,
  password: string,
): Promise<void> {
  console.log(`🌱 Seeding test user: ${email}`);

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Import hashPassword from auth utils
    // For now, use bcryptjs directly to avoid import issues
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    const normalizedEmail = email.toLowerCase();

    // Upsert the test user
    const result = await client.query(
      `
      INSERT INTO users (email, password_hash, email_verified, first_name, last_name, role, created_at, updated_at)
      VALUES ($1, $2, true, 'E2E', 'Test', 'USER', NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = $2,
        email_verified = true,
        updated_at = NOW()
      RETURNING id
    `,
      [normalizedEmail, passwordHash],
    );

    const userId = result.rows[0]?.id;
    console.log(`✅ Test user created/updated: ${normalizedEmail} (id=${userId})`);
  } catch (error) {
    console.error('❌ Failed to seed test user:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const neonApiKey = process.env.NEON_API_KEY;
  const neonProjectId = process.env.NEON_PROJECT_ID;
  const parentBranchId = process.env.NEON_PARENT_BRANCH_ID || 'main';
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;

  if (!neonApiKey) {
    throw new Error('NEON_API_KEY environment variable is required');
  }
  if (!neonProjectId) {
    throw new Error('NEON_PROJECT_ID environment variable is required');
  }
  if (!testEmail) {
    throw new Error('E2E_TEST_EMAIL environment variable is required');
  }
  if (!testPassword) {
    throw new Error('E2E_TEST_PASSWORD environment variable is required');
  }

  // Generate unique branch name with timestamp
  const timestamp = Date.now();
  const branchName = `e2e-test-${timestamp}`;
  const branchIdFile = `/tmp/e2e-branch-${timestamp}.json`;

  console.log('🚀 Provisioning ephemeral Neon database branch...');
  console.log(`  Project: ${neonProjectId}`);
  console.log(`  Parent: ${parentBranchId}`);
  console.log(`  Branch: ${branchName}`);

  try {
    // Create the branch
    const createResponse = await createNeonBranch(
      neonApiKey,
      neonProjectId,
      parentBranchId,
      branchName,
    );

    const branchId = createResponse.branch.id;
    const endpointId = createResponse.endpoints[0]?.id;
    const connectionUri = createResponse.connection_uris[0]?.connection_uri;

    if (!connectionUri) {
      throw new Error('No connection URI returned from Neon API');
    }

    console.log(`✅ Branch created: ${branchId}`);
    console.log(`  Endpoint: ${endpointId}`);

    // Wait for branch and endpoint to be ready
    await waitForBranchReady(neonApiKey, neonProjectId, branchId);
    if (endpointId) {
      await waitForEndpointReady(neonApiKey, neonProjectId, endpointId);
    }

    // Run migrations
    await runMigrations(connectionUri);

    // Seed test user
    await seedTestUser(connectionUri, testEmail, testPassword);

    // Save branch info for cleanup
    const branchInfo = {
      branchId,
      branchName,
      projectId: neonProjectId,
      connectionUri,
      timestamp,
    };

    await Bun.write(branchIdFile, JSON.stringify(branchInfo, null, 2));

    console.log('');
    console.log('✅ E2E database provisioning complete!');
    console.log('');
    console.log('Export these environment variables:');
    console.log(`  export E2E_BRANCH_ID=${branchId}`);
    console.log(`  export E2E_BRANCH_NAME=${branchName}`);
    console.log(`  export E2E_DATABASE_URL="${connectionUri}"`);
    console.log('');
    console.log(`Branch info saved to: ${branchIdFile}`);
    console.log('');
    console.log('To cleanup this branch, run:');
    console.log(`  bun run packages/api/scripts/cleanup-e2e-db.ts ${branchIdFile}`);

    // Output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = [
        `branch_id=${branchId}`,
        `branch_name=${branchName}`,
        `connection_uri=${connectionUri}`,
        `branch_info_file=${branchIdFile}`,
      ].join('\n');

      await Bun.write(process.env.GITHUB_OUTPUT, output + '\n', { flags: 'a' });
    }
  } catch (error) {
    console.error('❌ Failed to provision E2E database:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
