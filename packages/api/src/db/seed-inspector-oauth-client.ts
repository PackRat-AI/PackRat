/**
 * Seed: pre-register the MCP Inspector as an OAuth client for LOCAL testing.
 *
 * DCR is disabled at the AS (`allowDynamicClientRegistration: false`), so the
 * MCP Inspector — which would normally dynamically register itself — needs a
 * pre-seeded public client row to drive the full OAuth browser flow against a
 * local API. This script is the local-dev analogue of seed-claude-oauth-client.ts.
 *
 * NOT for production. The redirect URIs point at Inspector's localhost proxy.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> bun run packages/api/src/db/seed-inspector-oauth-client.ts
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

const INSPECTOR_CLIENT_ID = 'mcp-inspector-local';
const INSPECTOR_CLIENT_NAME = 'MCP Inspector (local)';
// Inspector's localhost proxy callback URLs (default port 6274, both hosts +
// the Auth Debugger variant).
const INSPECTOR_REDIRECT_URIS = [
  'http://localhost:6274/oauth/callback',
  'http://127.0.0.1:6274/oauth/callback',
  'http://localhost:6274/oauth/callback/debug',
  'http://127.0.0.1:6274/oauth/callback/debug',
];
const INSPECTOR_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'mcp:read',
  'mcp:write',
  'mcp:admin',
];

const row = (now: Date) => ({
  clientId: INSPECTOR_CLIENT_ID,
  clientSecret: null,
  name: INSPECTOR_CLIENT_NAME,
  icon: 'https://packratai.com/mcp-logo-256.png',
  policy: 'https://packratai.com/privacy-policy',
  tos: 'https://packratai.com/terms-of-service',
  uri: 'http://localhost:6274',
  redirectUris: INSPECTOR_REDIRECT_URIS,
  grantTypes: ['authorization_code', 'refresh_token'],
  responseTypes: ['code'],
  tokenEndpointAuthMethod: 'none' as const,
  scopes: INSPECTOR_SCOPES,
  type: 'web' as const,
  public: true,
  requirePKCE: true,
  disabled: false,
  skipConsent: false,
  updatedAt: now,
});

async function seedInspectorClient(): Promise<void> {
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
    const now = new Date();
    const existing = await db
      .select({ clientId: schema.oauthClient.clientId })
      .from(schema.oauthClient)
      .where(eq(schema.oauthClient.clientId, INSPECTOR_CLIENT_ID))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.oauthClient)
        .set(row(now))
        .where(eq(schema.oauthClient.clientId, INSPECTOR_CLIENT_ID));
      console.log(`[seed] Updated OAuth client "${INSPECTOR_CLIENT_ID}".`);
    } else {
      await db
        .insert(schema.oauthClient)
        .values({ id: crypto.randomUUID(), createdAt: now, ...row(now) });
      console.log(`[seed] Registered OAuth client "${INSPECTOR_CLIENT_ID}".`);
    }
    console.log(`         client_id     = ${INSPECTOR_CLIENT_ID}`);
    console.log(`         redirect_uris = ${INSPECTOR_REDIRECT_URIS.join(', ')}`);
    console.log(`         scopes        = ${INSPECTOR_SCOPES.join(' ')}`);
    console.log(`         auth_method   = none (public client, PKCE required)`);
  } finally {
    await pgClient?.end();
  }
}

seedInspectorClient().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
