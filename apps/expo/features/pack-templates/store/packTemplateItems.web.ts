import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { PackTemplate, PackTemplateItem } from '../types';

/**
 * Web version of packTemplateItems store.
 * Removes expo-sqlite persistence — data is fetched from the API and kept in memory.
 * Metro automatically picks this file over packTemplateItems.ts for web builds.
 */

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

export const packTemplateItemsStore = observable<Record<string, PackTemplateItem>>({});

syncObservable(
  packTemplateItemsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    updatePartial: true,
    mode: 'merge',
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
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000);
      return () => clearInterval(intervalId);
    },
  }),
);

export function getTemplateItems(templateId: string): PackTemplateItem[] {
  return Object.values(packTemplateItemsStore.get()).filter(
    (item) => item.packTemplateId === templateId && !item.deleted,
  );
}

export const packTemplateItemsSyncState = syncState(packTemplateItemsStore);
export type PackTemplateItemsStore = typeof packTemplateItemsStore;
