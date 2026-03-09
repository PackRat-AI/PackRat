import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpeciesIdentification } from '../types';

const HISTORY_STORAGE_KEY = 'wildlife_identification_history';
const HISTORY_QUERY_KEY = ['wildlife', 'history'];

async function loadHistory(): Promise<SpeciesIdentification[]> {
  const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    return [];
  }
}

async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
}

export function useWildlifeHistory() {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: loadHistory,
    staleTime: 1000 * 60,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
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
