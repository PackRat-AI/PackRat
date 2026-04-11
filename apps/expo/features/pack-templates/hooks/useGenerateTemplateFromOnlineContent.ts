import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { obs } from 'expo-app/lib/store';
import { isWeightUnit } from 'expo-app/lib/utils/itemCalculations';
import { packTemplateItemsStore } from '../store/packTemplateItems';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplateInStore, PackTemplateItem } from '../types';

export interface GenerateFromOnlineContentInput {
  contentUrl: string;
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

export interface ImportError extends Error {
  status?: number;
  code?: string;
  existingTemplateId?: string;
}

export function useGenerateTemplateFromOnlineContent() {
  return useMutation<GeneratedTemplate, ImportError, GenerateFromOnlineContentInput>({
    mutationFn: async (input) => {
      try {
        const response = await axiosInstance.post(
          '/api/pack-templates/generate-from-online-content',
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
            error as {
              response?: {
                data?: {
                  code?: string;
                  existingTemplateId?: string;
                };
              };
            }
          ).response?.data;
          if (errorData) {
            errorCode = errorData.code;
            existingTemplateId = errorData.existingTemplateId;
          }
        }

        const importError = new Error(message) as ImportError;
        importError.status = status;
        importError.code = errorCode;
        importError.existingTemplateId = existingTemplateId;

        throw importError;
      }
    },
    onSuccess: (data) => {
      const { items, ...template } = data;
      obs(packTemplatesStore, template.id).set(template);
      for (const item of items) {
        if (!isWeightUnit(item.weightUnit)) {
          throw new Error(`Unsupported weightUnit "${item.weightUnit}" for item ${item.id}`);
        }
        const storeItem: PackTemplateItem = {
          id: item.id,
          packTemplateId: item.packTemplateId,
          name: item.name,
          description: item.description ?? undefined,
          weight: item.weight,
          weightUnit: item.weightUnit,
          quantity: item.quantity,
          category: item.category ?? '',
          consumable: item.consumable,
          worn: item.worn,
          image: item.image ?? undefined,
          notes: item.notes ?? undefined,
          catalogItemId: item.catalogItemId ?? undefined,
          userId: item.userId,
          deleted: item.deleted,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
        obs(packTemplateItemsStore, item.id).set(storeItem);
      }
    },
  });
}
