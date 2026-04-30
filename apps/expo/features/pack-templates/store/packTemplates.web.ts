import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { PackTemplate, PackTemplateInStore } from '../types';

/**
 * Web version of packTemplates store.
 * Removes expo-sqlite persistence — data is fetched from the API and kept in memory.
 * Metro automatically picks this file over packTemplates.ts for web builds.
 */

const listPackTemplates = async () => {
  try {
    const res = await axiosInstance.get('/api/pack-templates');
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list pack templates: ${message}`);
  }
};

const createPackTemplate = async (templateData: PackTemplate) => {
  try {
    const response = await axiosInstance.post('/api/pack-templates', templateData);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create pack template: ${message}`);
  }
};

const updatePackTemplate = async ({ id, ...data }: Partial<PackTemplate>) => {
  try {
    const response = await axiosInstance.put(`/api/pack-templates/${id}`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update pack template: ${message}`);
  }
};

export const packTemplatesStore = observable<Record<string, PackTemplateInStore>>({});

syncObservable(
  packTemplatesStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    mode: 'merge',
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
