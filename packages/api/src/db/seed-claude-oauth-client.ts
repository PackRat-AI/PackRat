/**
 * One-shot seed script: pre-register Claude as an OAuth client in the
 * @better-auth/oauth-provider `oauthClient` table.
 *
 * Background: the plugin doesn't have a `trustedClients` config option
 * (spike-verified — see docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md
 * §Q7). Pre-registration is via DB seed. Dynamic client registration is
 * intentionally disabled (`allowDynamicClientRegistration: false` in
 * src/auth/index.ts), so this script is the only way Claude can be registered.
 *
 * Idempotent: re-running the script with an existing client_id is a no-op
 * (logs and exits cleanly). The CLIENT_ID is hardcoded so re-runs target the
 * same row deterministically.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> bun run packages/api/src/db/seed-claude-oauth-client.ts
 *
 * Or via the package script (also wired into CI's post-deploy step):
 *   cd packages/api && bun run db:seed:oauth-clients
 *
 * Operator runs this ONCE per environment (prod, dev) after deploying the API
 * with the oauthProvider plugin enabled. Re-runs are safe.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { eq } from 'drizzle-orm';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
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
// (packages/api/src/auth/consent-page.ts reads `name`, `icon`, `tos`,
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

async function seedClaudeOAuthClient() {
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

    const now = new Date();
    await db.insert(schema.oauthClient).values({
      id: crypto.randomUUID(),
      clientId: CLAUDE_CLIENT_ID,
      clientSecret: null,
      name: CLAUDE_CLIENT_NAME,
      icon: CLAUDE_LOGO_URI,
      policy: CLAUDE_POLICY_URI,
      tos: CLAUDE_TOS_URI,
      uri: CLAUDE_CLIENT_URI,
      redirectUris: CLAUDE_REDIRECT_URIS,
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scopes: CLAUDE_SCOPES,
      type: 'web',
      public: true,
      requirePKCE: true,
      disabled: false,
      skipConsent: false,
      createdAt: now,
      updatedAt: now,
    });

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
