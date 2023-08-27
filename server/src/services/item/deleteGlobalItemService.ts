import Item from '../../models/itemModel';

/**
 * Deletes a global item by its ID.
 *
 * @param {string} itemId - The ID of the item to be deleted.
 * @return {Promise<Document>} - A promise that resolves to the deleted item.
 */
export const deleteGlobalItemService = async (itemId) => {
  const itemDeleted = await Item.findByIdAndDelete(itemId);

  return itemDeleted;
};
