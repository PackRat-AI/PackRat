import { isString, toRecord } from '@packrat/guards';
import * as Sentry from '@sentry/react-native';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { PackInput, PackItemInput } from '../types';

export interface SeasonSuggestionsRequest {
  location: string;
  date: string;
}

export type SeasonSuggestionItem = PackItemInput & { id: string };

export type PackSuggestion = PackInput & {
  items: SeasonSuggestionItem[];
};

export interface SeasonSuggestionsResponse {
  suggestions: PackSuggestion[];
  totalInventoryItems: number;
  location: string;
  season: string;
}

export class SeasonSuggestionsError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly serverMessage: string,
  ) {
    super(serverMessage);
    this.name = 'SeasonSuggestionsError';
  }
}

function extractServerMessage(value: unknown): string {
  if (isString(value)) return value;
  const rec = toRecord(value);
  if (isString(rec.error)) return rec.error;
  if (isString(rec.message)) return rec.message;
  return 'Failed to generate season suggestions';
}

const generateSeasonSuggestions = async (
  data: SeasonSuggestionsRequest,
): Promise<SeasonSuggestionsResponse> => {
  const { data: result, error } = await apiClient['season-suggestions'].post(data);
  if (error) {
    const httpStatus = error.status ?? 500;
    const serverMessage = extractServerMessage(error.value);
    const err = new SeasonSuggestionsError(httpStatus, serverMessage);
    Sentry.captureException(err, {
      tags: { feature: 'packs', action: 'generateSeasonSuggestions' },
      extra: {
        location: data.location,
        date: data.date,
        httpStatus,
        serverMessage,
      },
    });
    throw err;
  }
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
