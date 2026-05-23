/**
 * Idempotent upsert of the E2E test user.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     bun run packages/api/src/db/seed-e2e-user.ts
 *
 * Re-running is safe: if the user exists, the password hash and
 * `emailVerified=true` flag are refreshed; otherwise the user is created.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { nodeEnv } from '@packrat/env/node';
import { and, eq } from 'drizzle-orm';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import WebSocket from 'ws';
import { hashPassword } from '../utils/auth';
import * as schema from './schema';

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

async function seedE2EUser() {
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
      userId = existingUser.id;
      await db
        .update(schema.users)
        .set({ passwordHash, emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      console.log(`E2E user refreshed: ${normalizedEmail} (id=${userId})`);
    } else {
      const [inserted] = await db
        .insert(schema.users)
        .values({
          id: crypto.randomUUID(),
          name: 'E2E Automation',
          email: normalizedEmail,
          passwordHash,
          emailVerified: true,
          firstName: 'E2E',
          lastName: 'Automation',
          role: 'USER',
        })
        .returning();
      if (!inserted) throw new Error('users insert returned no row');
      userId = inserted.id;
      console.log(`E2E user created: ${normalizedEmail} (id=${userId})`);
    }

    // Better Auth's email/password sign-in reads the password from the
    // `account` table (providerId='credential'), not `users.password_hash`.
    // The 0042 data-migration only copies users → account at migrate time, so
    // any user created after that migration (this seed, fresh dev DBs) needs
    // an explicit credential row to be sign-in-able.
    const existingAccount = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'credential')))
      .limit(1);

    if (existingAccount[0]) {
      await db
        .update(schema.account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(schema.account.id, existingAccount[0].id));
      console.log(`Credential account refreshed for ${normalizedEmail}`);
    } else {
      await db.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      });
      console.log(`Credential account created for ${normalizedEmail}`);
    }
  } finally {
    await pgClient?.end();
  }
}

seedE2EUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
