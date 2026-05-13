import { obs } from 'expo-app/lib/store';
import { packsStore } from '../store';

export function usePackOwnershipCheck(id: string) {
  const pack = obs({ store: packsStore, id: id }).peek();

  return !!pack;
}
