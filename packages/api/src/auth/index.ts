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
import { generateAppleClientSecret, verifyPasswordCompat } from '@packrat/api/auth/auth.helpers';
import { createConnection } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import * as schema from '@packrat/db';
import { isObject } from '@packrat/guards';
import { safeJsonParse } from '@packrat/utils';
import { betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';

// ─── Per-isolate auth instance cache ─────────────────────────────────────────
// Stores the in-flight Promise so concurrent requests that arrive before the
// first initialization completes all await the same Promise rather than each
// kicking off a redundant build. Evicted on rejection so the next call retries.
// Keyed by NEON_DATABASE_URL|BETTER_AUTH_URL — miniflare creates a new env
// object per request, so a WeakMap never hits; the URL composite key is stable
// within an isolate lifetime and distinguishes different env configurations.
// biome-ignore lint/suspicious/noExplicitAny: Better Auth's generic type parameter is too specific to the exact plugin set — can't use ReturnType<typeof betterAuth> here
const authCache = new Map<string, Promise<any>>();

// biome-ignore lint/suspicious/noExplicitAny: Better Auth instance type is plugin-specific and can't be expressed at declaration time without duplicating the full config signature
export async function getAuth(env: ValidatedEnv): Promise<any> {
  const cacheKey = `${env.NEON_DATABASE_URL}|${env.BETTER_AUTH_URL}`;
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
      // Private key encryption is disabled — it causes decrypt failures when
      // BETTER_AUTH_SECRET rotates or differs across environments.
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
                return isObject(safeJsonParse(key.privateKey, { strict: true }));
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
    ],

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'secondary-storage',
    },

    // The web app is served from a different origin than the API (e.g. the
    // Playwright e2e harness serves the static export on a separate port), so
    // its origin must be trusted for the cross-origin CSRF/CORS check. Only
    // trust localhost in development — never in production.
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      'packrat://',
      ...(env.ENVIRONMENT === 'development' ? ['http://localhost:*'] : []),
    ],
  });

  return auth;
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type Session = Auth['$Infer']['Session'];
