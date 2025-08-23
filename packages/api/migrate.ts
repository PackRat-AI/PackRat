import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as ws from 'ws';

// Required for Neon serverless driver to work in Node.js
neonConfig.webSocketConstructor = ws;

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function runMigrations() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('NEON_DATABASE_URL is not set');
  }

  console.log('Running migrations...');

  const url = process.env.NEON_DATABASE_URL;

  if (isStandardPostgresUrl(url)) {
    // Use node-postgres for standard PostgreSQL
    console.log('Using PostgreSQL migrations...');
    const client = new Client({ connectionString: url });
    await client.connect();
    const db = drizzlePg(client);
    await migratePg(db, { migrationsFolder: join(__dirname, 'drizzle') });
    await client.end();
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
