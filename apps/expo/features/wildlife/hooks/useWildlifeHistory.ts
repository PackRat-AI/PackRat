import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { useAtom } from 'jotai';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { baseWildlifeHistoryAtom, wildlifeHistoryAtom } from '../atoms/wildlifeAtoms';
import type { IdentificationResult, WildlifeIdentification } from '../types';

export function useWildlifeHistory() {
  const [historyState] = useAtom(wildlifeHistoryAtom);
  const [, setHistory] = useAtom(baseWildlifeHistoryAtom);

  const addIdentification = useCallback(
    async (
      imageUri: string,
      results: IdentificationResult[],
      location?: WildlifeIdentification['location'],
    ) => {
      const entry: WildlifeIdentification = {
        id: nanoid(),
        imageUri,
        timestamp: Date.now(),
        results,
        location,
      };
      setHistory((prev) => [entry, ...prev]);
      return entry;
    },
    [setHistory],
  );

  const deleteIdentification = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const entry = prev.find((e) => e.id === id);
        if (entry?.imageUri) {
          // Best-effort: delete the persisted image file
          ImageCacheManager.clearImage(entry.imageUri).catch((err: unknown) => {
            console.warn('Failed to delete wildlife image file:', err);
          });
        }
        return prev.filter((e) => e.id !== id);
      });
    },
    [setHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory((prev) => {
      // Best-effort: delete all persisted image files before clearing
      Promise.all(
        prev.map((entry) =>
          ImageCacheManager.clearImage(entry.imageUri).catch((err: unknown) => {
            console.warn('Failed to delete wildlife image file:', err);
          }),
        ),
      );
      return [];
    });
  }, [setHistory]);

  return {
    historyState,
    addIdentification,
    deleteIdentification,
    clearHistory,
  };
}
