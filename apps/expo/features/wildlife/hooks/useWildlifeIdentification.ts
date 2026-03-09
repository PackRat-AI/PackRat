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

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('failed to fetch') ||
      msg.includes('no internet')
    );
  }
  // Axios network errors typically have no response
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return false; // Has a server response – not a network error
  }
  return true;
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
      } catch (error) {
        // Only fall back to offline identification for network/connectivity errors.
        // Authorization errors, validation failures, etc. are re-thrown.
        if (isNetworkError(error)) {
          console.warn('Online identification unavailable, using offline database:', {
            code: (error as { code?: string })?.code,
            message: error instanceof Error ? error.message : undefined,
          });
          const queryText = offlineQuery?.trim() || selectedImage.fileName;
          return identifyFromDescription(queryText);
        }
        throw error;
      }
    },
  });
}
