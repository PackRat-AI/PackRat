import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/db';
import { and, eq } from 'drizzle-orm';

export class PackItemService {
  private db;
  private userId: string;

  constructor(userId: string) {
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
