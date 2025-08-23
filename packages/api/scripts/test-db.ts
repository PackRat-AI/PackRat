#!/usr/bin/env bun

import { $ } from 'bun';

const COMPOSE_FILE = 'docker-compose.test.yml';
const _DB_URL = 'postgres://test_user:test_password@localhost:5433/packrat_test';

async function startContainer() {
  console.log('🐳 Starting PostgreSQL test container...');
  try {
    const result = await $`docker compose -f ${COMPOSE_FILE} up -d --wait`;
    if (result.exitCode !== 0) {
      throw new Error(`Docker compose failed with code ${result.exitCode}`);
    }
    console.log('✅ PostgreSQL test container started');
  } catch (error) {
    console.error('❌ Failed to start PostgreSQL container:', error);
    process.exit(1);
  }
}

async function stopContainer() {
  console.log('🧹 Stopping PostgreSQL test container...');
  try {
    const result = await $`docker compose -f ${COMPOSE_FILE} down -v`;
    if (result.exitCode !== 0) {
      throw new Error(`Docker compose failed with code ${result.exitCode}`);
    }
    console.log('✅ PostgreSQL test container stopped and cleaned up');
  } catch (error) {
    console.error('❌ Failed to stop PostgreSQL container:', error);
    process.exit(1);
  }
}

async function resetContainer() {
  console.log('🔄 Resetting PostgreSQL test container...');
  try {
    // Stop first
    await stopContainer();
    // Then start
    await startContainer();
    console.log('✅ PostgreSQL test container reset completed');
  } catch (error) {
    console.error('❌ Failed to reset PostgreSQL container:', error);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.error('Usage: bun test-db.ts {start|stop|reset}');
    process.exit(1);
  }

  switch (command) {
    case 'start':
      await startContainer();
      break;
    case 'stop':
      await stopContainer();
      break;
    case 'reset':
      await resetContainer();
      break;
    default:
      console.error('Usage: bun test-db.ts {start|stop|reset}');
      process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
