import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed, userStore } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import * as FileSystem from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import type { Pack, PackItem } from '../types';

// Function to get a presigned URL for uploading
const getPresignedUrl = async (
  fileName: string,
  contentType: string,
): Promise<{ url: string; publicUrl: string; objectKey: string }> => {
  try {
    const response = await axiosInstance.get(
      `/api/upload/presigned?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`,
    );
    return {
      url: response.data.url,
      publicUrl: response.data.publicUrl,
      objectKey: response.data.objectKey,
    };
  } catch (err) {
    console.error('Error getting presigned URL:', err);
    throw new Error('Failed to get upload URL');
  }
};

// Upload the image to R2
const uploadImage = async (fileName: string): Promise<void> => {
  if (!fileName || fileName.trim() === '') {
    console.warn('Skipping upload: fileName is empty');
    return;
  }

  try {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    const remoteFileName = `${userStore.id.peek()}-${fileName}`;
    // Get presigned URL
    const { url: presignedUrl } = await getPresignedUrl(remoteFileName, type);

    // Upload the image
    const uploadResult = await FileSystem.uploadAsync(
      presignedUrl,
      `${ImageCacheManager.cacheDirectory}${fileName}`,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': type,
        },
      },
    );

    if (uploadResult.status >= 300) {
      throw new Error(`Upload failed with status: ${uploadResult.status}`);
    }
  } catch (err) {
    console.error('Error uploading image:', err);
    throw err;
  }
};

const listAllPackItems = async () => {
  try {
    const res = await axiosInstance.get<Pack[]>('/api/packs');
    const items = res.data.flatMap((pack: Pack) => pack.items);
    return items;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list packitems: ${message}`);
  }
};

const createPackItem = async ({ packId, ...data }: PackItem) => {
  try {
    if (data.image) {
      await uploadImage(data.image);
    }

    const response = await axiosInstance.post(`/api/packs/${packId}/items`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create pack item: ${message}`);
  }
};

const updatePackItem = async ({ id, ...data }: PackItem) => {
  try {
    if (data.image) {
      await uploadImage(data.image);
    }
    const response = await axiosInstance.patch(`/api/packs/items/${id}`, data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update pack: ${message}`);
  }
};

export const packItemsStore = observable<Record<string, PackItem>>({});

syncObservable(
  packItemsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    updatePartial: true,
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'packItems',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true, // Keep retrying until it saves
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listAllPackItems,
    create: createPackItem,
    update: updatePackItem,
    changesSince: 'last-sync',
    subscribe: ({ refresh }) => {
      const intervalId = setInterval(() => {
        refresh();
      }, 30000); // 30 seconds interval

      return () => {
        clearInterval(intervalId);
      };
    },
  }),
);

export function getPackItems(id: string) {
  return Object.values(packItemsStore.get()).filter((item) => item.packId === id && !item.deleted);
}

export const packItemsSyncState = syncState(packItemsStore);

export type PackItemsStore = typeof packItemsStore;
