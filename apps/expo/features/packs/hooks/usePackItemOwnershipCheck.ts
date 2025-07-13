import { packItemsStore } from '../store';

export function usePackItemOwnershipCheck(id: string) {
  const packItem = packItemsStore[id].peek();

  return !!packItem;
}
