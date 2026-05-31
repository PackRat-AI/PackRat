/**
 * Web version of uploadImage.
 * Uses the browser Fetch API to upload images via a presigned URL.
 * The caller obtains a presigned URL from the API (same as the native flow)
 * but the binary upload uses fetch instead of expo-file-system.
 */
import { userStore } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';

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
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    const remoteFileName = `${userStore.id.peek()}-${fileName}`;

    const { url: presignedUrl } = await getPresignedUrl({
      fileName: remoteFileName,
      contentType: type,
    });

    // Convert data URL / blob URL to a Blob for upload
    const blob = await urlToBlob({ url: uri, type });

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

const getPresignedUrl = async ({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: string;
}): Promise<{ url: string; publicUrl: string; objectKey: string }> => {
  const { data, error } = await apiClient.upload.presigned.get({
    query: { fileName, contentType },
  });
  if (error || !data) throw new Error(`Failed to get upload URL: ${error?.value}`);
  return data;
};

async function urlToBlob({ url, type }: { url: string; type: string }): Promise<Blob> {
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
