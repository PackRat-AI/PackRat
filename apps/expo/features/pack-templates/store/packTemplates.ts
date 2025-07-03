import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import Storage from 'expo-sqlite/kv-store';
import type { PackTemplate, PackTemplateInStore } from '../types';

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
