import { use$ } from '@legendapp/state/react';

import { packsStore } from 'expo-app/features/packs/store';
import type { PackInStore } from '../types';

const getPackTime = (pack: PackInStore) => {
  if (pack.localCreatedAt) return new Date(pack.localCreatedAt).getTime();
  if (pack.createdAt) return new Date(pack.createdAt).getTime();
  return 0;
};

export function usePacks() {
  const packs = use$(() => {
    const packsArray = Object.values(packsStore.get());

    return packsArray
      .filter((pack) => pack.deleted === false)
      .sort((a, b) => getPackTime(b) - getPackTime(a));
  });

  return packs;
}
