import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { neon, neonConfig } from '@neondatabase/serverless';
import { nodeEnv } from '@packrat/env/node';
import { drizzle as drizzleBunSQL } from 'drizzle-orm/bun-sql';
import { migrate as migrateBunSQL } from 'drizzle-orm/bun-sql/migrator';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import WebSocket from 'ws';

// Required for Neon serverless driver to work in Node.js
neonConfig.webSocketConstructor = WebSocket;

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STANDARD_POSTGRES_MIGRATION_ATTEMPTS = 3;
const STANDARD_POSTGRES_MIGRATION_SETTLE_TIMEOUT_MS = 120_000;

// Check if we're using a standard PostgreSQL URL (for tests) vs Neon URL
// Import the utility function from src/db/index.ts since it's defined there
const isStandardPostgresUrl = (url: string) => {
  // Parse and check the hostname to robustly exclude Neon domains
  try {
    const u = new URL(url);
    // Only allow if NOT neon.tech and NOT neon.com, and NOT their subdomains
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !isNeonTech && !isNeonCom;
  } catch {
    // Any parsing error: treat as NOT standard Postgres
    return false;
  }
};

function expectedMigrationCount() {
  const journal = JSON.parse(
    readFileSync(join(__dirname, 'drizzle/meta/_journal.json'), 'utf8'),
  ) as { entries?: unknown[] };
  return journal.entries?.length ?? 0;
}

async function appliedMigrationCount(url: string) {
  const sql = new Bun.SQL(url);
  try {
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count
      from drizzle.__drizzle_migrations
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  } finally {
    await sql.close().catch(() => undefined);
  }
}

async function waitForPostgresMigrationLedger(input: {
  url: string;
  expectedCount: number;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < input.timeoutMs) {
    if ((await appliedMigrationCount(input.url)) >= input.expectedCount) return;
    await sleep(1000);
  }
  throw new Error(
    `PostgreSQL migration ledger did not reach ${input.expectedCount} entries within ${
      input.timeoutMs / 1000
    }s.`,
  );
}

async function runPostgresMigrations(url: string) {
  let lastError: unknown;
  const expectedCount = expectedMigrationCount();

  for (let attempt = 1; attempt <= STANDARD_POSTGRES_MIGRATION_ATTEMPTS; attempt += 1) {
    const sql = new Bun.SQL(url);

    try {
      const db = drizzleBunSQL(sql);
      const migration = migrateBunSQL(db, { migrationsFolder: join(__dirname, 'drizzle') });
      migration.catch(() => undefined);
      await Promise.race([
        migration,
        waitForPostgresMigrationLedger({
          url,
          expectedCount,
          timeoutMs: STANDARD_POSTGRES_MIGRATION_SETTLE_TIMEOUT_MS,
        }),
      ]);
      await sql.close();
      return;
    } catch (error) {
      lastError = error;
      await sql.close().catch(() => undefined);

      const message = error instanceof Error ? error.message : String(error);
      if (attempt === STANDARD_POSTGRES_MIGRATION_ATTEMPTS) {
        break;
      }

      console.warn(
        `PostgreSQL migration attempt ${attempt} failed (${message}); retrying after database startup settles...`,
      );
      await sleep(2_000);
    }
  }

  throw lastError;
}

async function runMigrations() {
  const url = nodeEnv.NEON_DATABASE_URL;
  if (!url) throw new Error('NEON_DATABASE_URL is required');

  console.log('Running migrations...');
  if (isStandardPostgresUrl(url)) {
    // Use node-postgres for standard PostgreSQL
    console.log('Using PostgreSQL migrations...');
    await runPostgresMigrations(url);
  } else {
    // Use Neon serverless for Neon URLs
    console.log('Using Neon serverless migrations...');
    const sql = neon(url);
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: join(__dirname, 'drizzle') });
  }

  console.log('Migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
