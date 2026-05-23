/**
 * Better Auth configuration for the PackRat API Worker.
 *
 * getAuth(env) is called per-request so each isolate invocation picks up the
 * correct KV binding, credentials, and DB connection.  The result is cached
 * in a WeakMap keyed by the raw env object so the instance is reused across
 * requests within the same isolate lifetime.
 */

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { neon } from '@neondatabase/serverless';
import { generateAppleClientSecret, verifyPasswordCompat } from '@packrat/api/auth/auth.helpers';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import * as schema from '@packrat/db';
import { betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/neon-http';

// ─── Per-isolate auth instance cache ─────────────────────────────────────────
// biome-ignore lint/suspicious/noExplicitAny: Better Auth's generic type parameter is too specific to the exact plugin set — can't use ReturnType<typeof betterAuth> here
const authCache = new WeakMap<object, any>();

// biome-ignore lint/suspicious/noExplicitAny: Better Auth instance type is plugin-specific and can't be expressed at declaration time without duplicating the full config signature
export async function getAuth(env: ValidatedEnv): Promise<any> {
  const cached = authCache.get(env as object);
  if (cached) return cached;

  const appleClientSecret = await generateAppleClientSecret(env);

  // Use the HTTP Neon driver — no long-lived connections inside a Worker.
  const db = drizzle(neon(env.NEON_DATABASE_URL), { schema });

  const auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

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
            await env.AUTH_KV.put(
              key,
              value,
              ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined,
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
      // /api/auth/jwks for downstream service verification.
      jwt(),

      // Admin: role-based user management endpoints.
      admin(),

      // Expo: promotes the expo-origin header → Origin so the CSRF check
      // passes for requests from the native app (which can't send a browser
      // Origin header).
      expo(),
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
    // `https://mcp.packratai.com` is the PackRat MCP Worker — sign-in calls
    // originate from there during the OAuth flow.
    trustedOrigins: [env.BETTER_AUTH_URL, 'packrat://', 'https://mcp.packratai.com'],
  });

  authCache.set(env as object, auth);
  return auth;
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type Session = Auth['$Infer']['Session'];
