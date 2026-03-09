import { use$ } from '@legendapp/state/react';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineMapRegion } from '../types';

/** Returns all offline map regions sorted by creation date (newest first) */
export function useOfflineMapRegions(): OfflineMapRegion[] {
  const regions = use$(() => Object.values(offlineMapsStore.get()));
  return [...regions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
