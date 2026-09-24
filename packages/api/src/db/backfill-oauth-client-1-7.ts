/**
 * Backfill: carry `oauthClient.type` into `application_type` before the
 * Better Auth 1.7 migration drops it.
 *
 * # Run this BEFORE applying migration 0052
 *
 * 1.7 removed `oauthClient.public` and `oauthClient.type`, replacing them with
 * `application_type` (metadata) plus `client_credentials_scopes` (a real
 * authorization control). `drizzle-kit generate` emits the ADD COLUMNs and the
 * DROP COLUMNs in one file, so by the time 0052 has run the old values are
 * already gone and nothing can read them.
 *
 * This script is therefore a pre-migration step, not a post-migration seed:
 *
 *   cd packages/api && bun run db:backfill:oauth-client-1-7   # then migrate
 *
 * It is deliberately NOT a Drizzle migration. Migrations own schema; this is
 * data, and keeping it out means the `drizzle-kit generate` rule in CLAUDE.md
 * stays absolute with no carve-out.
 *
 * # What it writes
 *
 *   application_type          ← old `type`, mapping per the 1.7 upgrade guide:
 *                               'web' and 'native' map straight across;
 *                               'user-agent-based' maps to NULL for manual
 *                               reclassification. NEVER derived from `public`
 *                               — the guide is explicit about that, because
 *                               public/confidential is a different axis and is
 *                               now decided solely by tokenEndpointAuthMethod
 *                               ('none' = public).
 *   client_credentials_scopes ← [] for every existing row. Missing, NULL and []
 *                               all deny client_credentials issuance, so this
 *                               is the deny-by-default the guide asks for.
 *                               PackRat issues no machine-to-machine tokens;
 *                               granting any scope here is a deliberate later
 *                               act through the admin endpoint.
 *
 * # Idempotent, and safe to run before or after
 *
 * Both UPDATEs are guarded on the column still existing, so a re-run after 0052
 * is a no-op rather than an error. Rows that already have a non-null
 * application_type are left alone.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { nodeEnv } from '@packrat/env/node';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !isNeonTech && !isNeonCom;
  } catch {
    return false;
  }
};

export async function backfillOAuthClient17() {
  const url = nodeEnv.NEON_DATABASE_URL;
  if (!url) throw new Error('NEON_DATABASE_URL is not set');

  let pgClient: Client | undefined;
  const db = isStandardPostgresUrl(url)
    ? await (async () => {
        pgClient = new Client({ connectionString: url });
        await pgClient.connect();
        return drizzlePg(pgClient);
      })()
    : drizzle(neon(url));

  try {
    const columnExists = async (column: string) => {
      const rows = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'oauthClient'
            AND column_name = ${column}
        ) AS exists
      `);
      return Boolean((rows.rows ?? rows)[0]?.exists);
    };

    const hasLegacyType = await columnExists('type');
    const hasApplicationType = await columnExists('application_type');

    if (!hasApplicationType) {
      throw new Error(
        'oauthClient.application_type does not exist yet. Apply the 1.7 schema ' +
          'changes up to (not including) the DROP, or run this against a database ' +
          'that already has the column.',
      );
    }

    if (hasLegacyType) {
      // 'user-agent-based' has no 1.7 equivalent and is left NULL on purpose so
      // an operator reclassifies it rather than it silently becoming 'web'.
      await db.execute(sql`
        UPDATE "oauthClient"
           SET "application_type" = "type"
         WHERE "application_type" IS NULL
           AND "type" IN ('web', 'native')
      `);
      console.log('[backfill] application_type ← type (web/native mapped, others left NULL)');
    } else {
      console.log('[backfill] oauthClient.type is already gone — skipping application_type.');
    }

    if (await columnExists('client_credentials_scopes')) {
      await db.execute(sql`
        UPDATE "oauthClient"
           SET "client_credentials_scopes" = '[]'::jsonb
         WHERE "client_credentials_scopes" IS NULL
      `);
      console.log('[backfill] client_credentials_scopes ← [] (client_credentials denied)');
    }

    console.log('[backfill] Done.');
  } finally {
    await pgClient?.end();
  }
}

if (import.meta.main) {
  backfillOAuthClient17().catch((err) => {
    console.error('[backfill] Failed:', err);
    process.exit(1);
  });
}
