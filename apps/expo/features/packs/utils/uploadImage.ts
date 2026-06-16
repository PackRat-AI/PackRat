import * as Sentry from '@sentry/react-native';
import { userStore } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import * as FileSystem from 'expo-file-system/legacy';

export const uploadImage = async ({
  fileName,
  uri,
}: {
  fileName: string;
  uri: string;
}): Promise<string | undefined> => {
  if (!fileName || fileName.trim() === '') {
    console.warn('Skipping upload: fileName is empty');
    return;
  }

  try {
    const userId = userStore.id.peek();
    if (!userId) throw new Error('Cannot upload: user not authenticated');
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    const remoteFileName = `${userId}-${fileName}`;
    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Starting image upload',
      level: 'info',
      data: { fileName, type },
    });
    const { url: presignedUrl } = await getPresignedUrl({
      fileName: remoteFileName,
      contentType: type,
    });

    const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': type,
      },
    });

    if (uploadResult.status >= 300) {
      throw new Error(`Upload failed with status: ${uploadResult.status}`);
    }
    return remoteFileName;
  } catch (err) {
    console.error('Error uploading image:', err);
    Sentry.captureException(err, {
      tags: { feature: 'upload', action: 'uploadImage' },
      extra: { fileName },
    });
    throw err;
  }
};

const getPresignedUrl = async ({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: string;
}) => {
  const { data, error } = await apiClient.upload.presigned.get({
    query: { fileName, contentType },
  });
  if (error || !data) {
    const err = new Error(`Failed to get upload URL: ${String(error?.value ?? 'no data')}`);
    Sentry.captureException(err, {
      tags: { feature: 'upload', action: 'getPresignedUrl' },
      extra: { fileName, contentType, apiError: error?.value, httpStatus: error?.status },
    });
    throw err;
  }
  return data;
};
