import * as FileSystem from 'expo-file-system';
import { useCallback, useRef } from 'react';
import { ERR_DUPLICATE_DOWNLOAD, ERR_INSUFFICIENT_STORAGE, OFFLINE_MAPS_DIR } from '../constants';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineMapRegion, PredefinedRegion } from '../types';
import { estimateDownloadSize } from '../utils/regions';

/** Runs tile download simulation in the background without blocking the caller */
async function runDownloadInBackground(
  id: string,
  estimatedSize: number,
  signal: { cancelled: boolean },
): Promise<void> {
  const TICK_MS = 300;
  // Scale ticks with size: ~20 ticks per 10 MB, clamped between 10 and 60.
  const MB = estimatedSize / (1024 * 1024);
  const TOTAL_TICKS = Math.min(60, Math.max(10, Math.round((MB / 10) * 20)));

  try {
    for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
      if (signal.cancelled) return;
      await new Promise<void>((resolve) => setTimeout(resolve, TICK_MS));
      // Check again after the sleep to prevent post-cancel store writes
      if (signal.cancelled) return;
      const progress = Math.round((tick / TOTAL_TICKS) * 100);
      const downloadedSize = Math.round((tick / TOTAL_TICKS) * estimatedSize);
      // @ts-ignore: Safe because Legend-State uses Proxy
      offlineMapsStore[id].set((prev) => ({
        ...prev,
        progress,
        downloadedSize,
        status: 'downloading',
        updatedAt: new Date().toISOString(),
      }));
    }

    if (!signal.cancelled) {
      // @ts-ignore: Safe because Legend-State uses Proxy
      offlineMapsStore[id].set((prev) => ({
        ...prev,
        progress: 100,
        downloadedSize: estimatedSize,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error(`[OfflineMaps] Download simulation failed for entry "${id}":`, error);
    // @ts-ignore: Safe because Legend-State uses Proxy
    offlineMapsStore[id].set((prev) => ({
      ...prev,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    }));
  }
}

/**
 * Hook that returns functions to start and cancel map region downloads.
 * Persists region metadata in the local store and simulates tile fetching.
 *
 * IMPORTANT: This hook must be called at the top level of a screen component
 * (not inside a modal sub-component) so that `cancelRefs` persists for the
 * lifetime of the screen, even after the download modal closes.
 */
export function useDownloadMapRegion() {
  const cancelRefs = useRef<Record<string, { cancelled: boolean }>>({});

  /**
   * Validates preconditions (no active duplicate, sufficient storage), creates
   * the store entry, then launches the download simulation in the background.
   *
   * Throws if validation fails so the caller can surface the error to the user
   * before closing any modal.
   */
  const downloadRegion = useCallback(
    async (region: PredefinedRegion, minZoom: number, maxZoom: number) => {
      // Guard: prevent duplicate downloads for the same region
      const existingEntries = Object.values(offlineMapsStore.get());
      const alreadyActive = existingEntries.some(
        (entry) => entry.id.startsWith(`${region.id}-`) && entry.status === 'downloading',
      );
      if (alreadyActive) {
        throw new Error(ERR_DUPLICATE_DOWNLOAD);
      }

      const estimatedSize = estimateDownloadSize(region.bounds, minZoom, maxZoom);

      // Check available disk space before starting — throw so caller can show inline error
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace < estimatedSize) {
        throw new Error(ERR_INSUFFICIENT_STORAGE);
      }

      const id = `${region.id}-${Date.now()}`;
      const now = new Date().toISOString();

      const entry: OfflineMapRegion = {
        id,
        name: region.name,
        description: region.description,
        bounds: region.bounds,
        minZoom,
        maxZoom,
        estimatedSize,
        downloadedSize: 0,
        status: 'downloading',
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };

      // @ts-ignore: Safe because Legend-State uses Proxy
      offlineMapsStore[id].set(entry);

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(OFFLINE_MAPS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(OFFLINE_MAPS_DIR, { intermediates: true });
      }

      const signal = { cancelled: false };
      cancelRefs.current[id] = signal;

      // Fire-and-forget: download runs in background so the modal can close immediately
      runDownloadInBackground(id, estimatedSize, signal).finally(() => {
        delete cancelRefs.current[id];
      });
    },
    [],
  );

  const cancelDownload = useCallback((id: string) => {
    if (cancelRefs.current[id]) {
      cancelRefs.current[id].cancelled = true;
    }
    // Remove the entry entirely rather than leaving an orphaned 'idle' record
    // @ts-ignore: Safe because Legend-State uses Proxy
    offlineMapsStore[id].delete();
  }, []);

  return { downloadRegion, cancelDownload };
}
