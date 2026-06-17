import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { neon, neonConfig } from '@neondatabase/serverless';
import { nodeEnv } from '@packrat/env/node';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import WebSocket from 'ws';

// Required for Neon serverless driver to work in Node.js
neonConfig.webSocketConstructor = WebSocket;

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STANDARD_POSTGRES_MIGRATION_ATTEMPTS = 3;

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

async function runPostgresMigrations(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= STANDARD_POSTGRES_MIGRATION_ATTEMPTS; attempt += 1) {
    const client = new Client({ connectionString: url });

    try {
      await client.connect();
      const db = drizzlePg(client);
      await migratePg(db, { migrationsFolder: join(__dirname, 'drizzle') });
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);

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
