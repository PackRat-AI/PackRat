import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '..');
const composeFile = resolve(apiDir, 'docker-compose.e2e.yml');
const e2eKvDir = nodeEnv.E2E_KV_PERSIST_DIR ?? resolve(apiDir, '.wrangler/state/e2e-auth-kv');
const e2eDbPort = nodeEnv.E2E_DB_PORT ?? '5435';
const wipeVolumes = Bun.argv.slice(2).some((arg) => arg === '--volumes' || arg === '-v');
const env = {
  ...Bun.env,
  COMPOSE_PROJECT_NAME: nodeEnv.COMPOSE_PROJECT_NAME ?? `packrat_e2e_${e2eDbPort}`,
  E2E_DB_PORT: e2eDbPort,
};

if (wipeVolumes) {
  console.log('Stopping and removing containers + data volume...');
} else {
  console.log('Stopping containers (data volume preserved)...');
  console.log('Pass --volumes to also wipe the Postgres data.');
}

const command = [
  'docker',
  'compose',
  '-f',
  composeFile,
  'down',
  ...(wipeVolumes ? ['--volumes'] : []),
];
const child = Bun.spawn(command, {
  env,
  stdout: 'inherit',
  stderr: 'inherit',
});
const exitCode = await child.exited;
if (exitCode !== 0) process.exit(exitCode);

if (wipeVolumes) {
  await rm(e2eKvDir, { recursive: true, force: true });
}
console.log('Done.');
