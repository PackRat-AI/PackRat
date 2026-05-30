import { createDb } from '@packrat/api/db';
import { hashPassword } from '@packrat/api/utils/auth';
import { type User, users } from '@packrat/db';
import { eq } from 'drizzle-orm';

export type CreateUserInput = {
  email: string;
  password?: string;
  /** Better Auth display name. Derived from first/last name (or the email
   *  local-part) when not supplied — the `users.name` column is NOT NULL. */
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: 'USER' | 'ADMIN';
  emailVerified?: boolean;
};

export class UserService {
  private db;

  constructor() {
    this.db = createDb();
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
    // `users.name` is NOT NULL (Better Auth display name). Prefer an explicit
    // name, else build one from first/last, else fall back to the email local-part.
    const name =
      input.name?.trim() ||
      [input.firstName, input.lastName].filter(Boolean).join(' ').trim() ||
      (input.email.split('@')[0] ?? input.email);

    const [user] = await this.db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: input.email.toLowerCase(),
        name,
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
