import { useMutation } from '@tanstack/react-query';
import type { SelectedImage } from 'expo-app/features/packs/hooks/useImagePicker';
import { uploadImage } from 'expo-app/features/packs/utils';
import axiosInstance from 'expo-app/lib/api/client';
import { identifyFromDescription } from '../lib/offlineIdentifier';
import type { IdentificationResult } from '../types';

interface OnlineIdentificationResponse {
  results: IdentificationResult[];
}

async function identifyOnline(selectedImage: SelectedImage): Promise<IdentificationResult[]> {
  const image = await uploadImage(selectedImage.fileName, selectedImage.uri);
  if (!image) {
    throw new Error("Couldn't upload image");
  }
  const response = await axiosInstance.post<OnlineIdentificationResponse>(
    '/api/wildlife/identify',
    { image },
    { timeout: 30000 },
  );
  return response.data.results;
}

export function useWildlifeIdentification() {
  return useMutation<
    IdentificationResult[],
    Error,
    { selectedImage: SelectedImage; offlineQuery?: string }
  >({
    mutationFn: async ({ selectedImage, offlineQuery }) => {
      try {
        return await identifyOnline(selectedImage);
      } catch {
        // Fall back to offline identification using image metadata / user query
        return identifyFromDescription(offlineQuery ?? selectedImage.fileName);
      }
    },
  });
}
