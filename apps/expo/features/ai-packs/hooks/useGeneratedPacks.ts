import { use$ } from '@legendapp/state/react';
import { useMutation } from '@tanstack/react-query';
import type { Pack } from 'expo-app/features/packs';
import { packsStore } from 'expo-app/features/packs/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { GenerationRequest } from '../types';

const generatePacks = async (request: GenerationRequest): Promise<Pack[]> => {
  try {
    const response = await axiosInstance.post('/api/packs/generate-packs', request, {
      timeout: 0,
    });
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to generate packs: ${message}`);
  }
};

export function useGeneratePacks() {
  const mutation = useMutation({
    mutationFn: generatePacks,
    mutationKey: ['generatePacks'],
  });

  const generatedPacksFromStore = use$(() => {
    if (mutation.data) {
      return mutation.data.map((pack) =>
        // @ts-ignore: Safe because Legend-State uses Proxy
        packsStore[pack.id].get(),
      );
    }
    return [];
  });

  return { ...mutation, generatedPacksFromStore };
}
