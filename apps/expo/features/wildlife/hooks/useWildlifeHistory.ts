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
      setHistory((prev) => prev.filter((entry) => entry.id !== id));
    },
    [setHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return {
    historyState,
    addIdentification,
    deleteIdentification,
    clearHistory,
  };
}
