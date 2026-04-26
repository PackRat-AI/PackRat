import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { PackTemplateSchema, PackTemplateWithItemsSchema } from '@packrat/api/schemas/packTemplates';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackTemplate, PackTemplateInStore } from '../types';

const listPackTemplates = async () => {
  const { data, error } = await apiClient['pack-templates'].get();
  if (error) throw new Error(`Failed to list pack templates: ${error.value}`);
  return PackTemplateWithItemsSchema.array().parse(data);
};

const createPackTemplate = async (templateData: PackTemplate) => {
  const { data, error } = await apiClient['pack-templates'].post({
    id: templateData.id,
    name: templateData.name,
    category: templateData.category,
    ...(templateData.description !== undefined ? { description: templateData.description } : {}),
    ...(templateData.image ? { image: templateData.image } : {}),
    ...(templateData.tags !== undefined ? { tags: templateData.tags } : {}),
    ...(templateData.isAppTemplate !== undefined
      ? { isAppTemplate: templateData.isAppTemplate }
      : {}),
    localCreatedAt: templateData.localCreatedAt ?? new Date().toISOString(),
    localUpdatedAt: templateData.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create pack template: ${error.value}`);
  return PackTemplateSchema.parse(data);
};

const updatePackTemplate = async ({ id, ...data }: Partial<PackTemplate>) => {
  // Server's UpdatePackTemplateRequestSchema requires `description`, `image`,
  // `tags` to be present (they're nullable). Forward what we have, defaulting
  // to null when the field is omitted from the partial update.
  const { data: result, error } = await apiClient['pack-templates']({
    templateId: String(id),
  }).put({
    ...(data.name !== undefined ? { name: data.name } : {}),
    description: data.description ?? null,
    ...(data.category !== undefined ? { category: data.category } : {}),
    image: data.image ?? null,
    tags: data.tags ?? null,
    ...(data.isAppTemplate !== undefined ? { isAppTemplate: data.isAppTemplate } : {}),
    ...(data.deleted !== undefined ? { deleted: data.deleted } : {}),
    ...(data.localUpdatedAt ? { localUpdatedAt: data.localUpdatedAt } : {}),
  });
  if (error) throw new Error(`Failed to update pack template: ${error.value}`);
  return PackTemplateSchema.parse(result);
};

export const packTemplatesStore = observable<Record<string, PackTemplateInStore>>({});

syncObservable(
  packTemplatesStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'packTemplates',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listPackTemplates,
    create: createPackTemplate,
    update: updatePackTemplate,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

export const packTemplatesSyncState = syncState(packTemplatesStore);
export type PackTemplatesStore = typeof packTemplatesStore;
