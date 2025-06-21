import { use$ } from '@legendapp/state/react';
import { packsStore } from '~/features/packs/store';

export function usePacks() {
  const packs = use$(() => {
    const packsArray = Object.values(packsStore.get());

    const filteredPacks = packsArray.filter((pack) => pack.deleted === false);

    return filteredPacks;
  });

  return packs;
}
