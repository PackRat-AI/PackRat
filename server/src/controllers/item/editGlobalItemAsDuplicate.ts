import { editGlobalItemAsDuplicateService } from '../../services/item/item.service';

/**
 * Edit a global item by duplicating it with new changes.
 * @param {Object} req - The request object.
 * @param {Object} req.params - The parameters object.
 * @param {string} req.params.itemId - The ID of the item to edit.
 * @param {Object} req.body - The request body object.
 * @param {string} req.body.packId - The ID of the pack.
 * @param {string} req.body.name - The name of the item.
 * @param {number} req.body.weight - The weight of the item.
 * @param {number} req.body.quantity - The quantity of the item.
 * @param {string} req.body.unit - The unit of the item.
 * @param {string} req.body.type - The type of the item.
 * @param {Object} res - The response object.
 * @return {Object} The updated item.
 */
export const editGlobalItemAsDuplicate = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { packId, name, weight, quantity, unit, type } = req.body;

    const newItem = await editGlobalItemAsDuplicateService(
      itemId,
      packId,
      name,
      weight,
      quantity,
      unit,
      type,
    );

    res.status(200).json(newItem);
  } catch (error) {
    res.status(404).json({ msg: 'Items cannot be found' });
  }
};
