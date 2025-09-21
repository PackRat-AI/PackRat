import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

export interface SeasonSuggestionsRequest {
  location: string;
  date: string;
}

export interface PackSuggestionItem {
  id: number;
  name: string;
  quantity: number;
  reason?: string;
}

export interface PackSuggestion {
  name: string;
  description: string;
  items: PackSuggestionItem[];
  season: string;
  activityType: string;
}

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
    const response = await axiosInstance.post('/api/season-suggestions', data);
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
