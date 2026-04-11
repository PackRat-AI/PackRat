import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { and, eq } from 'drizzle-orm';

export class PackItemService {
  private db;
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
    this.db = createDb();
  }

  async getPackItemDetails(itemId: string) {
    const item = await this.db.query.packItems.findFirst({
      where: and(
        eq(packItems.id, itemId),
        eq(packItems.userId, this.userId),
        eq(packItems.deleted, false),
      ),
      with: {
        pack: true,
        catalogItem: true,
      },
    });

    return item ?? null;
  }
}
