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
  return useMutation<AnalyzeImageResponse, Error, { image: string; matchLimit?: number }>({
    mutationFn: async ({ image, matchLimit = 3 }) => {
      try {
        const response = await axiosInstance.post(
          '/api/packs/analyze-image',
          {
            image,
            matchLimit,
          },
          {
            timeout: 0,
          },
        );
        return response.data;
      } catch (error) {
        const { message } = handleApiError(error);
        throw new Error(`Failed to analyze image: ${message}`);
      }
    },
  });
}
