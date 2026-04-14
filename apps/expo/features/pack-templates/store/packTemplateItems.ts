import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackTemplate, PackTemplateItem } from '../types';

const listAllPackTemplateItems = async (): Promise<PackTemplateItem[]> => {
  const { data, error } = await apiClient['pack-templates'].get();
  if (error) throw new Error(`Failed to list PackTemplateItems: ${error.value}`);
  return ((data as unknown as PackTemplate[]) ?? []).flatMap((template) => template.items);
};

const createPackTemplateItem = async ({
  packTemplateId,
  ...itemData
}: PackTemplateItem): Promise<PackTemplateItem> => {
  const { data, error } = await apiClient['pack-templates']({
    templateId: String(packTemplateId),
  }).items.post(itemData as never);
  if (error) throw new Error(`Failed to create pack template item: ${error.value}`);
  return data as unknown as PackTemplateItem;
};

const updatePackTemplateItem = async ({
  id,
  ...data
}: Partial<PackTemplateItem>): Promise<PackTemplateItem> => {
  const { data: result, error } = await apiClient['pack-templates']
    .items({
      itemId: String(id),
    })
    .patch(data as never);
  if (error) throw new Error(`Failed to update pack template item: ${error.value}`);
  return result as unknown as PackTemplateItem;
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
      // legend-state ships a nested copy of expo-sqlite; the two SQLiteStorage
      // classes are structurally identical but nominally different (TS2345). The
      // cast dedupes at the type level until the nested dep is hoisted out.
      // biome-ignore lint/suspicious/noExplicitAny: duplicate expo-sqlite install — see comment above
      plugin: observablePersistSqlite(Storage as any),
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
