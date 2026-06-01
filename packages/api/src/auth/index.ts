/**
 * Better Auth configuration for the PackRat API Worker.
 *
 * getAuth(env) is called per-request so each isolate invocation picks up the
 * correct KV binding, credentials, and DB connection.  The result is cached
 * in a Map keyed by NEON_DATABASE_URL so the same instance is reused across
 * requests within the same isolate lifetime.
 */

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { oauthProvider } from '@better-auth/oauth-provider';
import { generateAppleClientSecret, verifyPasswordCompat } from '@packrat/api/auth/auth.helpers';
import { createConnection } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import * as schema from '@packrat/db';
import { isObject } from '@packrat/guards';
import { betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';

// ─── MCP OAuth scope catalog (advertised in scopes_supported) ───────────────
// `openid`, `profile`, `email`, `offline_access` are the OIDC standard scopes
// the plugin advertises by default; we include them explicitly so this list
// is the single source of truth for `scopes_supported` in discovery metadata.
// The `mcp` umbrella is back-compat with the legacy MCP scope; `mcp:read/write/admin`
// are the granular surface mapped to tool visibility in packages/mcp/src/scopes.ts.
const MCP_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'mcp',
  'mcp:read',
  'mcp:write',
  'mcp:admin',
] as const;

// RFC 8707 audience — JWT access tokens are bound to this `aud` claim.
// The MCP worker verifies tokens carry exactly this audience; any other
// `resource` parameter results in `invalid_request` (400) from the plugin's
// `checkResource` (validAudiences enforcement).
const MCP_AUDIENCE = 'https://mcp.packratai.com/mcp';

// ─── Per-isolate auth instance cache ─────────────────────────────────────────
// Stores the in-flight Promise so concurrent requests that arrive before the
// first initialization completes all await the same Promise rather than each
// kicking off a redundant build. Evicted on rejection so the next call retries.
// Keyed by NEON_DATABASE_URL|PACKRAT_API_URL — miniflare creates a new env
// object per request, so a WeakMap never hits; the URL composite key is stable
// within an isolate lifetime and distinguishes different env configurations.
// biome-ignore lint/suspicious/noExplicitAny: Better Auth's generic type parameter is too specific to the exact plugin set — can't use ReturnType<typeof betterAuth> here
const authCache = new Map<string, Promise<any>>();

// biome-ignore lint/suspicious/noExplicitAny: Better Auth instance type is plugin-specific and can't be expressed at declaration time without duplicating the full config signature
export async function getAuth(env: ValidatedEnv): Promise<any> {
  const cacheKey = `${env.NEON_DATABASE_URL}|${env.PACKRAT_API_URL}`;
  const cached = authCache.get(cacheKey);
  if (cached) return cached;

  const promise = buildAuth(env).catch((err) => {
    authCache.delete(cacheKey);
    throw err;
  });
  authCache.set(cacheKey, promise);
  return promise;
}

// biome-ignore lint/suspicious/noExplicitAny: Better Auth instance type is plugin-specific and can't be expressed at declaration time without duplicating the full config signature
async function buildAuth(env: ValidatedEnv): Promise<any> {
  const appleClientSecret = await generateAppleClientSecret(env);

  const db = createConnection({ url: env.NEON_DATABASE_URL, useNeonHttp: true });

  const auth = betterAuth({
    baseURL: env.PACKRAT_API_URL,
    secret: env.PACKRAT_AUTH_SECRET,

    advanced: {
      // All IDs are UUID-formatted text (matching the DB migration).
      generateId: () => crypto.randomUUID(),
      // Trust the X-Forwarded-For header added by Cloudflare.
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
      // Disable cross-site cookies so the Bearer plugin is the primary
      // session mechanism for mobile/API clients.
      crossSubDomainCookies: { enabled: false },
    },

    // Use KV as a fast secondary store for session lookups.
    secondaryStorage: env.AUTH_KV
      ? {
          get: async (key: string) => env.AUTH_KV.get(key),
          // biome-ignore lint/complexity/useMaxParams: Better Auth secondaryStorage.set interface requires 3 params
          set: async (key: string, value: string, ttl?: number) => {
            // KV requires a minimum expirationTtl of 60 seconds.
            await env.AUTH_KV.put(
              key,
              value,
              ttl !== undefined ? { expirationTtl: Math.max(60, ttl) } : undefined,
            );
          },
          delete: async (key: string) => env.AUTH_KV.delete(key),
        }
      : undefined,

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        jwks: schema.jwks,
        // OAuth provider (@better-auth/oauth-provider@1.6.x) tables.
        // The plugin auto-registers these models when present, gating its
        // discovery + token + consent endpoints on their availability.
        oauthClient: schema.oauthClient,
        oauthAccessToken: schema.oauthAccessToken,
        oauthRefreshToken: schema.oauthRefreshToken,
        oauthConsent: schema.oauthConsent,
      },
    }),

    // Map Better Auth's model field names to our column names.
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'USER' },
        firstName: { type: 'string', fieldName: 'first_name' },
        lastName: { type: 'string', fieldName: 'last_name' },
        avatarUrl: { type: 'string', fieldName: 'avatar_url' },
        passwordHash: { type: 'string', fieldName: 'password_hash' },
      },
    },

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      password: {
        verify: verifyPasswordCompat,
      },
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // Email sending is handled separately via the email service.
        // Log for now; wire up in the email integration task.
        console.log(`[auth] email verification for ${user.email}: ${url}`);
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
      },
      // Always register Apple when clientId is present so the native id-token
      // flow works even without a valid client-secret JWT (the id-token path
      // verifies against Apple's public JWKS; the secret is only used for the
      // web OAuth redirect flow).
      // audience covers all EAS build variants — Apple puts the bundle ID in
      // the `aud` claim, which differs per variant (.dev, .preview, base).
      ...(env.APPLE_CLIENT_ID
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: appleClientSecret ?? 'native-id-token-only',
              appBundleIdentifier: env.APPLE_CLIENT_ID,
              audience: [
                env.APPLE_CLIENT_ID,
                `${env.APPLE_CLIENT_ID}.dev`,
                `${env.APPLE_CLIENT_ID}.preview`,
              ],
            },
          }
        : {}),
    },

    plugins: [
      // Bearer: converts Authorization: Bearer <token> into a session cookie
      // transparently so existing mobile/API clients keep working.
      bearer(),

      // JWT: issues asymmetric JWTs and exposes a JWKS endpoint at
      // /api/auth/jwks for downstream service verification. The OAuth provider
      // plugin reads this plugin's signer to mint JWT access tokens when a
      // client sends `resource` (RFC 8707) — so this config also gates MCP.
      //
      // Private key encryption is disabled — it causes decrypt failures when
      // PACKRAT_AUTH_SECRET rotates or differs across environments.
      //
      // The adapter.getJwks filter skips any rows that were stored in the old
      // encrypted format (where JSON.parse(privateKey) returns a string rather
      // than a JWK object). Better Auth creates a fresh plaintext key when the
      // filtered list is empty, resolving the "JWK must be an object" error that
      // occurs after switching from encrypted to plaintext storage.
      jwt({
        jwks: { disablePrivateKeyEncryption: true },
        adapter: {
          // biome-ignore lint/suspicious/noExplicitAny: Better Auth ctx/key/jwks generics are not expressible here
          getJwks: async (ctx: any) => {
            // biome-ignore lint/suspicious/noExplicitAny: jwks row type from Better Auth is not exported
            const keys: any[] = (await ctx.context.adapter.findMany({ model: 'jwks' })) ?? [];
            // biome-ignore lint/suspicious/noExplicitAny: jwks row type from Better Auth is not exported
            return keys.filter((key: any) => {
              try {
                return isObject(JSON.parse(key.privateKey));
              } catch {
                return false;
              }
            });
          },
        },
      }),

      // Admin: role-based user management endpoints.
      admin(),

      // Expo: promotes the expo-origin header → Origin so the CSRF check
      // passes for requests from the native app (which can't send a browser
      // Origin header).
      expo(),

      // OAuth 2.1 Authorization Server for the MCP worker.
      //
      // Configuration rationale (cross-reference: spike findings in
      // docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md):
      //  - `scopes`: declares the MCP scope catalog; advertised under
      //    `scopes_supported` in the AS metadata.
      //  - `validAudiences`: RFC 8707 — `/oauth2/authorize` rejects any
      //    `resource` parameter not in this list with 400 invalid_request.
      //  - `allowDynamicClientRegistration: false` + Claude pre-registered
      //    via packages/api/src/db/seed-claude-oauth-client.ts — DCR is
      //    closed because we know our connector clients ahead of time.
      //  - `consentPage`: points at `/oauth/consent` (mounted in the worker
      //    fetch handler in src/index.ts). The consent page server-side
      //    filters `mcp:admin` from non-admin grants and POSTs the reduced
      //    scope to `/oauth2/consent` — the plugin's native scope-reduction
      //    mechanism (customAccessTokenClaims CANNOT reduce scope; see
      //    spike §Q1-Q2).
      //  - `loginPage`: '/api/auth/sign-in' is a static placeholder URL the
      //    plugin redirects to for `prompt=login`. PackRat clients (Claude)
      //    rely on the user being already signed in via Better Auth's web
      //    auth flow before initiating OAuth; this URL is set so the plugin
      //    doesn't throw on missing config — the actual sign-in surface is
      //    the existing Better Auth endpoints, not a custom page.
      //  - `disableJwtPlugin` is intentionally unset: JWT access tokens are
      //    the default — but ONLY issued when the client sends a `resource`
      //    parameter (`isJwtAccessToken = audience && !opts.disableJwtPlugin`,
      //    spike §Q4). Claude.ai sends `resource` per the MCP 2025-11-25
      //    spec. Verified in U9 dev verification.
      oauthProvider({
        scopes: [...MCP_OAUTH_SCOPES],
        validAudiences: [MCP_AUDIENCE],
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        consentPage: '/oauth/consent',
        loginPage: '/api/auth/sign-in',
      }),
    ],

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'secondary-storage',
    },

    // NOTE: keep in lockstep with `auth.config.ts` (the CLI-facing static
    // config). The two lists drift independently — see
    // `docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md`
    // and `docs/mcp/runbook.md` § "Better Auth trustedOrigins".
    //
    // `https://mcp.packratai.com` was removed in U1 of the OAuth provider
    // consolidation refactor (docs/plans/2026-05-25-001-...). The MCP worker
    // no longer calls Better Auth sign-in endpoints directly — the OAuth flow
    // lives entirely on api.packrat.world via the oauthProvider plugin above.
    // Keeping it in trustedOrigins would expand the CORS/CSRF bypass surface
    // for no behavioral reason.
    //
    // localhost is trusted only in development (e.g. the Playwright e2e harness
    // serves the static export on a separate port) — never in production.
    trustedOrigins: [
      env.PACKRAT_API_URL,
      'packrat://',
      ...(env.ENVIRONMENT === 'development' ? ['http://localhost:*'] : []),
    ],
  });

  return auth;
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type Session = Auth['$Infer']['Session'];
