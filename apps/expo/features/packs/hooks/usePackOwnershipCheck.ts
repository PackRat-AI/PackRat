import { packsStore } from '../store';

export function usePackOwnershipCheck(id: string) {
  const pack = packsStore[id].peek();

  return !!pack;
}
