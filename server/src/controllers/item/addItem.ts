import { publicProcedure } from '../../trpc';
import { UnableToAddItemError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { addItemService } from '../../services/item/item.service';
import * as validator from '../../middleware/validators/index';
import { Item } from '../../prisma/methods';

/**
 * Adds an item to the database based on the provided request body.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The updated item and pack ID.
 */
// export const addItem = async (req, res, next) => {
//   try {
//     const { name, weight, quantity, unit, packId, type, ownerId } = req.body;

//     const result = await addItemService(
//       name,
//       weight,
//       quantity,
//       unit,
//       packId,
//       type,
//       ownerId,
//     );

//     res.locals.data = { newItem: result.newItem, packId: result.packId };
//     responseHandler(res);
//   } catch (error) {
//     next(UnableToAddItemError);
//   }
// };

export function addItemRoute() {
  return publicProcedure.input(validator.addItem).mutation(async (opts) => {
    const { name, weight, quantity, unit, packId, type, ownerId } = opts.input;
    const { prisma }: any = opts.ctx;
    const result = await addItemService(
      prisma,
      name,
      weight,
      quantity,
      unit,
      packId,
      type,
      ownerId,
    );
    return { newItem: Item(result.newItem)?.toJSON(), packId: result.packId };
  });
}
