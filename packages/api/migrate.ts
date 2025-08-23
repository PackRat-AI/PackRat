import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as ws from 'ws';

// Required for Neon serverless driver to work in Node.js
neonConfig.webSocketConstructor = ws;

// Check if we're using a standard PostgreSQL URL (for tests) vs Neon URL
const isStandardPostgresUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Detect Neon hosts (*.neon.tech, *.neon.com)
    const isNeon = hostname.endsWith('.neon.tech') || hostname === 'neon.tech'
                 || hostname.endsWith('.neon.com') || hostname === 'neon.com';
    return parsed.protocol === 'postgres:' && !isNeon;
  } catch {
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
    await migratePg(db, { migrationsFolder: `${__dirname}/drizzle` });
    await client.end();
  } else {
    // Use Neon serverless for Neon URLs
    console.log('Using Neon serverless migrations...');
    const sql = neon(url);
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: `${__dirname}/drizzle` });
  }

  console.log('Migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
