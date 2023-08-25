import Item from '../../models/itemModel';
import Pack from '../../models/packModel';
import { ItemCategoryModel } from '../../models/itemCategory';
import { ItemCategoryEnum } from '../../utils/itemCategory';

/**
 * Generates a new item and adds it to a pack based on the given parameters.
 *
 * @param {string} name - The name of the item.
 * @param {number} weight - The weight of the item.
 * @param {number} quantity - The quantity of the item.
 * @param {string} unit - The unit of measurement for the item.
 * @param {string} packId - The ID of the pack to add the item to.
 * @param {string} type - The category type of the item.
 * @param {string} ownerId - The ID of the owner of the item.
 * @return {object} An object containing the newly created item and the pack ID.
 */
export const addItemService = async (
  name,
  weight,
  quantity,
  unit,
  packId,
  type,
  ownerId,
) => {
  let category = null;
  let newItem = null;

  switch (type) {
    case ItemCategoryEnum.FOOD: {
      category = await ItemCategoryModel.findOne({
        name: ItemCategoryEnum.FOOD,
      });

      newItem = await Item.create({
        name,
        weight,
        quantity,
        unit,
        packs: [packId],
        category: category._id,
      });

      break;
    }
    case ItemCategoryEnum.WATER: {
      category = await ItemCategoryModel.findOne({
        name: ItemCategoryEnum.WATER,
      });

      const existingWaterItem = await Item.findOne({
        category: category._id,
        packs: packId,
      });

      if (existingWaterItem) {
        existingWaterItem.weight += Number(weight); // Ensure weight is treated as a number
        await existingWaterItem.save();
        newItem = existingWaterItem;
      } else {
        newItem = await Item.create({
          name,
          weight,
          quantity: 1,
          unit,
          packs: [packId],
          category: category._id,
        });
      }

      break;
    }
    default: {
      category = await ItemCategoryModel.findOne({
        name: ItemCategoryEnum.ESSENTIALS,
      });

      newItem = await Item.create({
        name,
        weight,
        quantity,
        unit,
        packs: [packId],
        category: category._id,
      });

      break;
    }
  }
  await Pack.updateOne({ _id: packId }, { $addToSet: { items: newItem._id } });

  const updatedItem = await Item.findByIdAndUpdate(
    newItem._id,
    {
      $addToSet: {
        owners: ownerId,
      },
    },
    { new: true },
  ).populate('category');

  return { newItem: updatedItem, packId };
};
