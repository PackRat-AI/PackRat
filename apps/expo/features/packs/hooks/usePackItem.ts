import { use$ } from '@legendapp/state/react';
import { packItemsStore } from '~/features/packs/store';

export function usePackItem(id: string) {
  const item = use$(packItemsStore[id]);
  return item;
}
