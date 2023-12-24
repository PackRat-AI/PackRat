// import { prisma } from '../../prisma';

import { PrismaClient } from '@prisma/client/edge';
import { Item } from '../../drizzle/methods/Item';

/**
 * Retrieves an item from the database by its ID.
 * @param {PrismaClient} prisma - Prisma client.
 * @param {string} id - The ID of the item to retrieve.
 * @return {Promise<Object>} The retrieved item.
 */
export const getItemByIdService = async (id) => {
  const itemClass = new Item();
  const item = await itemClass.findUniqueItem({
    where: {
      id: id,
    },
  });

  return item;
};
