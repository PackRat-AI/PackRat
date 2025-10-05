import { userStore } from 'expo-app/features/auth/store';
import axiosInstance from 'expo-app/lib/api/client';
import * as FileSystem from 'expo-file-system';

export const uploadImage = async (fileName: string, uri: string): Promise<string | undefined> => {
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
