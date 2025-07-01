import { createDb } from '@packrat/api/db';
import { catalogItems, packItems, packs, users } from '@packrat/api/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { Context } from 'hono';

// Get pack details from the database
export async function getPackDetails({ packId, c }: { packId: string; c: Context }) {
  const db = createDb(c);

  const packData = await db.query.packs.findFirst({
    where: eq(packs.id, packId),
    with: {
      items: {
        with: {
          catalogItem: true,
        },
      },
      user: true,
    },
  });

  return packData;
}

// Get catalog items from the database
export async function getCatalogItems({
  options,
  c,
}: {
  options?: {
    categories?: string[];
    ids?: number[];
    limit?: number;
  };
  c: Context;
}) {
  const db = createDb(c);
  let query = db.select().from(catalogItems);

  if (options?.categories?.length) {
    query = query.where(inArray(catalogItems.category, options.categories));
  }

  if (options?.ids?.length) {
    query = query.where(inArray(catalogItems.id, options.ids));
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return query;
}
