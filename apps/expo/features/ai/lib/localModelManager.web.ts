/**
 * Web no-op stub for localModelManager.
 * On-device AI models (llama.rn, @react-native-ai/apple) are native-only.
 * Metro automatically picks this file over localModelManager.ts for web builds.
 */

export const localModelManager = {
  loadModel: async () => undefined,
  unloadModel: async () => undefined,
  generateText: async () => '',
  isModelLoaded: () => false,
  getModelPath: () => null,
  downloadModel: async () => undefined,
  cancelDownload: () => undefined,
};
