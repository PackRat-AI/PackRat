// Web stub for expo-file-system/legacy.
// File system APIs are native-only; all operations are no-ops on web.

export const documentDirectory = '';
export const cacheDirectory = '';
export const bundleDirectory = '';

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export const FileSystemUploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
} as const;

export const FileSystemSessionType = {
  BACKGROUND: 0,
  FOREGROUND: 1,
} as const;

export async function getInfoAsync(_uri: string) {
  return { exists: false, isDirectory: false, uri: _uri, size: 0, modificationTime: 0 };
}

export async function readAsStringAsync(_uri: string) {
  return '';
}

export async function writeAsStringAsync(_uri: string, _contents: string) {}

export async function deleteAsync(_uri: string) {}

export async function moveAsync(_options: { from: string; to: string }) {}

export async function copyAsync(_options: { from: string; to: string }) {}

export async function makeDirectoryAsync(_uri: string, _options?: { intermediates?: boolean }) {}

export async function readDirectoryAsync(_uri: string): Promise<string[]> {
  return [];
}

// biome-ignore lint/complexity/useMaxParams: matches expo-file-system API signature
export async function downloadAsync(
  _uri: string,
  _fileUri: string,
  _options?: object,
): Promise<{ status: number; uri: string; headers: Record<string, string>; mimeType: string }> {
  return { status: 200, uri: _fileUri, headers: {}, mimeType: '' };
}

// biome-ignore lint/complexity/useMaxParams: matches expo-file-system API signature
export async function uploadAsync(
  _url: string,
  _fileUri: string,
  _options?: object,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  console.warn('FileSystem.uploadAsync is not supported on web');
  return { status: 200, body: '', headers: {} };
}

export async function createDownloadResumable() {
  return {
    downloadAsync: async () => ({ status: 200, uri: '', headers: {}, mimeType: '' }),
    pauseAsync: async () => {},
    resumeAsync: async () => {},
    savable: () => ({ url: '', fileUri: '', options: {}, resumeData: '' }),
  };
}
