import { ItemCategoryName, PrismaClient } from '@prisma/client/edge';
// import { prisma } from '../../prisma';
import { ItemCategoryEnum } from '../../utils/itemCategory';

/**
 * Generates a new item and adds it to a pack based on the given parameters.
 * @param {PrismaClient} prisma - Prisma client.
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
  prisma: PrismaClient,
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
      category = await prisma.itemCategory.findFirst({
        where: {
          name: ItemCategoryName.Food,
        },
      });
      newItem = await prisma.item.create({
        data: {
          name,
          weight,
          quantity,
          unit,
          packDocuments: {
            connect: { id: packId },
          },
          categoryDocument: {
            connect: { id: category.id },
          },
        },
      });

      break;
    }
    case ItemCategoryEnum.WATER: {
      category = await prisma.itemCategory.findFirst({
        where: {
          name: 'Water',
        },
      });

      const existingWaterItem = await prisma.item.findFirst({
        where: {
          category: category.id,
          packs: { has: packId },
        },
        select: {
          weight: true,
          id: true,
        },
      });

      if (existingWaterItem) {
        existingWaterItem.weight += Number(weight);
        newItem = await prisma.item.update({
          where: { id: existingWaterItem.id },
          data: {
            weight: existingWaterItem.weight,
          },
        });
      } else {
        newItem = await prisma.item.create({
          data: {
            name,
            weight,
            quantity: 1,
            unit,
            packDocuments: {
              connect: { id: packId },
            },
            categoryDocument: {
              connect: { id: category.id },
            },
          },
        });
      }

      break;
    }
    default: {
      category = await prisma.itemCategory.findFirst({
        where: {
          name: ItemCategoryEnum.ESSENTIALS,
        },
      });

      newItem = await prisma.item.create({
        data: {
          name,
          weight,
          quantity,
          unit,
          packDocuments: {
            connect: { id: packId },
          },
          categoryDocument: {
            connect: { id: category.id },
          },
          type,
        },
      });

      break;
    }
  }

  const pack = await prisma.pack.update({
    where: { id: packId },
    data: {
      itemDocuments: {
        connect: { id: newItem.id },
      },
    },
  });

  const updatedItem = await prisma.item.update({
    where: { id: newItem.id },
    data: {
      owners: {
        push: pack.owners.map((ownerId) => ownerId),
      },
    },
    include: {
      categoryDocument: true,
    },
  });

  return { newItem: updatedItem, packId };
};
