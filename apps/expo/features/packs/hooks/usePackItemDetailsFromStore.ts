import { use$ } from '@legendapp/state/react';
import { packItemsStore } from '~/features/packs/store';

/**
 * Retrieves item from store.
 * Use user-owned item through this hook in order to observe changes.
 * The store holds only the items created by the current user.
 *
 * @param id - The id of the item to retrieve
 * @returns An item object
 */
export function usePackItemDetailsFromStore(id: string) {
  const item = use$(packItemsStore[id]);
  return item;
}
