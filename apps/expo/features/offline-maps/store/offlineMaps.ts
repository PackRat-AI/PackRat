import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import type { OfflineArea, OfflineDownloadFailure, OfflineProgress } from '../types';

/**
 * Saved map areas by id, plus the download settings. Persisted: the tiles live in Mapbox's tile
 * store, and this is the record beside them of what each area is and whether it finished.
 */
export const offlineMapsStore = observable<{
  areas: Record<string, OfflineArea>;
  allowCellular: boolean;
}>({
  areas: {},
  /** Off by default: map downloads run to hundreds of megabytes. */
  allowCellular: false,
});

syncObservable(offlineMapsStore, {
  persist: { plugin: persistPlugin, name: 'offlineMaps' },
});

/** What each download is doing right now. Not persisted: a relaunch resumes from the tile store. */
export const offlineDownloadsStore = observable<{
  progress: Record<string, OfflineProgress>;
  failures: Record<string, OfflineDownloadFailure>;
  /** Areas held until the phone is on Wi-Fi (or any connection, when cellular is allowed). */
  waiting: Record<string, true>;
}>({ progress: {}, failures: {}, waiting: {} });
