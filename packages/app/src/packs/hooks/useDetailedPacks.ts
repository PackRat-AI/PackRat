import { use$ } from '@legendapp/state/react';
import type { Pack } from '@packrat/app/packs';
import { getPackItems, packsStore } from '@packrat/app/packs/store';
import { computePackWeights } from '../utils';

export function useDetailedPacks(): Pack[] {
  const packs = use$(() => {
    const packsArray = Object.values(packsStore.get());

    const filteredPacks: Pack[] = [];
    for (const pack of packsArray) {
      if (pack.deleted) continue;
      const items = getPackItems(pack.id);
      const packWithWeights = computePackWeights({ ...pack, items });
      filteredPacks.push(packWithWeights);
    }

    return filteredPacks;
  });

  return packs;
}
