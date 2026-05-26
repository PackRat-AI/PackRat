/**
 * Seed: pre-register Claude as an OAuth client in the
 * @better-auth/oauth-provider `oauthClient` table.
 *
 * Background: the plugin doesn't have a `trustedClients` config option
 * (spike-verified — see docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md
 * §Q7). Pre-registration is via DB seed. Dynamic client registration is
 * intentionally disabled (`allowDynamicClientRegistration: false` in
 * src/auth/index.ts), so this script is the only way Claude can be registered.
 *
 * Implementation note: uses `drizzle-seed` for the insert path so all four
 * PackRat seeders share one tool surface. drizzle-seed has no native upsert,
 * so an explicit existence check before `seed()` keeps re-runs idempotent
 * (drizzle-seed's `reset()` truncates and would break user packs that
 * reference Featured Pack templates — never the right option for prod
 * config rows). Every column gets an explicit `f.default()` because
 * drizzle-seed generates random values for any column not specified in
 * `.refine()` — for fixed config rows you want determinism, not generation.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> bun run packages/api/src/db/seed-claude-oauth-client.ts
 *
 * Or via the package script (also wired into CI's post-deploy step):
 *   cd packages/api && bun run db:seed:oauth-clients
 *
 * Operator runs this ONCE per environment (prod, dev) after deploying the API
 * with the oauthProvider plugin enabled. Re-runs are safe (no-op).
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { eq } from 'drizzle-orm';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { seed } from 'drizzle-seed';
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

// ── Configuration ───────────────────────────────────────────────────────────
//
// The Claude connector callback URLs. Both `claude.ai` and `claude.com`
// origins are supported — `claude.com` is the new canonical domain, `claude.ai`
// is the legacy origin still in use. Allowlisting both is intentional and
// matches what Anthropic's connector troubleshooting docs recommend.
const CLAUDE_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
];

// Deterministic client_id so re-runs are idempotent. Standard OAuth practice
// would be `generateRandomString(32, "a-z", "A-Z")`; we override to keep this
// script repeatable. The id is opaque to Claude — it's sent in
// /oauth2/authorize and validated against this row's `clientId`.
const CLAUDE_CLIENT_ID = 'packrat-claude-mcp';

// Public client — Claude is a native/browser client that can't safely hold a
// shared secret. token_endpoint_auth_method=none requires PKCE on every
// /oauth2/token exchange (RFC 7636 + OAuth 2.1).
const CLAUDE_CLIENT_NAME = 'Claude';

// Client metadata URIs — surfaced on the consent screen
// (packages/api/src/auth/consent-page.tsx reads `name`, `icon`, `tos`,
// `policy`, `uri` from the row). Users see these mid-OAuth-flow.
const CLAUDE_LOGO_URI = 'https://packratai.com/mcp-logo-256.png';
const CLAUDE_POLICY_URI = 'https://www.anthropic.com/legal/privacy';
const CLAUDE_TOS_URI = 'https://www.anthropic.com/legal/consumer-terms';
const CLAUDE_CLIENT_URI = 'https://claude.ai';

const CLAUDE_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'mcp',
  'mcp:read',
  'mcp:write',
];

// ── Script body ─────────────────────────────────────────────────────────────

async function seedClaudeOAuthClient(): Promise<void> {
  const dbUrl = nodeEnv.NEON_DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_DATABASE_URL is required');

  type SeedDatabase = NodePgDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
  let db: SeedDatabase;
  let pgClient: Client | undefined;

  if (isStandardPostgresUrl(dbUrl)) {
    pgClient = new Client({ connectionString: dbUrl });
    await pgClient.connect();
    db = drizzlePg(pgClient, { schema });
  } else {
    db = drizzle(neon(dbUrl), { schema });
  }

  try {
    // Idempotency check: drizzle-seed has no native upsert, so we gate the
    // seed() call on an explicit existence query keyed on the deterministic
    // `clientId`. Re-runs short-circuit cleanly without touching the DB.
    const existing = await db
      .select({ clientId: schema.oauthClient.clientId, name: schema.oauthClient.name })
      .from(schema.oauthClient)
      .where(eq(schema.oauthClient.clientId, CLAUDE_CLIENT_ID))
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `[seed] OAuth client "${CLAUDE_CLIENT_ID}" already exists (name="${existing[0]?.name ?? ''}"). Skipping.`,
      );
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date();

    // Every column is fixed via f.default() so drizzle-seed's per-column
    // random generator doesn't fire (the default behaviour for columns not
    // listed in .refine() is to generate a random value — wrong for a
    // deterministic config row).
    await seed(db, { oauthClient: schema.oauthClient }).refine((f) => ({
      oauthClient: {
        count: 1,
        columns: {
          id: f.default({ defaultValue: id }),
          clientId: f.default({ defaultValue: CLAUDE_CLIENT_ID }),
          clientSecret: f.default({ defaultValue: null }),
          name: f.default({ defaultValue: CLAUDE_CLIENT_NAME }),
          icon: f.default({ defaultValue: CLAUDE_LOGO_URI }),
          policy: f.default({ defaultValue: CLAUDE_POLICY_URI }),
          tos: f.default({ defaultValue: CLAUDE_TOS_URI }),
          uri: f.default({ defaultValue: CLAUDE_CLIENT_URI }),
          redirectUris: f.default({ defaultValue: CLAUDE_REDIRECT_URIS }),
          grantTypes: f.default({ defaultValue: ['authorization_code', 'refresh_token'] }),
          responseTypes: f.default({ defaultValue: ['code'] }),
          tokenEndpointAuthMethod: f.default({ defaultValue: 'none' }),
          scopes: f.default({ defaultValue: CLAUDE_SCOPES }),
          type: f.default({ defaultValue: 'web' }),
          public: f.default({ defaultValue: true }),
          requirePKCE: f.default({ defaultValue: true }),
          disabled: f.default({ defaultValue: false }),
          skipConsent: f.default({ defaultValue: false }),
          createdAt: f.default({ defaultValue: now }),
          updatedAt: f.default({ defaultValue: now }),
        },
      },
    }));

    console.log(`[seed] Registered OAuth client "${CLAUDE_CLIENT_ID}":`);
    console.log(`         name             = ${CLAUDE_CLIENT_NAME}`);
    console.log(`         redirect_uris    = ${JSON.stringify(CLAUDE_REDIRECT_URIS)}`);
    console.log(`         token_endpoint_auth_method = none (public client, PKCE required)`);
    console.log(`         scopes           = ${CLAUDE_SCOPES.join(' ')}`);
  } finally {
    await pgClient?.end();
  }
}

seedClaudeOAuthClient().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
