import { type ExecutionContext } from 'hono';
import {
  Item,
  ITEM_TABLE_NAME,
  type InsertItemCategory,
} from '../../db/schema';
import { Item as ItemClass } from '../../drizzle/methods/Item';
import { ItemCategory } from '../../drizzle/methods/itemcategory';
import { ItemCategory as categories } from '../../utils/itemCategory';
import { VectorClient } from '../../vector/client';
import { convertWeight, SMALLEST_WEIGHT_UNIT } from 'src/utils/convertWeight';
import { DbClient } from 'src/db/client';
import { itemImage as itemImageTable } from '../../db/schema';
import { summarizeItem } from 'src/utils/item';
import { addNewItemService, bulkAddNewItemsService } from './addItemService';
// import { prisma } from '../../prisma';

interface AddItemGlobalServiceParams {
  /** The name of the item. */
  name: string;
  /** The description of the item. */
  description?: string;
  /** The weight of the item. */
  weight: number;
  /** The unit of measurement for the item. */
  unit: string;
  /** The category of the item. */
  type: (typeof categories)[number];
  /** The ID of the owner of the item. */
  ownerId: string;
  /** The URLs of the images of the item. */
  image_urls?: string;
  /** The SKU of the item. */
  sku?: string;
  /** The URL of the product of the item. */
  productUrl?: string;
  /** The product details of the item. */
  productDetails?: Record<string, string | number | boolean | null>;
  /** The seller of the item. */
  seller?: string;
}

/**
 * Adds an item to the global service.
 * @return {Promise<Object>} The newly created item.
 */
export const addItemGlobalService = async (
  {
    name,
    weight,
    unit,
    type,
    ownerId,
    image_urls,
    sku,
    productUrl,
    description,
    productDetails,
    seller,
  }: AddItemGlobalServiceParams,
  executionCtx: ExecutionContext,
) => {
  let category: InsertItemCategory | null;
  if (!categories.includes(type)) {
    throw new Error(`Category must be one of: ${categories.join(', ')}`);
  }
  const itemClass = new ItemClass();
  const itemCategoryClass = new ItemCategory();
  category = (await itemCategoryClass.findItemCategory({ name: type })) || null;
  if (!category) {
    category = await itemCategoryClass.create({ name: type });
  }
  const newItem = await itemClass.create({
    name,
    weight: convertWeight(Number(weight), unit as any, SMALLEST_WEIGHT_UNIT),
    unit,
    categoryId: category.id,
    global: true,
    ownerId,
    sku,
    productUrl,
    description,
    productDetails,
    seller,
  });

  if (image_urls) {
    const urls = image_urls.split(',');
    for (const url of urls) {
      const newItemImage = {
        itemId: newItem.id,
        url,
      };
      await DbClient.instance.insert(itemImageTable).values(newItemImage).run();
    }
  }

  executionCtx.waitUntil(
    VectorClient.instance.syncRecord({
      id: newItem.id,
      content: `product_name: ${name}, category: ${type}, description: ${description}, productDetails: ${JSON.stringify(
        productDetails,
      )}`,
      namespace: ITEM_TABLE_NAME,
      metadata: {
        isPublic: newItem.global,
        ownerId,
      },
    }),
  );

  return newItem;
};

/**
 * Adds list of items to the global service.
 * @return {Promise<Object>} The newly created item.
 */
export const addItemGlobalServiceBatch = async <T>(
  rawItems: T[],
  continueOnError = false,
  executionCtx: ExecutionContext,
  transform: (rawItem: T) => AddItemGlobalServiceParams,
) => {
  const errors: Error[] = [];

  const createdItemsInOrder: Array<
    Awaited<ReturnType<typeof addNewItemService>>
  > = [];

  function* itemIterator() {
    for (let idx = 0; idx < rawItems.length; idx++) {
      const item = transform(rawItems[idx]);
      yield { ...item, category: item.type, imageUrls: item.image_urls };
    }
  }

  await bulkAddNewItemsService({
    items: itemIterator(),
    executionCtx,
    onItemCreationError: (error) => {
      if (!continueOnError) {
        throw error;
      }
      errors.push(error);
    },
  });

  return {
    createdItemsInOrder,
    errors,
  };
};
