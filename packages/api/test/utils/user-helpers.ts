import { createDb } from '@packrat/api/db';
import { hashPassword } from '@packrat/api/utils/auth';
import { users } from '@packrat/db';
import type { InferInsertModel } from 'drizzle-orm';

/**
 * Creates a test user in the database.
 * @param overrides - User data overrides.
 * @returns The created user.
 */
export async function createTestUser(
  overrides: Partial<InferInsertModel<typeof users>> & { password?: string } = {},
) {
  const db = createDb();

  const { password = 'Password123!', id: overrideId, ...userData } = overrides;

  const passwordHash = await hashPassword(password);

  const finalUserData: InferInsertModel<typeof users> = {
    id: overrideId ?? crypto.randomUUID(),
    name: 'Test User',
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
