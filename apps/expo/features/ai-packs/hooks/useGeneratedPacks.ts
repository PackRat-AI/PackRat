import { use$ } from '@legendapp/state/react';
import * as Sentry from '@sentry/react-native';
import { useMutation } from '@tanstack/react-query';
import type { Pack } from 'expo-app/features/packs';
import { packsStore } from 'expo-app/features/packs/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import type { GenerationRequest } from '../types';

const generatePacks = async (request: GenerationRequest): Promise<Pack[]> => {
  const { data, error } = await apiClient.packs['generate-packs'].post(request);
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to generate packs'));
    Sentry.captureException(err, {
      tags: { feature: 'ai-packs', action: 'generatePacks' },
      extra: { apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  // safe-cast: treaty response shape matches Pack[] as validated by the API schema
  return (data ?? []) as unknown as Pack[];
};

export function useGeneratePacks() {
  const mutation = useMutation({
    mutationFn: generatePacks,
    mutationKey: ['generatePacks'],
  });

  const generatedPacksFromStore = use$(() => {
    if (mutation.data) {
      return mutation.data.map((pack) => obs({ store: packsStore, id: pack.id }).get());
    }
    return [];
  });

  return { ...mutation, generatedPacksFromStore };
}
