import { use$ } from '@legendapp/state/react';
import { packItemsStore } from '../store';

export function useUserPackItems() {
  const items = use$(() => {
    const itemsArr = Object.values(packItemsStore.get()).filter((item) => !item.deleted);
    return itemsArr;
  });

  return items;
}
