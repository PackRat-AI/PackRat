/**
 * Emits the secret bundle for the isolated `packrat-api-weather` worker on
 * stdout, for piping into `wrangler secret bulk`. Values are read from the main
 * checkout's .env.local and never written to disk.
 *
 *   bun scripts/wa-secrets.ts | bunx wrangler secret bulk --config wrangler.weather.jsonc
 */
import fs from 'node:fs';
import os from 'node:os';

const ENV_PATH = '/Users/mac/Desktop/PackRat/.env.local';
const REGISTRY = `${os.homedir()}/.packrat/devenv/worktree-weather-alerts-proactive.json`;
const WORKER_URL = 'https://packrat-api-weather.orange-frost-d665.workers.dev';

const env = fs.readFileSync(ENV_PATH, 'utf8');

function single(key: string): string | null {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m?.[1]) return null;
  let v = m[1].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v;
}

const SINGLE_LINE = [
  'APNS_BUNDLE_ID',
  'APNS_ENVIRONMENT',
  'APNS_KEY_ID',
  'APNS_TEAM_ID',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'WEATHER_API_KEY',
  'PACKRAT_MCP_URL',
];

const out: Record<string, string> = {};
const missing: string[] = [];

for (const key of SINGLE_LINE) {
  const v = single(key);
  if (v) out[key] = v;
  else missing.push(key);
}

// PEM values are stored on one line with escaped newlines; APNs needs real ones.
for (const key of ['APNS_PRIVATE_KEY', 'APPLE_PRIVATE_KEY']) {
  const v = single(key);
  if (v) out[key] = v.replace(/\\n/g, '\n');
  else missing.push(key);
}

// Point the worker at the isolated Neon branch, not the shared dev database.
const branch = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) as { databaseUrl: string };
out.NEON_DATABASE_URL = branch.databaseUrl;
out.NEON_DATABASE_URL_READONLY = branch.databaseUrl;
out.PACKRAT_API_URL = WORKER_URL;

if (missing.length) {
  console.error(`[wa-secrets] missing from .env.local: ${missing.join(', ')}`);
  process.exit(1);
}

console.error(`[wa-secrets] ${Object.keys(out).length} secrets ready`);
process.stdout.write(JSON.stringify(out));
