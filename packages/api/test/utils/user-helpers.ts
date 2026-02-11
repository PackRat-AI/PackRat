import { createDb } from '@packrat/api/db';
import { users } from '@packrat/api/db/schema';
import { hashPassword } from '@packrat/api/utils/auth';
import type { InferInsertModel } from 'drizzle-orm';
import type { Context } from 'hono';

/**
 * Creates a test user in the database.
 * @param overrides - User data overrides.
 * @returns The created user.
 */
export async function createTestUser(
  overrides: Partial<InferInsertModel<typeof users>> & { password?: string } = {},
) {
  const db = createDb({} as unknown as Context);

  const { password = 'Password123!', ...userData } = overrides;

  const passwordHash = await hashPassword(password);

  const finalUserData: InferInsertModel<typeof users> = {
    email: `test-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    ...userData,
    passwordHash,
  };

  const [user] = await db.insert(users).values(finalUserData).returning();

  if (!user) {
    throw new Error('Failed to create test user');
  }

  return { ...user, password };
}
