#!/usr/bin/env bun
/**
 * Pre-register Claude.ai's MCP OAuth callbacks as trusted clients on the
 * PackRat MCP Worker.
 *
 * Why this exists:
 *   When a user installs the PackRat connector in Claude.ai, Claude's OAuth
 *   client hits our `/register` endpoint to mint a fresh DCR client. Today
 *   `/register` is gated by `MCP_INITIAL_ACCESS_TOKEN` (see `auth.ts:
 *   dcrRegisterGate`), so an *unauthenticated* Claude.ai client cannot
 *   self-register and the install flow fails. Pre-registering both Claude
 *   callback hosts with a known `client_id` resolves this and additionally
 *   suppresses the consent screen the first time a user connects (Claude
 *   recognizes the pinned `client_name: "Claude"` and skips the prompt).
 *
 * Run once per environment:
 *   bun packages/mcp/scripts/register-claude-clients.ts --env prod
 *   bun packages/mcp/scripts/register-claude-clients.ts --env dev --url https://packrat-mcp-dev.<your-acct>.workers.dev
 *
 * The script is idempotent: it `listClients`-style probes via the
 * `/register` endpoint and skips creation if a client with the same
 * (client_name, redirect_uri) pair already exists.
 *
 *   - Token source priority: `--token <value>` arg, then `MCP_INITIAL_ACCESS_TOKEN`
 *     in the environment, then attempts to read it from `.dev.vars` (relative
 *     to the script's parent dir). Fails with a clear error if none is found.
 *
 * NOTE: This script does NOT use Cloudflare APIs or `wrangler kv`. It only
 * speaks RFC 7591 over HTTPS to the Worker. Anyone with the initial access
 * token + the Worker URL can run it.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ────────────────────────────────────────────────────────────────────

const CLAUDE_CALLBACKS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
] as const;

const CLIENT_METADATA_BASE = {
  client_name: 'Claude',
  client_uri: 'https://claude.ai',
  policy_uri: 'https://www.anthropic.com/privacy',
  tos_uri: 'https://www.anthropic.com/legal/consumer-terms',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'client_secret_basic',
} as const;

const ENV_TARGETS = {
  prod: 'https://mcp.packratai.com',
  dev: null, // require explicit --url
} as const;

/**
 * Heuristic for "this /register error means the client already exists" —
 * used to make the script idempotent. The OAuth provider library does not
 * standardize a duplicate-client error code in 0.7.0, so we match common
 * shapes ("already exists", "duplicate", etc.) in addition to HTTP 409.
 */
const DUPLICATE_CLIENT_RE = /already.*exist|duplicate/i;

// ── CLI parsing ───────────────────────────────────────────────────────────────

interface CliArgs {
  env: 'prod' | 'dev';
  url: string | null;
  token: string | null;
  help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { env: 'prod', url: null, token: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--env': {
        const next = argv[++i];
        if (next !== 'prod' && next !== 'dev') {
          throw new Error(`--env must be "prod" or "dev" (got "${next}")`);
        }
        args.env = next;
        break;
      }
      case '--url':
        args.url = argv[++i] ?? null;
        break;
      case '--token':
        args.token = argv[++i] ?? null;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`register-claude-clients — pre-register Claude.ai callbacks on the PackRat MCP Worker

Usage:
  bun packages/mcp/scripts/register-claude-clients.ts [--env prod|dev] [--url URL] [--token TOKEN]

Flags:
  --env <prod|dev>   Target environment. prod uses ${ENV_TARGETS.prod};
                     dev requires an explicit --url. (default: prod)
  --url <url>        Override the Worker base URL (no trailing slash).
  --token <token>    Initial access token to authenticate the /register call.
                     Falls back to MCP_INITIAL_ACCESS_TOKEN env var, then to
                     the value in packages/mcp/.dev.vars.
  -h, --help         Print this help.

Behavior:
  Registers two clients on the target Worker — one for each of Claude.ai's
  callback hosts (claude.ai, claude.com). Idempotent: skips creation if a
  client with the same (client_name, redirect_uri) already exists.

  The script does not require Wrangler or Cloudflare API tokens. It only
  speaks RFC 7591 over HTTPS to the Worker.
`);
}

// ── Token discovery ───────────────────────────────────────────────────────────

async function loadDevVarsToken(): Promise<string | null> {
  const here = dirname(fileURLToPath(import.meta.url));
  const devVarsPath = resolve(here, '../.dev.vars');
  try {
    const contents = await readFile(devVarsPath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== 'MCP_INITIAL_ACCESS_TOKEN') continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return val || null;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return null;
}

async function resolveToken(cliToken: string | null): Promise<string> {
  if (cliToken && cliToken.length > 0) return cliToken;
  const envToken = process.env.MCP_INITIAL_ACCESS_TOKEN;
  if (envToken && envToken.length > 0) return envToken;
  const devVarsToken = await loadDevVarsToken();
  if (devVarsToken && devVarsToken.length > 0) return devVarsToken;
  throw new Error(
    'No initial access token found. Pass --token, set MCP_INITIAL_ACCESS_TOKEN, ' +
      'or add it to packages/mcp/.dev.vars',
  );
}

function resolveBaseUrl(args: CliArgs): string {
  if (args.url) return stripTrailingSlash(args.url);
  const envUrl = ENV_TARGETS[args.env];
  if (envUrl) return envUrl;
  throw new Error(
    `--env dev requires --url to be set (no canonical dev URL is hard-coded; pass the *.workers.dev URL of your dev worker)`,
  );
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface ClientInfo {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  client_secret?: string;
}

interface RegistrationError {
  status: number;
  body: string;
}

function isRegistrationError(value: unknown): value is RegistrationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number'
  );
}

async function registerClient(opts: {
  baseUrl: string;
  token: string;
  redirectUri: string;
}): Promise<ClientInfo> {
  const res = await fetch(`${opts.baseUrl}/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...CLIENT_METADATA_BASE,
      redirect_uris: [opts.redirectUri],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw { status: res.status, body } satisfies RegistrationError;
  }

  return (await res.json()) as ClientInfo;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
    printHelp();
    process.exit(2);
  }

  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = resolveBaseUrl(args);
  const token = await resolveToken(args.token);

  console.log(`Pre-registering Claude callbacks on ${baseUrl}`);
  console.log(`  callbacks: ${CLAUDE_CALLBACKS.join(', ')}`);
  console.log();

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const callback of CLAUDE_CALLBACKS) {
    process.stdout.write(`  -> ${callback} ... `);
    try {
      const client = await registerClient({ baseUrl, token, redirectUri: callback });
      console.log(`registered (client_id=${client.client_id})`);
      if (client.client_secret) {
        console.log(`     client_secret=${client.client_secret}`);
        console.log(
          `     ^^ store this secret if you need to reuse the client; the server only retains its hash`,
        );
      }
      registered++;
    } catch (err) {
      if (isRegistrationError(err)) {
        const looksLikeDuplicate = err.status === 409 || DUPLICATE_CLIENT_RE.test(err.body);
        if (looksLikeDuplicate) {
          console.log(`already registered (skipped)`);
          skipped++;
        } else {
          console.log(`failed (HTTP ${err.status})`);
          console.error(`     body: ${err.body.slice(0, 500)}`);
          failed++;
        }
      } else {
        console.log(`failed`);
        console.error(`     ${(err as Error).message ?? err}`);
        failed++;
      }
    }
  }

  console.log();
  console.log(`Done: ${registered} registered, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Error: ${(err as Error).message ?? err}`);
  process.exit(1);
});
