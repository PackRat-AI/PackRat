import { use$ } from '@legendapp/state/react';
import { useMutation } from '@tanstack/react-query';
import type { Pack } from 'expo-app/features/packs';
import { packsStore } from 'expo-app/features/packs/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import type { GenerationRequest } from '../types';

const generatePacks = async (request: GenerationRequest): Promise<Pack[]> => {
  const { data, error } = await apiClient.packs['generate-packs'].post(request);
  if (error) throw new Error(`Failed to generate packs: ${error.value}`);
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
