import { use$ } from '@legendapp/state/react';
import { getPackItems, packsStore } from '~/features/packs/store';
import { computePackWeights } from '../utils/computePackWeights';

// Hook to get a single pack
export function usePackDetails(id: string) {
  const pack = use$(() => {
    const pack_ = packsStore[id].get();
    const items = getPackItems(id);
    const packWithWeights = computePackWeights({ ...pack_, items });
    return packWithWeights;
  });

  return pack;
}
