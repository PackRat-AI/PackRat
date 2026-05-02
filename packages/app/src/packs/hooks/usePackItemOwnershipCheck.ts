import { obs } from '@packrat/app/lib/store';
import { packItemsStore } from '../store';

export function usePackItemOwnershipCheck(id: string) {
  const packItem = obs(packItemsStore, id).peek();

  return !!packItem;
}
