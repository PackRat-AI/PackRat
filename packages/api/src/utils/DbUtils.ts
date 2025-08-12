import { createDb } from '@packrat/api/db';
import { catalogItems, packs } from '@packrat/api/db/schema';
import { and, arrayOverlaps, eq, inArray, type SQL } from 'drizzle-orm';
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

  const filters: SQL[] = [];

  // For categories, use Drizzle's arrayOverlaps operator for JSONB arrays
  if (options?.categories?.length) {
    filters.push(arrayOverlaps(catalogItems.categories, options.categories));
  }

  // For IDs, we can use the standard inArray
  if (options?.ids?.length) {
    filters.push(inArray(catalogItems.id, options.ids));
  }

  const query = db
    .select()
    .from(catalogItems)
    .where(filters.length > 0 ? and(...filters) : undefined);

  if (options?.limit) {
    return query.limit(options.limit);
  }

  return query;
}
