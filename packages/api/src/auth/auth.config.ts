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
import { betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(neon('postgresql://stub:stub@stub/stub'), { schema });

export const auth = betterAuth({
  baseURL: 'http://localhost:8787',
  secret: 'cli-stub-secret',

  advanced: {
    generateId: () => crypto.randomUUID(),
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

  plugins: [bearer(), jwt({ jwks: { disablePrivateKeyEncryption: true } }), admin()],

  trustedOrigins: ['http://localhost:8787', 'packrat://'],
});
