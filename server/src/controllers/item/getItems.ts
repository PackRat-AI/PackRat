import { publicProcedure } from '../../trpc';
import { ItemNotFoundError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { getItemsService } from '../../services/item/item.service';
import * as validator from '../../middleware/validators/index';
import { Item } from '../../prisma/methods';
/**
 * Retrieves a list of items associated with a pack.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.packId - The ID of the pack to retrieve items for.
 * @return {Object} An array of items associated with the pack.
 */
// export const getItems = async (req, res, next) => {
//   try {
//     const { packId } = req.params;

//     const items = await getItemsService(packId);

//     res.locals.data = items;
//     responseHandler(res);
//   } catch (error) {
//     next(ItemNotFoundError);
//   }
// };

export function getItemsRoute() {
  return publicProcedure.input(validator.getItems).query(async (opts) => {
    const { packId } = opts.input;
    const { prisma }: any = opts.ctx;
    console.log({ packId });
    const items = await getItemsService(prisma, packId);
    const jsonItems = items.map((item) => Item(item)?.toJSON());
    return jsonItems;
  });
}
