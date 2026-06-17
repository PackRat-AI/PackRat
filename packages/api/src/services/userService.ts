import { createDb } from '@packrat/api/db';
import { hashPassword } from '@packrat/api/utils/auth';
import { type User, users } from '@packrat/db';
import { eq } from 'drizzle-orm';

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

  constructor() {
    this.db = createDb();
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .tag('user.findByEmail')
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = input.password ? await hashPassword(input.password) : null;

    // Better Auth's users schema requires a non-null `name`; derive from first/
    // last, fall back to email. Per-package tsc surfaces this as a missing-field
    // error against the Drizzle insert type — root tsc misses it but Postgres
    // would reject the insert at runtime.
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
    const [user] = await this.db
      .tag('user.create')
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: input.email.toLowerCase(),
        name: fullName || input.email.toLowerCase(),
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
