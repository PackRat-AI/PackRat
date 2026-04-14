import { useMutation } from '@tanstack/react-query';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { apiClient } from 'expo-app/lib/api/packrat';
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
      const { data, error } = await apiClient.packs['analyze-image'].post({
        image,
        matchLimit,
      });
      if (error) throw new Error(`Failed to analyze image: ${error.value}`);
      return data as unknown as AnalyzeImageResponse;
    },
  });
}
