/**
 * Dev helper to drive the early-access demo by hand. Flips a `feature_access`
 * row between states so you can watch the EarlyAccessGate react in the app —
 * no RevenueCat needed to exercise the graduation path.
 *
 * DB URL resolution (first hit wins):
 *   1. --url <postgres-url>
 *   2. $NEON_DATABASE_URL
 *   3. NEON_DATABASE_URL parsed from packages/api/.dev.vars
 *
 * Usage (from repo root):
 *   bun packages/api/scripts/feature-access-demo.ts show
 *   bun packages/api/scripts/feature-access-demo.ts seed [key] [days]   # in early access (Pro-only)
 *   bun packages/api/scripts/feature-access-demo.ts graduate [key]      # free for everyone now
 *   bun packages/api/scripts/feature-access-demo.ts clear [key]         # remove the row
 *
 * `key` defaults to "guides" (the screen wired in app/(app)/guides/index.tsx).
 */
import { readFileSync } from 'node:fs';
import { neon, neonConfig } from '@neondatabase/serverless';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

const NEON_URL_RE = /^\s*NEON_DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m;

function resolveUrl(): string {
  const flagIdx = process.argv.indexOf('--url');
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) return process.argv[flagIdx + 1] as string;
  if (process.env.NEON_DATABASE_URL) return process.env.NEON_DATABASE_URL;
  try {
    const devVars = readFileSync(new URL('../.dev.vars', import.meta.url).pathname, 'utf-8');
    const match = devVars.match(NEON_URL_RE);
    if (match?.[1]) return match[1];
  } catch {
    // fall through
  }
  throw new Error(
    'No DB URL — pass --url, set NEON_DATABASE_URL, or add it to packages/api/.dev.vars',
  );
}

function isStandardPostgres(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const neonHost = host.endsWith('.neon.tech') || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !neonHost;
  } catch {
    return false;
  }
}

type SqlRunner = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

async function withDb<T>(url: string, fn: (run: SqlRunner) => Promise<T>): Promise<T> {
  if (isStandardPostgres(url)) {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      return await fn(async (text, params) => (await client.query(text, params)).rows);
    } finally {
      await client.end();
    }
  }
  const sql = neon(url);
  return fn(
    async (text, params) => (await sql.query(text, params ?? [])) as Record<string, unknown>[],
  );
}

function positionalArgs(): string[] {
  const args = process.argv.slice(2);
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') {
      i++; // skip the flag's value
      continue;
    }
    out.push(args[i] as string);
  }
  return out;
}

async function main() {
  const [cmd = 'show', key = 'guides', daysArg] = positionalArgs();
  const url = resolveUrl();
  const where = url.includes('localhost') ? 'local docker' : 'remote (likely your dev DB)';
  console.log(`→ ${cmd}  key="${key}"  db=${where}\n`);

  await withDb(url, async (run) => {
    switch (cmd) {
      case 'seed': {
        const days = Number(daysArg ?? 30);
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await run(
          `INSERT INTO feature_access (key, label, early_access_until)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, early_access_until = EXCLUDED.early_access_until, updated_at = now()`,
          [key, prettyLabel(key), until],
        );
        console.log(`✅ "${key}" is now in EARLY ACCESS until ${until.toISOString()} (${days}d).`);
        console.log('   → Non-Pro users see the paywall. Pro users pass.');
        break;
      }
      case 'graduate': {
        const past = new Date(Date.now() - 60 * 1000);
        const rows = await run(
          `UPDATE feature_access SET early_access_until = $2, updated_at = now() WHERE key = $1 RETURNING key`,
          [key, past],
        );
        if (rows.length === 0) console.log(`⚠️  No row for "${key}" — run "seed ${key}" first.`);
        else
          console.log(
            `✅ "${key}" GRADUATED (until ${past.toISOString()}). Now free for everyone.`,
          );
        break;
      }
      case 'clear': {
        await run(`DELETE FROM feature_access WHERE key = $1`, [key]);
        console.log(`✅ Removed "${key}". Unconfigured features are never gated (render for all).`);
        break;
      }
      default: {
        const rows = await run(
          `SELECT key, label, early_access_until FROM feature_access ORDER BY key`,
        );
        if (rows.length === 0)
          console.log('(no feature_access rows — every feature renders for everyone)');
        for (const r of rows) {
          const until = r.early_access_until ? new Date(r.early_access_until as string) : null;
          const state = !until
            ? 'GA (free)'
            : until.getTime() > Date.now()
              ? `EARLY ACCESS until ${until.toISOString()}`
              : 'GRADUATED (free)';
          console.log(`  ${String(r.key).padEnd(16)} ${state}`);
        }
      }
    }
  });
}

function prettyLabel(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

main().catch((e) => {
  console.error('feature-access-demo error:', e);
  process.exit(1);
});
