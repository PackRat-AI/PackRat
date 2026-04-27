import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { PackInput, PackItemInput } from '../types';

export interface SeasonSuggestionsRequest {
  location: string;
  date: string;
}

export type PackSuggestion = PackInput & {
  items: PackItemInput[];
};

export interface SeasonSuggestionsResponse {
  suggestions: PackSuggestion[];
  totalInventoryItems: number;
  location: string;
  season: string;
}

const generateSeasonSuggestions = async (
  data: SeasonSuggestionsRequest,
): Promise<SeasonSuggestionsResponse> => {
  const { data: result, error } = await apiClient['season-suggestions'].post(data);
  if (error) throw new Error(`Failed to generate season suggestions: ${error.value}`);
  // safe-cast: treaty response shape matches SeasonSuggestionsResponse as validated by the API schema
  return result as unknown as SeasonSuggestionsResponse;
};

export function useSeasonSuggestions() {
  return useMutation({
    mutationFn: generateSeasonSuggestions,
    onError: (error) => {
      console.error('Season suggestions error:', error);
    },
  });
}
