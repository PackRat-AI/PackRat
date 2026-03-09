import * as FileSystem from 'expo-file-system';
import { useCallback } from 'react';
import { OFFLINE_MAPS_DIR } from '../constants';
import { offlineMapsStore } from '../store/offlineMaps';

/** Hook that returns a function to delete a downloaded region */
export function useDeleteMapRegion() {
  const deleteRegion = useCallback(async (id: string) => {
    // Remove tile directory if it exists
    const regionDir = `${OFFLINE_MAPS_DIR}${id}/`;
    const info = await FileSystem.getInfoAsync(regionDir);
    if (info.exists) {
      await FileSystem.deleteAsync(regionDir, { idempotent: true });
    }

    // Remove from store
    offlineMapsStore[id].delete();
  }, []);

  return { deleteRegion };
}
