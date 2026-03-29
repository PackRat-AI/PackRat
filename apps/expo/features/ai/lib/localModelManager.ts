/**
 * Singleton manager for the on-device AI model.
 *
 * - On iOS 26+: uses @react-native-ai/apple (Apple Foundation Models, no download needed)
 * - On other devices: uses @react-native-ai/llama with SmolLM3-3B-GGUF
 *
 * Updates Jotai atoms via the global store so download progress is visible
 * from any component, even while the bottom sheet is closed.
 */

import { LlamaEngine, type LlamaLanguageModel, llama } from '@react-native-ai/llama';
import { store } from 'expo-app/atoms/store';
import { Platform } from 'react-native';
import {
  localModelErrorAtom,
  localModelProgressAtom,
  localModelStatusAtom,
} from '../atoms/aiModeAtoms';

const LLAMA_MODEL_ID = 'ggml-org/SmolLM3-3B-GGUF/SmolLM3-Q4_K_M.gguf';

// Module-level singletons — survive component unmounts
let llamaModel: LlamaLanguageModel | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appleModel: any = null;

export function isAppleModelSupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  const version =
    typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : Platform.Version;
  return version >= 26;
}

/** Returns the ready model instance, or null if not prepared yet. */
export function getLocalModel(): LlamaLanguageModel | null {
  if (isAppleModelSupported()) return appleModel;
  return llamaModel;
}

/** Check if the local model is already downloaded (llama only). */
export async function isLlamaModelDownloaded(): Promise<boolean> {
  return LlamaEngine.isDownloaded(LLAMA_MODEL_ID);
}

/**
 * Initialise the local model. For Apple this is instant; for llama this
 * only prepares an already-downloaded model — call `downloadLocalModel` first.
 */
export async function initLocalModel(): Promise<void> {
  const status = store.get(localModelStatusAtom);
  if (status === 'downloading' || status === 'preparing' || status === 'ready') return;

  store.set(localModelStatusAtom, 'checking');
  store.set(localModelErrorAtom, null);

  if (isAppleModelSupported()) {
    await _initAppleModel();
  } else {
    await _initLlamaModel();
  }
}

/**
 * Download the llama model (no-op on Apple). Safe to call if already downloaded;
 * will fast-path to prepare().
 */
export async function downloadLocalModel(): Promise<void> {
  if (isAppleModelSupported()) {
    // Apple model needs no download — just init
    await _initAppleModel();
    return;
  }

  const status = store.get(localModelStatusAtom);
  if (status === 'downloading' || status === 'preparing' || status === 'ready') return;

  store.set(localModelStatusAtom, 'checking');
  store.set(localModelErrorAtom, null);

  if (!llamaModel) {
    llamaModel = llama.languageModel(LLAMA_MODEL_ID, { n_ctx: 2048, n_gpu_layers: 99 });
  }

  const isDownloaded = await llamaModel.isDownloaded();

  if (!isDownloaded) {
    store.set(localModelStatusAtom, 'downloading');
    store.set(localModelProgressAtom, 0);
    try {
      await llamaModel.download((progress) => {
        store.set(localModelProgressAtom, Math.round(progress.percentage));
      });
    } catch (err) {
      store.set(localModelStatusAtom, 'error');
      store.set(localModelErrorAtom, err instanceof Error ? err.message : String(err));
      return;
    }
  }

  await _prepareLlamaModel();
}

/** Delete the downloaded llama model from disk. */
export async function deleteLocalModel(): Promise<void> {
  if (llamaModel) {
    try {
      await llamaModel.unload();
    } catch {
      // ignore unload errors
    }
    try {
      // LlamaLanguageModel has a remove() method that deletes from disk
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (llamaModel as any).remove?.();
    } catch {
      // ignore
    }
    llamaModel = null;
  }
  store.set(localModelStatusAtom, 'idle');
  store.set(localModelProgressAtom, 0);
}

// ─── private helpers ───────────────────────────────────────────────────────

async function _initAppleModel(): Promise<void> {
  store.set(localModelStatusAtom, 'preparing');
  try {
    const { apple } = await import('@react-native-ai/apple');
    appleModel = apple();
    store.set(localModelStatusAtom, 'ready');
  } catch (err) {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, 'Apple Foundation Model is not available on this device.');
  }
}

async function _initLlamaModel(): Promise<void> {
  if (!llamaModel) {
    llamaModel = llama.languageModel(LLAMA_MODEL_ID, { n_ctx: 2048, n_gpu_layers: 99 });
  }
  const isDownloaded = await llamaModel.isDownloaded();
  if (!isDownloaded) {
    // Not downloaded yet — surface idle so the UI shows the download button
    store.set(localModelStatusAtom, 'idle');
    return;
  }
  await _prepareLlamaModel();
}

async function _prepareLlamaModel(): Promise<void> {
  store.set(localModelStatusAtom, 'preparing');
  try {
    await llamaModel!.prepare();
    store.set(localModelStatusAtom, 'ready');
  } catch (err) {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, err instanceof Error ? err.message : String(err));
  }
}
