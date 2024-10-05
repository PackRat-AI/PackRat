import { type Item } from 'src/db/schema';
import { Item as ItemRepository } from '../../drizzle/methods/Item';
import { VectorClient } from '../../vector/client';

interface SimilarItem extends Item {
  similarityScore: number;
}

/**
 * Retrieves items that are similar to the provided item.
 *
 * @param {string} id - ID of the item for which to retrive similar items for.
 * @param {string} limit - Max number of similar items to return (default = 5).
 * @return {Promise<SimilarItem[]>} A promise that resolves with an array of items.
 */
export async function getSimilarItemsService(
  id: string,
  limit: number = 5,
): Promise<SimilarItem[]> {
  const itemRepository = new ItemRepository();
  const item = await itemRepository.findItem({
    id,
  });

  if (!item) {
    throw new Error(`Item with id: ${id} not found`);
  }

  const {
    result: { matches },
  } = await VectorClient.instance.search(item.name, 'items', limit, {
    isPublic: true,
  });

  // passing empty array to the db query below throws
  if (!matches.length) {
    return [];
  }

  const similarItemsResult = await itemRepository.findAllInArray(
    matches.map((m) => m.id),
  );

  // add similarity score to items result
  const similarItems = similarItemsResult.map((similarItem) => {
    return {
      ...similarItem,
      similarityScore: matches.find((m) => m.id == similarItem.id).score,
    };
  });

  return similarItems;
}
