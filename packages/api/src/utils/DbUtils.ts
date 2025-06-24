import { createDb } from "@/db";
import { catalogItems, packItems, packs, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Context } from "hono";

// Get pack details from the database
export async function getPackDetails({
  packId,
  c,
}: {
  packId: string;
  c: Context;
}) {
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

// Get item details from the database
export async function getItemDetails({
  itemId,
  c,
}: {
  itemId: string;
  c: Context;
}) {
  const db = createDb(c);

  // First try to find it as a pack item
  const packItem = await db.query.packItems.findFirst({
    where: eq(packItems.id, itemId),
    with: {
      catalogItem: true,
    },
  });

  if (packItem) return packItem;

  // If not found, try to find it as a catalog item
  const catalogItem = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, Number.parseInt(itemId)),
  });

  return catalogItem;
}

// Get user details
export async function getUserDetails({
  userId,
  c,
}: {
  userId: string;
  c: Context;
}) {
  const db = createDb(c);
  return db.query.users.findFirst({
    where: eq(users.id, Number.parseInt(userId)),
  });
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
