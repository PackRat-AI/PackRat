import { obs } from 'app/lib/store';
import { packsStore } from '../store';

export function usePackOwnershipCheck(id: string) {
  const pack = obs(packsStore, id).peek();

  return !!pack;
}
