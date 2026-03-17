import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WILDLIFE_HISTORY_QUERY_KEY, WILDLIFE_HISTORY_STORAGE_KEY } from '../constants';
import type { SpeciesIdentification } from '../types';

async function loadHistory(): Promise<SpeciesIdentification[]> {
  const stored = await AsyncStorage.getItem(WILDLIFE_HISTORY_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    await AsyncStorage.removeItem(WILDLIFE_HISTORY_STORAGE_KEY);
    return [];
  }
}

async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(WILDLIFE_HISTORY_STORAGE_KEY);
}

export function useWildlifeHistory() {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: WILDLIFE_HISTORY_QUERY_KEY,
    queryFn: loadHistory,
    staleTime: 1000 * 60,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: WILDLIFE_HISTORY_QUERY_KEY });
  };

  const clear = async () => {
    await clearHistory();
    invalidate();
  };

  return {
    history,
    isLoading,
    invalidate,
    clear,
  };
}
