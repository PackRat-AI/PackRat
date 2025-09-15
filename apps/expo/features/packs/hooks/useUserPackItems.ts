import { use$ } from '@legendapp/state/react';
import { packItemsStore, packsStore } from '../store';

export function useUserPackItems() {
  const items = use$(() => {
    const allPacks = packsStore.get();
    const itemsArr = Object.values(packItemsStore.get()).filter((item) => {
      // Filter out items that are deleted
      if (item.deleted) return false;

      // Filter out items from deleted packs
      const pack = allPacks[item.packId];
      if (pack?.deleted) return false;

      return true;
    });
    return itemsArr;
  });

  return items;
}
