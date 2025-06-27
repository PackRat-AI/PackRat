import { createDb } from '@packrat/api/db';
import { packs, packItems, type PackWithItems } from '@packrat/api/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Context } from 'hono';
import { computePackWeights } from '../utils/compute-pack';

export class PackService {
  private db;
  private userId: number;

  constructor(c: Context, userId: number) {
    this.db = createDb(c);
    this.userId = userId;
  }

  async getPackDetails(packId: string): Promise<PackWithItems | null> {
    const pack = await this.db.query.packs.findFirst({
      where: and(
        eq(packs.id, packId),
        eq(packs.userId, this.userId),
        eq(packs.deleted, false)
      ),
      with: {
        items: {
          where: eq(packItems.deleted, false),
          with: {
            catalogItem: true,
          },
        },
      },
    });

    if (!pack) {
      return null;
    }

    return computePackWeights(pack);
  }
}
