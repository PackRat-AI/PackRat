import type { Context } from 'hono';
import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { and, eq } from 'drizzle-orm';

export class PackItemService {
  private db;
  private userId: number;

  constructor(c: Context, userId: number) {
    this.db = createDb(c);
    this.userId = userId;
  }

  async getPackItemDetails(itemId: string) {
    const item = await this.db.query.packItems.findFirst({
      where: and(
        eq(packItems.id, itemId),
        eq(packItems.userId, this.userId),
        eq(packItems.deleted, false)
      ),
      with: {
        pack: true,
        catalogItem: true,
      },
    });

    if (!item) {
      return null;
    }

    return item;
  }
}
