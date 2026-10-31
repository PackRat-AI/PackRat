import type { createDb } from '@packrat/api/db';
import { users } from '@packrat/db/schema';
import { inArray } from 'drizzle-orm';

type Db = ReturnType<typeof createDb>;

const WHITESPACE = /\s+/;

/** The name a report is signed with: first name only, enough for "Sam, 2 days ago". */
export function firstNameOf(user: { firstName: string | null; name: string }): string | null {
  return user.firstName?.trim() || user.name.trim().split(WHITESPACE)[0] || null;
}

/** First names of the given users, by id. Users not found are absent. */
export async function reportAuthorNames({
  db,
  userIds,
}: {
  db: Db;
  userIds: readonly string[];
}): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const authors = await db
    .tag('trailConditions.authors')
    .select({ id: users.id, firstName: users.firstName, name: users.name })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(authors.map((a) => [a.id, firstNameOf(a)]));
}
