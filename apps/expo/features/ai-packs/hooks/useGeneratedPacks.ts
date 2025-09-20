import { useMutation } from '@tanstack/react-query';
import type { Pack } from 'expo-app/features/packs';
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
  return useMutation({
    mutationFn: generatePacks,
    mutationKey: ['generatePacks'],
  });
}
