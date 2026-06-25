/**
 * Static auth config for the Better Auth CLI (`bunx auth generate`).
 *
 * The real auth instance is created per-request in index.ts because it needs
 * a live Cloudflare Worker env object.  The CLI cannot call that factory, so
 * this file exports a static instance with stub values — enough for the CLI to
 * read the schema and generate migrations without a real DB connection.
 *
 * Usage:
 *   bunx auth generate --config src/auth/auth.config.ts
 */

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/db';
import { type BetterAuthPlugin, betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(neon('postgresql://stub:stub@stub/stub'), { schema });

export const auth = betterAuth({
  baseURL: 'http://localhost:8787',
  secret: 'cli-stub-secret',

  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
    },
    crossSubDomainCookies: { enabled: false },
  },

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // Keep in sync with auth/index.ts. No snake_case fieldName — the Drizzle adapter
  // keys rows by camelCase property names, so a fieldName mismatch drops the field
  // from every auth response.
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'USER' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      avatarUrl: { type: 'string' },
      passwordHash: { type: 'string', input: false, returned: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },

  emailVerification: {
    sendVerificationEmail: async () => {},
  },

  socialProviders: {
    google: {
      clientId: 'stub',
      clientSecret: 'stub',
    },
  },

  plugins: [
    bearer(),
    jwt({ jwks: { disablePrivateKeyEncryption: true } }),
    // safe-cast: Better Auth 1.6.13's admin plugin return type is narrower than BetterAuthPlugin.
    admin() as unknown as BetterAuthPlugin,
  ],

  trustedOrigins: ['http://localhost:8787', 'packrat://'],
});
