import { packItemsStore } from '../store';

export function usePackItemOwnershipCheck(id: string) {
  // @ts-expect-error: Safe because Legend-State uses Proxy
  const packItem = packItemsStore[id].peek();

  return !!packItem;
}
