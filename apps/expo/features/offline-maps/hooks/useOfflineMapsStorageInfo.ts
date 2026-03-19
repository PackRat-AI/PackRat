import { use$ } from '@legendapp/state/react';
import { offlineMapsStore } from '../store/offlineMaps';

/** Returns storage stats for offline map regions: total completed size + region counts */
export function useOfflineMapsStorageInfo() {
  return use$(() => {
    const regions = Object.values(offlineMapsStore.get());
    const completedRegions = regions.filter((r) => r.status === 'completed');
    const totalSize = completedRegions.reduce((sum, r) => sum + r.downloadedSize, 0);
    const completedCount = completedRegions.length;
    const downloadingCount = regions.filter((r) => r.status === 'downloading').length;
    return { totalSize, completedCount, downloadingCount, totalCount: regions.length };
  });
}
