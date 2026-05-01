import { use$ } from '@legendapp/state/react';
import { obs } from 'expo-app/lib/store';
import { packsStore } from '../store';

export function usePackOwnershipCheck(id: string) {
  return use$(() => !!obs(packsStore, id).get());
}
