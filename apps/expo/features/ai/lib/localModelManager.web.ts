/**
 * Web no-op stub for localModelManager.
 * On-device AI models (llama.rn, @react-native-ai/apple) are native-only.
 * Metro automatically picks this file over localModelManager.ts for web builds.
 */

export function isAppleIntelligenceAvailable(): boolean {
  return false;
}

export function getLocalModel(): null {
  return null;
}

export async function isLlamaModelDownloaded(): Promise<boolean> {
  return false;
}

export async function initLocalModel(): Promise<void> {}

export async function downloadLocalModel(): Promise<void> {}

export async function cancelLocalModelDownload(): Promise<void> {}

export async function deleteLocalModel(): Promise<void> {}
