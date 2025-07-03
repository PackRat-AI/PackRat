import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import Storage from 'expo-sqlite/kv-store';
import { isAuthed } from '~/features/auth/store';
import axiosInstance, { handleApiError } from '~/lib/api/client';
import type { PackTemplate, PackTemplateItem } from '../types';

// API: List all pack template items by flattening all items from pack templates
const listAllPackTemplateItems = async (): Promise<PackTemplateItem[]> => {
  try {
    const res = await axiosInstance.get<PackTemplate[]>('/api/pack-templates');
    const packTemplateItems = res.data.flatMap((template: PackTemplate) => template.items);
    return packTemplateItems;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list PackTemplateItems: ${message}`);
  }
};

// API: Create a new pack template item
const createPackTemplateItem = async ({
  packTemplateId,
  ...itemData
}: PackTemplateItem): Promise<PackTemplateItem> => {
  try {
    const response = await axiosInstance.post(
      `/api/pack-templates/${packTemplateId}/items`,
      itemData,
    );
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create pack template item: ${message}`);
  }
};

// API: Update a pack template item
const updatePackTemplateItem = async ({
  id,
  ...data
}: Partial<PackTemplateItem>): Promise<PackTemplateItem> => {
  try {
    const response = await axiosInstance.patch(`/api/pack-templates/items/${id}`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update pack template item: ${message}`);
  }
};

// Local observable store
export const packTemplateItemsStore = observable<Record<string, PackTemplateItem>>({});

// Synchronize observable store with server
syncObservable(
  packTemplateItemsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    updatePartial: true,
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'packTemplateItems',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listAllPackTemplateItems,
    create: createPackTemplateItem,
    update: updatePackTemplateItem,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

// 🔍 Helper: Get all non-deleted items for a specific template
export function getTemplateItems(templateId: string): PackTemplateItem[] {
  return Object.values(packTemplateItemsStore.get()).filter(
    (item) => item.packTemplateId === templateId && !item.deleted,
  );
}

// Export sync state and store type
export const packTemplateItemsSyncState = syncState(packTemplateItemsStore);
export type PackTemplateItemsStore = typeof packTemplateItemsStore;
