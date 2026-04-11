import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { and, eq } from 'drizzle-orm';

type CtxLike = { env?: Record<string, unknown> } | undefined;

export class PackItemService {
  private db;
  private userId: number;

  constructor(cOrUserId: CtxLike | number, maybeUserId?: number) {
    let c: CtxLike;
    if (typeof cOrUserId === 'number') {
      this.userId = cOrUserId;
      c = undefined;
    } else {
      c = cOrUserId;
      this.userId = maybeUserId ?? 0;
    }
    this.db = createDb(c);
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

    if (!item) {
      return null;
    }

    return item;
  }
}
