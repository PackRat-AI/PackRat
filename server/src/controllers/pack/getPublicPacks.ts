import { publicProcedure, protectedProcedure } from '../../trpc';
import { getPublicPacksService } from '../../services/pack/pack.service';
import { z } from 'zod';

export const getPublicPacks = async (c) => {
  try {
    const { queryBy } = await c.req.parseQuery();
    const packs = await getPublicPacksService(queryBy);
    return c.json(
      { packs, message: 'Public packs retrieved successfully' },
      200,
    );
  } catch (error) {
    return c.json(
      { error: `Failed to get public packs: ${error.message}` },
      500,
    );
  }
};

export function getPublicPacksRoute() {
  return protectedProcedure
    .input(z.object({ queryBy: z.string() }))
    .query(async (opts) => {
      const { queryBy } = opts.input;
      const packs = await getPublicPacksService(queryBy);
      return packs;
    });
}
