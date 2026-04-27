import { isObject } from '@packrat/guards';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';
import { obs } from 'app/lib/store';
import { isWeightUnit } from 'app/lib/utils/itemCalculations';
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
      const { data, error } = await apiClient['pack-templates'][
        'generate-from-online-content'
      ].post({
        contentUrl: input.contentUrl,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        isAppTemplate: input.isAppTemplate ?? false,
      });
      if (error) {
        // Treaty surfaces the parsed error body via `error.value`. When the
        // server returns a structured object (e.g. { code, existingTemplateId })
        // we extract it onto the thrown ImportError so callers can branch on
        // the duplicate-detection path.
        // safe-cast: treaty surfaces error.value as unknown; we probe its shape before use
        const value = error.value as
          | { error?: string; code?: string; existingTemplateId?: string }
          | string
          | null
          | undefined;
        const message = isObject(value) && value?.error ? value.error : (value ?? 'Import failed');
        // safe-cast: augmenting the base Error with ImportError fields assigned immediately below
        const importError = new Error(String(message)) as ImportError;
        importError.status = error.status;
        if (isObject(value)) {
          importError.code = value.code;
          importError.existingTemplateId = value.existingTemplateId;
        }
        throw importError;
      }
      // safe-cast: treaty response shape matches GeneratedTemplate as validated by the API schema
      return data as unknown as GeneratedTemplate;
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
