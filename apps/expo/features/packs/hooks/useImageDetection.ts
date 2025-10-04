import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

export interface DetectedItem {
  name: string;
  description: string;
  quantity: number;
  category: string;
  confidence: number;
}

export interface CatalogMatch {
  id: number;
  name: string;
  description: string | null;
  weight: number | null;
  weightUnit: string | null;
  image: string | null;
  similarity: number;
}

export interface DetectedItemWithMatches {
  detected: DetectedItem;
  catalogMatches: CatalogMatch[];
}

export interface AnalyzeImageResponse {
  detectedItems: DetectedItemWithMatches[];
  summary: string;
}

export interface CreatePackFromImageResponse {
  pack: {
    id: string;
    name: string;
    description: string | null;
    itemsCount: number;
  };
  detectedItems: DetectedItemWithMatches[];
  summary: string;
}

/**
 * Hook to analyze an image and detect gear items
 */
export function useAnalyzeImage() {
  return useMutation<AnalyzeImageResponse, Error, { imageUrl: string; matchLimit?: number }>({
    mutationFn: async ({ imageUrl, matchLimit = 3 }) => {
      try {
        const response = await axiosInstance.post('/api/packs/analyze-image', {
          imageUrl,
          matchLimit,
        });
        return response.data;
      } catch (error) {
        const { message } = handleApiError(error);
        throw new Error(`Failed to analyze image: ${message}`);
      }
    },
  });
}

/**
 * Hook to create a pack from image analysis
 */
export function useCreatePackFromImage() {
  return useMutation<
    CreatePackFromImageResponse,
    Error,
    {
      imageUrl: string;
      packName: string;
      packDescription?: string;
      isPublic?: boolean;
      minConfidence?: number;
    }
  >({
    mutationFn: async ({
      imageUrl,
      packName,
      packDescription,
      isPublic = false,
      minConfidence = 0.5,
    }) => {
      try {
        const response = await axiosInstance.post('/api/packs/create-from-image', {
          imageUrl,
          packName,
          packDescription,
          isPublic,
          minConfidence,
        });
        return response.data;
      } catch (error) {
        const { message } = handleApiError(error);
        throw new Error(`Failed to create pack from image: ${message}`);
      }
    },
  });
}
