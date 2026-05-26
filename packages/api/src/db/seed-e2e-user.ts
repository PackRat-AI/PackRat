/**
 * Idempotent upsert of the E2E test user.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     bun run packages/api/src/db/seed-e2e-user.ts
 *
 * Re-running is safe: if the user exists, the password hash and
 * `emailVerified=true` flag are refreshed via `db.update` (drizzle-seed
 * has no UPDATE primitive); otherwise the user is created via the
 * `drizzle-seed` `.refine()` API so this seeder shares the same tool
 * surface as the other prod-config seeders. Every column is fixed via
 * `f.default()` because drizzle-seed generates a random value for any
 * column not listed in `.refine()`.
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
import { hashPassword } from '../utils/auth';

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

async function seedE2EUser(): Promise<void> {
  const dbUrl = nodeEnv.NEON_DATABASE_URL;
  const email = nodeEnv.E2E_TEST_EMAIL;
  const password = nodeEnv.E2E_TEST_PASSWORD;

  if (!dbUrl) throw new Error('NEON_DATABASE_URL is required');
  if (!email) throw new Error('E2E_TEST_EMAIL is required');
  if (!password) throw new Error('E2E_TEST_PASSWORD is required');

  const normalizedEmail = email.toLowerCase();

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
    const passwordHash = await hashPassword(password);
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    let userId: string;
    const existingUser = existing[0];
    if (existingUser) {
      // drizzle-seed has no UPDATE primitive; use db.update for the
      // password-refresh path. Insert path below uses drizzle-seed.
      userId = existingUser.id;
      await db
        .update(schema.users)
        .set({ passwordHash, emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      console.log(`E2E user refreshed: ${normalizedEmail} (id=${userId})`);
    } else {
      userId = crypto.randomUUID();
      const now = new Date();
      await seed(db, { users: schema.users }).refine((f) => ({
        users: {
          count: 1,
          columns: {
            id: f.default({ defaultValue: userId }),
            name: f.default({ defaultValue: 'E2E Automation' }),
            email: f.default({ defaultValue: normalizedEmail }),
            emailVerified: f.default({ defaultValue: true }),
            image: f.default({ defaultValue: null }),
            role: f.default({ defaultValue: 'USER' }),
            banned: f.default({ defaultValue: false }),
            banReason: f.default({ defaultValue: null }),
            banExpires: f.default({ defaultValue: null }),
            firstName: f.default({ defaultValue: 'E2E' }),
            lastName: f.default({ defaultValue: 'Automation' }),
            avatarUrl: f.default({ defaultValue: null }),
            passwordHash: f.default({ defaultValue: passwordHash }),
            createdAt: f.default({ defaultValue: now }),
            updatedAt: f.default({ defaultValue: now }),
          },
        },
      }));
      console.log(`E2E user created: ${normalizedEmail} (id=${userId})`);
    }

    // Upsert the credential account row that better-auth looks up during sign-in.
    // better-auth sets accountId = email for the 'credential' provider.
    // (drizzle-seed has no upsert; this requires onConflictDoUpdate so we use
    // db.insert directly here rather than drizzle-seed's refine path.)
    await db
      .insert(schema.account)
      .values({
        id: crypto.randomUUID(),
        accountId: normalizedEmail,
        providerId: 'credential',
        userId,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.account.providerId, schema.account.accountId],
        set: { userId, password: passwordHash, updatedAt: new Date() },
      });
    console.log(`E2E credential account upserted for: ${normalizedEmail}`);
  } finally {
    await pgClient?.end();
  }
}

seedE2EUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
