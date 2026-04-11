import { useMutation } from '@tanstack/react-query';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { uploadImage } from '../utils';
import type { SelectedImage } from './useImagePicker';

export interface DetectedItem {
  name: string;
  description: string;
  quantity: number;
  category: string;
  consumable: boolean;
  worn: boolean;
  notes: string;
  confidence: number;
}

export interface DetectedItemWithMatches {
  detected: DetectedItem;
  catalogMatches: (CatalogItem & { similarity: number })[];
}

export type AnalyzeImageResponse = DetectedItemWithMatches[];

/**
 * Hook to analyze an image and detect gear items
 */
export function useImageDetection() {
  return useMutation<
    AnalyzeImageResponse,
    Error,
    { selectedImage: SelectedImage; matchLimit?: number }
  >({
    mutationFn: async ({ selectedImage, matchLimit = 3 }) => {
      const image = await uploadImage(selectedImage.fileName, selectedImage.uri);
      if (!image) {
        throw new Error("Couldn't upload image");
      }
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
