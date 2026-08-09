/**
 * Idempotent upsert of the E2E test user.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     bun run packages/api/src/db/seed-e2e-user.ts
 *
 * Re-running is safe: if the user exists, the password hash and
 * `emailVerified=true` flag are refreshed via `db.update`; otherwise the
 * user is created via a direct insert so this script avoids package-export
 * differences in local E2E runtimes.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { eq } from 'drizzle-orm';
import { type BunSQLDatabase, drizzle as drizzleBunSQL } from 'drizzle-orm/bun-sql';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
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

  type SeedDatabase = BunSQLDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
  let db: SeedDatabase;
  let sql: Bun.SQL | undefined;

  if (isStandardPostgresUrl(dbUrl)) {
    sql = new Bun.SQL(dbUrl);
    db = drizzleBunSQL(sql, { schema });
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

    const existingUser = existing[0];
    let userId = existingUser?.id;

    if (existingUser) {
      // drizzle-seed has no UPDATE primitive; use db.update for the
      // password-refresh path. Insert path below uses drizzle-seed.
      await db
        .update(schema.users)
        .set({ passwordHash, emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.users.id, existingUser.id));
      console.log(`E2E user refreshed: ${normalizedEmail} (id=${existingUser.id})`);
    } else {
      userId = crypto.randomUUID();
      const now = new Date();
      await db.insert(schema.users).values({
        id: userId,
        name: 'E2E Automation',
        email: normalizedEmail,
        emailVerified: true,
        role: 'USER',
        banned: false,
        firstName: 'E2E',
        lastName: 'Automation',
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`E2E user created: ${normalizedEmail} (id=${userId})`);
    }

    if (!userId) throw new Error(`Failed to resolve E2E user id for ${normalizedEmail}`);

    // Upsert the credential account row that better-auth looks up during sign-in.
    // better-auth sets accountId = user.id for the 'credential' provider.
    await db
      .insert(schema.account)
      .values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      })
      .onConflictDoUpdate({
        target: [schema.account.providerId, schema.account.accountId],
        set: {
          userId,
          password: passwordHash,
          updatedAt: new Date(),
        },
      });
    console.log(`E2E credential account refreshed: ${normalizedEmail}`);

    await db
      .insert(schema.catalogItems)
      .values([
        {
          name: 'E2E Ultralight Headlamp',
          productUrl: 'https://packrattest.local/catalog/e2e-headlamp',
          sku: 'e2e-headlamp',
          weight: 85,
          weightUnit: 'g',
          description: 'Stable catalog fixture for Maestro add-from-catalog flows.',
          categories: ['Hiking', 'Lighting'],
          images: [],
          brand: 'PackRat Test',
          model: 'Headlamp',
          price: 29.99,
          currency: 'USD',
          availability: 'in_stock',
          seller: 'PackRat Test',
        },
        {
          name: 'E2E Titanium Mug',
          productUrl: 'https://packrattest.local/catalog/e2e-mug',
          sku: 'e2e-mug',
          weight: 110,
          weightUnit: 'g',
          description: 'Stable catalog fixture for Maestro catalog browsing flows.',
          categories: ['Hiking', 'Cookware'],
          images: [],
          brand: 'PackRat Test',
          model: 'Mug',
          price: 24.99,
          currency: 'USD',
          availability: 'in_stock',
          seller: 'PackRat Test',
        },
        {
          name: 'E2E Rain Shell',
          productUrl: 'https://packrattest.local/catalog/e2e-rain-shell',
          sku: 'e2e-rain-shell',
          weight: 210,
          weightUnit: 'g',
          description: 'Stable catalog fixture for Maestro search and selection flows.',
          categories: ['Hiking', 'Clothing'],
          images: [],
          brand: 'PackRat Test',
          model: 'Rain Shell',
          price: 99.99,
          currency: 'USD',
          availability: 'in_stock',
          seller: 'PackRat Test',
        },
      ])
      .onConflictDoNothing({ target: schema.catalogItems.sku });
    console.log('E2E catalog fixtures ensured');
  } finally {
    await sql?.close();
  }
}

seedE2EUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
