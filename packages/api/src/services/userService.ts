import { createDb } from '@packrat/api/db';
import { type User, users } from '@packrat/api/db/schema';
import { hashPassword } from '@packrat/api/utils/auth';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';

export type CreateUserInput = {
  email: string;
  password?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: 'USER' | 'ADMIN';
  emailVerified?: boolean;
};

export class UserService {
  private db;

  constructor(c: Context) {
    this.db = createDb(c);
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = input.password ? await hashPassword(input.password) : null;

    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        role: input.role ?? 'USER',
        emailVerified: input.emailVerified ?? false,
      })
      .returning();

    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }
}
