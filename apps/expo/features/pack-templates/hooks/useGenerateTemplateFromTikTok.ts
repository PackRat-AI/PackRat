import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { packTemplateItemsStore } from '../store/packTemplateItems';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplateInStore } from '../types';

export interface GenerateFromTikTokInput {
  tiktokUrl: string;
  imageUrls: string[];
  caption?: string;
  name?: string;
  category?: string;
  isAppTemplate?: boolean;
}

export interface GeneratedTemplate extends PackTemplateInStore {
  items: Array<{
    id: string;
    packTemplateId: string;
    name: string;
    description?: string | null;
    weight: number;
    weightUnit: string;
    quantity: number;
    category?: string | null;
    consumable: boolean;
    worn: boolean;
    image?: string | null;
    notes?: string | null;
    catalogItemId?: number | null;
    userId: number;
    deleted: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface TikTokImportError extends Error {
  status?: number;
  code?: string;
  existingTemplateId?: string;
}

export function useGenerateTemplateFromTikTok() {
  return useMutation<GeneratedTemplate, TikTokImportError, GenerateFromTikTokInput>({
    mutationFn: async (input) => {
      try {
        const response = await axiosInstance.post(
          '/api/pack-templates/generate-from-tiktok',
          input,
          { timeout: 0 },
        );
        return response.data;
      } catch (error) {
        const { message, status } = handleApiError(error);

        // Extract error code and additional data from API response
        let errorCode: string | undefined;
        let existingTemplateId: string | undefined;

        if (error && typeof error === 'object' && 'response' in error) {
          const errorData = (
            error as { response?: { data?: { code?: string; existingTemplateId?: string } } }
          ).response?.data;
          if (errorData) {
            errorCode = errorData.code;
            existingTemplateId = errorData.existingTemplateId;
          }
        }

        const tikTokError = new Error(
          `Failed to generate template from TikTok: ${message}`,
        ) as TikTokImportError;
        tikTokError.status = status;
        tikTokError.code = errorCode;
        tikTokError.existingTemplateId = existingTemplateId;

        throw tikTokError;
      }
    },
    onSuccess: (data) => {
      const { items, ...template } = data;
      // @ts-ignore: Safe because Legend-State uses Proxy
      packTemplatesStore[template.id].set(template);
      for (const item of items) {
        // @ts-ignore: Safe because Legend-State uses Proxy
        packTemplateItemsStore[item.id].set(item);
      }
    },
  });
}
