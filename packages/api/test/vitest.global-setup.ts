// vitest.global-setup.ts

import { execSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

const COMPOSE_FILE = 'docker-compose.test.yml';

async function waitForPostgres(port = 5433) {
  const maxAttempts = 10;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const client = new Client({
        host: 'localhost',
        port,
        user: 'test_user',
        password: 'test_password',
        database: 'packrat_test',
      });
      await client.connect();
      await client.end();
      console.log('✅ Postgres is ready');
      return;
    } catch {
      console.log(`⏳ Waiting for Postgres (${i}/${maxAttempts})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Postgres container did not become ready in time');
}

async function runMigrations() {
  console.log('🔧 Running database migrations...');

  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'packrat_test',
    user: 'test_user',
    password: 'test_password',
  });

  try {
    await client.connect();

    // Read and execute all migration files
    const migrationsDir = join(process.cwd(), 'drizzle');
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

export async function setup() {
  try {
    console.log('🐳 Starting Docker Compose for tests...');
    execSync(`docker compose -f ${COMPOSE_FILE} up -d`, { stdio: 'inherit' });
    await waitForPostgres(5433);
    console.log('🚀 Test database ready!');

    // Run migrations after database is ready
    await runMigrations();
    process.env.INTEGRATION_DB_AVAILABLE = 'true';
  } catch (error) {
    console.warn(
      '⚠️  Database setup failed – integration tests will be skipped:',
      (error as Error).message,
    );
    process.env.INTEGRATION_DB_AVAILABLE = 'false';
  }
}

export async function teardown() {
  console.log('🧹 Stopping Docker Compose...');
  execSync(`docker compose -f ${COMPOSE_FILE} down -v`, { stdio: 'inherit' });
  console.log('✅ Docker Compose stopped');
}
