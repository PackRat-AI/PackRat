import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      (u.protocol === 'postgres:' || u.protocol === 'postgresql:') &&
      !host.endsWith('.neon.tech') &&
      !host.endsWith('.neon.com')
    );
  } catch {
    return false;
  }
};

async function runMigrations() {
  const url = process.env.OSM_DATABASE_URL_LOCAL;
  if (!url) throw new Error('OSM_DATABASE_URL_LOCAL is required');

  console.log('Running OSM DB migrations...');

  if (isStandardPostgresUrl(url)) {
    console.log('Using PostgreSQL migrations...');
    const client = new Client({ connectionString: url });
    await client.connect();
    const db = drizzlePg(client);
    await migratePg(db, { migrationsFolder: join(__dirname, 'drizzle') });
    await client.end();
  } else {
    console.log('Using Neon serverless migrations...');
    const sql = neon(url);
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: join(__dirname, 'drizzle') });
  }

  console.log('OSM DB migrations completed.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
