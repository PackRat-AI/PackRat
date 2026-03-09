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
    throw new Error(
      `Couldn't upload image${selectedImage.fileName ? ` "${selectedImage.fileName}"` : ' (no filename provided)'}`,
    );
  }
  const response = await axiosInstance.post<OnlineIdentificationResponse>(
    '/api/wildlife/identify',
    { image },
    { timeout: 30000 },
  );
  return response.data.results;
}

function isNetworkError(error: unknown): boolean {
  // Primitives and null are not classifiable as network errors
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  // If there's a server response the request reached the server – not a network error
  if ('response' in error && (error as { response?: unknown }).response != null) {
    return false;
  }

  // Check Axios-specific error codes that unambiguously indicate network issues
  if ('code' in error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'ERR_NETWORK' ||
      code === 'ECONNABORTED' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT'
    ) {
      return true;
    }
  }

  // Error instances: check message for network patterns, but be conservative —
  // only match messages that clearly indicate connectivity issues, not server-side timeouts.
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network error') ||
      msg.includes('econnrefused') ||
      msg.includes('failed to fetch') ||
      msg.includes('no internet')
    );
  }

  // Unknown non-Error object shapes without a response: don't assume network error
  return false;
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
          const trimmed = offlineQuery?.trim();
          const queryText = trimmed ? trimmed : selectedImage.fileName;
          return identifyFromDescription(queryText);
        }
        throw error;
      }
    },
  });
}
