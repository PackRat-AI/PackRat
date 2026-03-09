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
      setHistory(async (prev) => [entry, ...(await prev)]);
      return entry;
    },
    [setHistory],
  );

  const deleteIdentification = useCallback(
    (id: string) => {
      setHistory(async (prev) => {
        const history = await prev;
        const entry = history.find((e) => e.id === id);
        if (entry?.imageUri) {
          await ImageCacheManager.clearImage(entry.imageUri).catch((err: unknown) => {
            console.warn('Failed to delete wildlife image file:', err);
          });
        }
        return history.filter((e) => e.id !== id);
      });
    },
    [setHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory(async (prev) => {
      const history = await prev;
      await Promise.all(
        history.map((entry) =>
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
