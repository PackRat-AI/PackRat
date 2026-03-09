import { use$ } from '@legendapp/state/react';
import { offlineMapsStore } from '../store/offlineMaps';

/** Returns total storage used by all completed offline map regions */
export function useOfflineMapsStorageInfo() {
  return use$(() => {
    const regions = Object.values(offlineMapsStore.get());
    const totalSize = regions.reduce((sum, r) => sum + r.downloadedSize, 0);
    const completedCount = regions.filter((r) => r.status === 'completed').length;
    const downloadingCount = regions.filter((r) => r.status === 'downloading').length;
    return { totalSize, completedCount, downloadingCount, totalCount: regions.length };
  });
}
