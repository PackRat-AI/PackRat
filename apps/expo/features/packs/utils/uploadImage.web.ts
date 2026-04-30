/**
 * Web version of uploadImage.
 * Uses the browser Fetch API to upload images via a presigned URL.
 * The caller obtains a presigned URL from the API (same as the native flow)
 * but the binary upload uses fetch instead of expo-file-system.
 */
import { userStore } from 'expo-app/features/auth/store';
import axiosInstance from 'expo-app/lib/api/client';

export const uploadImage = async (fileName: string, blobOrDataUrl: string): Promise<string | undefined> => {
  if (!fileName || fileName.trim() === '') {
    console.warn('Skipping upload: fileName is empty');
    return;
  }

  try {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    const remoteFileName = `${userStore.id.peek()}-${fileName}`;

    const { url: presignedUrl } = await getPresignedUrl(remoteFileName, type);

    // Convert data URL / blob URL to a Blob for upload
    const blob = await urlToBlob(blobOrDataUrl, type);

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': type },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    return remoteFileName;
  } catch (err) {
    console.error('Error uploading image:', err);
    throw err;
  }
};

const getPresignedUrl = async (
  fileName: string,
  contentType: string,
): Promise<{ url: string; publicUrl: string; objectKey: string }> => {
  const response = await axiosInstance.get(
    `/api/upload/presigned?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`,
  );
  return {
    url: response.data.url,
    publicUrl: response.data.publicUrl,
    objectKey: response.data.objectKey,
  };
};

async function urlToBlob(url: string, type: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const arr = url.split(',');
    const bstr = atob(arr[1] ?? '');
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type });
  }
  // blob: URL or http URL — fetch it
  const res = await fetch(url);
  return res.blob();
}
