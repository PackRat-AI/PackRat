import { use$ } from '@legendapp/state/react';
import { useMemo } from 'react';
import { offlineDownloadsStore, offlineMapsStore } from '../store/offlineMaps';
import type { OfflineArea } from '../types';
import { sortAreas } from '../utils/offlineArea';

/** Every saved area, finished trips first, then newest first. */
export function useOfflineAreas(): OfflineArea[] {
  const areas = use$(offlineMapsStore.areas);
  // A stable array while the store is unchanged, so screens can memoize on it.
  return useMemo(() => sortAreas({ areas: Object.values(areas), now: Date.now() }), [areas]);
}

/** The area saved for a trip or trail, if any. */
export function useOfflineAreaFor({
  tripId,
  trailId,
}: {
  tripId?: string;
  trailId?: string;
}): OfflineArea | undefined {
  const areas = use$(offlineMapsStore.areas);
  return Object.values(areas).find(
    (area) => (tripId && area.tripId === tripId) || (trailId && area.trailId === trailId),
  );
}

/** What one area's download is doing right now. */
export function useDownloadState(id: string) {
  return {
    progress: use$(() => offlineDownloadsStore.progress[id]?.get()),
    failure: use$(() => offlineDownloadsStore.failures[id]?.get()),
    waiting: use$(() => offlineDownloadsStore.waiting[id]?.get()) === true,
  };
}
