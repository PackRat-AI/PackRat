import { packsStore } from '../store';

export function usePackOwnershipCheck(id: string) {
  // @ts-expect-error: Safe because Legend-State uses Proxy
  const pack = packsStore[id].peek();

  return !!pack;
}
