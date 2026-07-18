import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '..');
const composeFile = resolve(apiDir, 'docker-compose.e2e.yml');
const baseEnv: NodeJS.ProcessEnv = Bun.env;
const e2eVars = nodeEnv.E2E_VARS ?? resolve(apiDir, '.dev.vars.e2e');
const e2eDbPort = nodeEnv.E2E_DB_PORT ?? '5435';
const e2eDbUrl =
  nodeEnv.E2E_DB_URL ?? `postgres://e2e_user:e2e_pass@localhost:${e2eDbPort}/packrat_e2e`;
const apiPort = nodeEnv.PORT ?? '8787';
const composeEnv = {
  ...baseEnv,
  COMPOSE_PROJECT_NAME: nodeEnv.COMPOSE_PROJECT_NAME ?? `packrat_e2e_${e2eDbPort}`,
  E2E_DB_PORT: e2eDbPort,
};

async function run(opts: {
  command: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  captureOutput?: boolean;
}) {
  const { command } = opts;
  const child = Bun.spawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? composeEnv,
    stdout: opts.captureOutput ? 'pipe' : 'inherit',
    stderr: opts.captureOutput ? 'pipe' : 'inherit',
  });
  const [stdout, stderr] = opts.captureOutput
    ? await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
    : ['', ''];
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with ${exitCode}`);
  if (opts.captureOutput) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
  return `${stdout}${stderr}`;
}

async function succeeds(command: string[]) {
  const child = Bun.spawn(command, {
    env: composeEnv,
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return (await child.exited) === 0;
}

function parseEnvFile(text: string) {
  const vars: Record<string, string> = {};
  for (const rawLine of text.replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function upsertEnvFileValue(input: { path: string; key: string; value: string }) {
  const { path, key, value } = input;
  const lines = readFileSync(path, 'utf8').replaceAll('\r\n', '\n').split('\n');
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!line.trim().startsWith(`${key}=`)) return line;
    updated = true;
    return `${key}=${value}`;
  });
  if (!updated) nextLines.push(`${key}=${value}`);
  writeFileSync(path, nextLines.join('\n'));
}

if (!(await succeeds(['docker', '--version']))) {
  console.error('Error: Docker not found. Install Docker Desktop and try again.');
  process.exit(1);
}

if (!existsSync(e2eVars)) {
  console.error(`Error: ${e2eVars} not found.`);
  console.error('Run first: bun run --filter @packrat/api dev:e2e:init');
  process.exit(1);
}

console.log(`Starting local Postgres (packrat_e2e on port ${e2eDbPort})...`);
await run({ command: ['docker', 'compose', '-f', composeFile, 'up', '-d'] });

console.log('Waiting for Postgres to be ready...');
let ready = false;
for (let i = 0; i < 30; i++) {
  if (
    await succeeds([
      'docker',
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres-e2e',
      'pg_isready',
      '-U',
      'e2e_user',
      '-d',
      'packrat_e2e',
    ])
  ) {
    ready = true;
    break;
  }
  await Bun.sleep(1000);
}
if (!ready) {
  console.error('Error: Postgres did not become healthy in time.');
  await run({ command: ['docker', 'compose', '-f', composeFile, 'logs', 'postgres-e2e'] });
  process.exit(1);
}
console.log('Postgres ready.');

console.log('Running schema migrations...');
await run({
  command: ['bun', 'run', 'db:migrate'],
  cwd: apiDir,
  env: {
    ...composeEnv,
    NEON_DATABASE_URL: e2eDbUrl,
  },
});

const envFileVars = parseEnvFile(await Bun.file(e2eVars).text());
const e2eEmail = nodeEnv.E2E_TEST_EMAIL ?? envFileVars.E2E_TEST_EMAIL ?? 'e2e@packrattest.local';
const e2ePass = nodeEnv.E2E_TEST_PASSWORD ?? envFileVars.E2E_TEST_PASSWORD ?? 'E2eTestPass123!';

console.log(`Seeding E2E test user (${e2eEmail})...`);
const seedOutput = await run({
  command: ['bun', 'run', 'db:seed:e2e-user'],
  cwd: apiDir,
  env: {
    ...composeEnv,
    NEON_DATABASE_URL: e2eDbUrl,
    E2E_TEST_EMAIL: e2eEmail,
    E2E_TEST_PASSWORD: e2ePass,
  },
  captureOutput: true,
});
const seededUserId = seedOutput.split('(id=').at(1)?.split(')').at(0);
if (!seededUserId) {
  throw new Error('Unable to resolve seeded E2E user id from db:seed:e2e-user output.');
}
upsertEnvFileValue({ path: e2eVars, key: 'E2E_TEST_USER_ID', value: seededUserId });

console.log('');
console.log(`Starting local E2E API on http://localhost:${apiPort} ...`);
console.log(`Using env file: ${e2eVars}`);
console.log('Press Ctrl+C to stop.');
console.log('');

const apiEnv = {
  ...composeEnv,
  ...envFileVars,
  PORT: apiPort,
  NODE_ENV: 'test',
  NEON_DATABASE_URL: e2eDbUrl,
  NEON_DATABASE_URL_READONLY: e2eDbUrl,
  E2E_TEST_EMAIL: e2eEmail,
  E2E_TEST_PASSWORD: e2ePass,
  E2E_TEST_USER_ID: seededUserId,
  BETTER_AUTH_URL: `http://127.0.0.1:${apiPort}`,
  OPENAI_API_KEY:
    nodeEnv.OPENAI_API_KEY ??
    (envFileVars.OPENAI_API_KEY === 'sk-test' ? 'sk-e2e-stub-local' : envFileVars.OPENAI_API_KEY),
  WEATHER_API_KEY: nodeEnv.WEATHER_API_KEY ?? 'weather-e2e-stub-local',
  APPLE_PRIVATE_KEY: nodeEnv.APPLE_PRIVATE_KEY ?? '',
  PACKRAT_PG_POOL_MAX: nodeEnv.PACKRAT_PG_POOL_MAX ?? envFileVars.PACKRAT_PG_POOL_MAX ?? '50',
};

const child = Bun.spawn(['bun', 'run', 'dev:e2e:node'], {
  cwd: apiDir,
  env: apiEnv,
  stdout: 'inherit',
  stderr: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

process.exit(await child.exited);
