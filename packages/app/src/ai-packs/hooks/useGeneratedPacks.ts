import { use$ } from '@legendapp/state/react';
import type { GenerationRequest } from '@packrat/app/ai-packs';
import type { Pack } from '@packrat/app/packs';
import { packsStore } from '@packrat/app/packs/store';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';

const generatePacks = async (request: GenerationRequest): Promise<Pack[]> => {
  const { data, error } = await apiClient.packs['generate-packs'].post(request);
  if (error) throw new Error(`Failed to generate packs: ${error.value}`);
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
      return mutation.data.map((pack) => obs(packsStore, pack.id).get());
    }
    return [];
  });

  return { ...mutation, generatedPacksFromStore };
}
