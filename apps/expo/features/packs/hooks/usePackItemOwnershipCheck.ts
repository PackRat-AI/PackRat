import { packItemsStore } from '../store';

export function usePackItemOwnershipCheck(id: string) {
  // @ts-ignore: Safe because Legend-State uses Proxy
  const packItem = packItemsStore[id].peek();

  return !!packItem;
}
