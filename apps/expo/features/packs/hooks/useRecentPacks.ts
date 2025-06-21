import { use$ } from '@legendapp/state/react';
import { usePacks } from './usePacks';
import { getPackItems, packItemsStore } from '../store';
import { computePackWeights } from '../utils/computePackWeights';

export function useRecentPacks() {
  const packs = usePacks();
  const recentPacks = use$(() => {
    // Sort by localCreatedAt from latest to oldest
    const sortedPacks = packs.sort((a, b) => {
      // Convert dates to timestamps for comparison
      const dateA = new Date(a.localCreatedAt).getTime();
      const dateB = new Date(b.localCreatedAt).getTime();

      // Sort descending (latest first)
      return dateB - dateA;
    });

    const sortedPacksWithWeights = sortedPacks.map((pack) => {
      const items = getPackItems(pack.id);
      const packWithWeights = computePackWeights({ ...pack, items });
      return packWithWeights;
    });

    return sortedPacksWithWeights;
  });

  return recentPacks.slice(0, 5);
}
