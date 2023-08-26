import { ItemNotFoundError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { addGlobalItemToPackService } from '../../services/item/item.service';

/**
 * Adds a global item to a pack.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The updated item.
 */
export const addGlobalItemToPack = async (req, res, next) => {
  try {
    const { packId } = req.params;
    const { itemId, ownerId } = req.body;

    const result = await addGlobalItemToPackService(packId, itemId, ownerId);

    res.locals.data = result;
    responseHandler(res);
  } catch (error) {
    next(ItemNotFoundError);
  }
};
