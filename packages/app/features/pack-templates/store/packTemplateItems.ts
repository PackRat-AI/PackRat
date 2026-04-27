import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import {
  PackTemplateItemSchema,
  PackTemplateWithItemsSchema,
} from '@packrat/api/schemas/packTemplates';
import { isAuthed } from 'app/features/auth/store';
import { apiClient } from 'app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { PackTemplateItem } from '../types';

const listAllPackTemplateItems = async (): Promise<PackTemplateItem[]> => {
  const { data, error } = await apiClient['pack-templates'].get();
  if (error) throw new Error(`Failed to list PackTemplateItems: ${error.value}`);
  return (
    PackTemplateWithItemsSchema.array()
      .parse(data)
      // safe-cast: Zod parse validates the shape; PackTemplateItem extends the Zod-inferred type
      .flatMap((template) => template.items) as unknown as PackTemplateItem[]
  );
};

const createPackTemplateItem = async (item: PackTemplateItem): Promise<PackTemplateItem> => {
  const { data, error } = await apiClient['pack-templates']({
    templateId: String(item.packTemplateId),
  }).items.post({
    id: item.id,
    name: item.name,
    weight: item.weight,
    weightUnit: item.weightUnit,
    quantity: item.quantity ?? 1,
    consumable: item.consumable ?? false,
    worn: item.worn ?? false,
    description: item.description,
    category: item.category,
    image: item.image ?? null,
    notes: item.notes,
  });
  if (error) throw new Error(`Failed to create pack template item: ${error.value}`);
  // safe-cast: Zod parse validates the shape; PackTemplateItem extends the Zod-inferred type
  return PackTemplateItemSchema.parse(data) as unknown as PackTemplateItem;
};

const updatePackTemplateItem = async ({
  id,
  ...data
}: Partial<PackTemplateItem>): Promise<PackTemplateItem> => {
  const { data: result, error } = await apiClient['pack-templates']
    .items({
      itemId: String(id),
    })
    .patch({
      name: data.name,
      description: data.description,
      weight: data.weight,
      weightUnit: data.weightUnit,
      quantity: data.quantity,
      category: data.category,
      consumable: data.consumable,
      worn: data.worn,
      // Server's update schema expects `image?: string | undefined` (no null);
      // coerce nulls to undefined.
      image: data.image ?? undefined,
      notes: data.notes,
      deleted: data.deleted,
    });
  if (error) throw new Error(`Failed to update pack template item: ${error.value}`);
  // safe-cast: Zod parse validates the shape; PackTemplateItem extends the Zod-inferred type
  return PackTemplateItemSchema.parse(result) as unknown as PackTemplateItem;
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
