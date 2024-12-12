import type { ExecutionContext } from 'hono';
import * as validator from '@packrat/validations';

import { PackTemplate as PackTemplateClass } from '../../drizzle/methods/PackTemplate';
import * as ItemPackTemplateService from '../itemPackTemplate/itemPackTemplate.service';
import * as ItemService from '../item/item.service';
import { ITEM_TABLE_NAME, PackTemplate } from 'src/db/schema';
import { summarizeItem } from 'src/utils/item';
import { VectorClient } from 'src/vector/client';
import { i } from 'vitest/dist/reporters-QGe8gs4b.js';

/**
 * Adds a new pack template service.
 * @param {Object} packTemplateData - The data for the new pack template.
 * @param {string} packTemplateData.name - The name of the pack.
 * @param {string} packTemplateData.description - The description of the pack.
 * @param {string} packTemplateData.type - Whether the pack is public or not.
 * @return {Object} An object containing the created pack.
 */
export const addPackTemplateService = async (
  packTemplateData: typeof validator.addPackTemplate._type,
  executionCtx: ExecutionContext,
): Promise<PackTemplate> => {
  const { name, description, type } = packTemplateData;
  console.log({ packTemplateData });
  const packTemplateClass = new PackTemplateClass();
  let existingPack: PackTemplate | null =
    await packTemplateClass.findPackTemplate({ name });

  if (!existingPack) {
    existingPack = await packTemplateClass.create({
      name,
      description,
      type,
    });
  } else {
    console.log(
      'Pack template already exists. Skipping creation and proceeding with update of items',
    );
  }

  function* itemIterator() {
    for (const itemPackTemplate of packTemplateData.itemPackTemplates) {
      yield {
        ...itemPackTemplate.item,
        ownerId: packTemplateData.itemsOwnerId,
      };
    }
  }

  await ItemService.bulkAddNewItemsService({
    items: itemIterator(),
    executionCtx,
    onItemCreationError: (error, idx) => {
      console.error(`Error creating item at ${idx}:`, error);
    },
    onItemCreated: async (createdItem, idx) => {
      await ItemPackTemplateService.addItemPackTemplate({
        itemId: createdItem.id,
        quantity: packTemplateData.itemPackTemplates[idx].quantity,
        packTemplateId: existingPack.id,
      });
    },
  });

  return existingPack;
};
