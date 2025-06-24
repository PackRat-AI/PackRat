import { use$ } from '@legendapp/state/react';
import { packItemsStore } from 'expo-app/features/packs/store';

export function usePackItem(id: string) {
  const item = use$(packItemsStore[id]);
  return item;
}
