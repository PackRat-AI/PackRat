import * as FileSystem from 'expo-file-system';
import { useCallback, useRef } from 'react';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineMapRegion, PredefinedRegion } from '../types';
import { estimateDownloadSize } from '../utils/regions';

const OFFLINE_MAPS_DIR = `${FileSystem.documentDirectory}offline-maps/`;

/** Simulates tile downloads with realistic progress updates */
async function simulateDownload(
  _regionId: string,
  estimatedSize: number,
  onProgress: (progress: number, downloadedSize: number) => void,
  signal: { cancelled: boolean },
): Promise<void> {
  const TICK_MS = 300;
  // Scale ticks with size: ~20 ticks per 10 MB, clamped between 10 and 60.
  const MB = estimatedSize / (1024 * 1024);
  const TOTAL_TICKS = Math.min(60, Math.max(10, Math.round((MB / 10) * 20)));

  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    if (signal.cancelled) return;
    await new Promise<void>((resolve) => setTimeout(resolve, TICK_MS));
    const progress = Math.round((tick / TOTAL_TICKS) * 100);
    const downloadedSize = Math.round((tick / TOTAL_TICKS) * estimatedSize);
    onProgress(progress, downloadedSize);
  }
}

/**
 * Hook that returns a function to start downloading a map region.
 * Persists region metadata in the local store and simulates tile fetching.
 */
export function useDownloadMapRegion() {
  const cancelRefs = useRef<Record<string, { cancelled: boolean }>>({});

  const downloadRegion = useCallback(
    async (region: PredefinedRegion, minZoom: number, maxZoom: number) => {
      const id = `${region.id}-${Date.now()}`;
      const estimatedSize = estimateDownloadSize(region.bounds, minZoom, maxZoom);
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

      offlineMapsStore[id].set(entry);

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(OFFLINE_MAPS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(OFFLINE_MAPS_DIR, { intermediates: true });
      }

      const signal = { cancelled: false };
      cancelRefs.current[id] = signal;

      try {
        await simulateDownload(
          id,
          estimatedSize,
          (progress, downloadedSize) => {
            offlineMapsStore[id].set((prev) => ({
              ...prev,
              progress,
              downloadedSize,
              status: 'downloading',
              updatedAt: new Date().toISOString(),
            }));
          },
          signal,
        );

        if (!signal.cancelled) {
          offlineMapsStore[id].set((prev) => ({
            ...prev,
            progress: 100,
            downloadedSize: estimatedSize,
            status: 'completed',
            updatedAt: new Date().toISOString(),
          }));
        }
      } catch {
        offlineMapsStore[id].set((prev) => ({
          ...prev,
          status: 'failed',
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        delete cancelRefs.current[id];
      }
    },
    [],
  );

  const cancelDownload = useCallback((id: string) => {
    if (cancelRefs.current[id]) {
      cancelRefs.current[id].cancelled = true;
    }
    offlineMapsStore[id].set((prev) => ({
      ...prev,
      status: 'idle',
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  return { downloadRegion, cancelDownload };
}
