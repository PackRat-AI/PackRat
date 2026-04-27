import { userStore } from 'app/features/auth/store';
import { apiClient } from 'app/lib/api/packrat';
import * as FileSystem from 'expo-file-system/legacy';

export const uploadImage = async (fileName: string, uri: string): Promise<string | undefined> => {
  if (!fileName || fileName.trim() === '') {
    console.warn('Skipping upload: fileName is empty');
    return;
  }

  try {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    const remoteFileName = `${userStore.id.peek()}-${fileName}`;
    const { url: presignedUrl } = await getPresignedUrl(remoteFileName, type);

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
    throw err;
  }
};

const getPresignedUrl = async (fileName: string, contentType: string) => {
  const { data, error } = await apiClient.upload.presigned.get({
    query: { fileName, contentType },
  });
  if (error || !data) throw new Error(`Failed to get upload URL: ${error?.value}`);
  return data;
};
