#!/usr/bin/env bun
// Test database management script for PackRat API tests

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const composeFile = join(__dirname, 'docker-compose.test.yml');

function runDocker(args: string[]): void {
  execSync(`docker compose -f "${composeFile}" ${args.join(' ')}`, {
    stdio: 'inherit',
  });
}

function isRunning(): boolean {
  try {
    execSync("docker ps --filter name=packrat-test-db --format '{{.Names}}'", {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function isReady(): boolean {
  try {
    execSync('docker exec packrat-test-db pg_isready -U test_user -d packrat_test', {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

const command = process.argv[2] ?? 'start';

switch (command) {
  case 'start': {
    console.log('Starting PostgreSQL test database...');
    runDocker(['up', '-d']);
    console.log('Waiting for database to be ready...');
    let attempts = 0;
    while (attempts < 10 && !isReady()) {
      Bun.sleep(1000);
      attempts++;
    }
    if (isReady()) {
      console.log('✅ Test database running on localhost:5433');
    } else {
      console.log('❌ Database failed to start');
      process.exit(1);
    }
    break;
  }

  case 'stop': {
    console.log('Stopping PostgreSQL test database...');
    runDocker(['down']);
    console.log('✅ Test database stopped');
    break;
  }

  case 'restart': {
    execSync(`${process.argv[0]} ${import.meta.path} stop`, { stdio: 'inherit' });
    Bun.sleep(1000);
    execSync(`${process.argv[0]} ${import.meta.path} start`, { stdio: 'inherit' });
    break;
  }

  case 'status': {
    if (isRunning() && isReady()) {
      console.log('🟢 Test database is running');
    } else {
      console.log('🔴 Test database is not running');
    }
    break;
  }

  default:
    console.log(`Usage: ${process.argv[1]} {start|stop|restart|status}`);
    process.exit(1);
}
