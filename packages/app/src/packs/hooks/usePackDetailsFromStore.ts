import { use$ } from '@legendapp/state/react';
import { obs } from '@packrat/app/lib/store';
import { computePackWeights } from '@packrat/app/packs';
import { getPackItems, packsStore } from '@packrat/app/packs/store';

/**
 * Retrieves pack from store.
 * Use user-owned pack through this hook in order to observe changes.
 * The store holds only the packs created by the current user.
 *
 * @param id - The id of the pack to retrieve
 * @returns A pack object with computed weights including its items
 */
export function usePackDetailsFromStore(id: string) {
  const pack = use$(() => {
    const pack_ = obs(packsStore, id).get();
    const items = getPackItems(id);
    const packWithWeights = computePackWeights({ ...pack_, items });
    return packWithWeights;
  });

  return pack;
}
