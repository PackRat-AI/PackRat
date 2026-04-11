import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
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
  try {
    const response = await axiosInstance.post('/api/season-suggestions', data, {
      timeout: 0,
    });
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to generate season suggestions: ${message}`);
  }
};

export function useSeasonSuggestions() {
  return useMutation({
    mutationFn: generateSeasonSuggestions,
    onError: (error) => {
      console.error('Season suggestions error:', error);
    },
  });
}
