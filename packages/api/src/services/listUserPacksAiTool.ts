import { createDb } from '@packrat/api/db';
import { packs } from '@packrat/db/schema';
import { and, eq, ilike } from 'drizzle-orm';

// Cap on rows returned to the model. Pack lists are small, but an unbounded
// list would still be unbounded LLM context.
const MAX_PACKS = 50;

interface Params {
  userId: string;
  nameQuery?: string | undefined;
}

export async function listUserPacksAiTool(params: Params) {
  const { userId, nameQuery } = params;
  const db = createDb();

  const scope = nameQuery
    ? and(eq(packs.userId, userId), eq(packs.deleted, false), ilike(packs.name, `%${nameQuery}%`))
    : and(eq(packs.userId, userId), eq(packs.deleted, false));

  return await db
    .tag('aiTool.listUserPacks')
    .select({
      id: packs.id,
      name: packs.name,
      category: packs.category,
      description: packs.description,
    })
    .from(packs)
    .where(scope)
    .limit(MAX_PACKS);
}
