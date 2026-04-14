import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackTemplate, PackTemplateInStore } from '../types';

const listPackTemplates = async () => {
  const { data, error } = await apiClient['pack-templates'].get();
  if (error) throw new Error(`Failed to list pack templates: ${error.value}`);
  return data as object[] | null;
};

const createPackTemplate = async (templateData: PackTemplate) => {
  const { data, error } = await apiClient['pack-templates'].post(templateData as never);
  if (error) throw new Error(`Failed to create pack template: ${error.value}`);
  return data as object | null;
};

const updatePackTemplate = async ({ id, ...data }: Partial<PackTemplate>) => {
  const { data: result, error } = await apiClient['pack-templates']({
    templateId: String(id),
  }).put(data as never);
  if (error) throw new Error(`Failed to update pack template: ${error.value}`);
  return result as object | null;
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
      // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage
      // classes are structurally identical but nominally different (TS2345). The
      // cast dedupes at the type level until the nested dep is hoisted out.
      // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above
      plugin: observablePersistSqlite(Storage as any),
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
