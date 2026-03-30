/**
 * Singleton manager for the on-device AI model.
 *
 * - On iOS 26+: uses @react-native-ai/apple (Apple Foundation Models, no download needed)
 * - On other devices: uses @react-native-ai/llama with SmolLM3-3B-GGUF
 *
 * Updates Jotai atoms via the global store so download progress is visible
 * from any component, even while the bottom sheet is closed.
 */

import { type LlamaLanguageModel, llama } from '@react-native-ai/llama';
import { store } from 'expo-app/atoms/store';
import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import {
  localModelErrorAtom,
  localModelFileAvailableAtom,
  localModelProgressAtom,
  localModelStatusAtom,
} from '../atoms/aiModeAtoms';

import { LLAMA_MODEL_ID, LLAMA_MODEL_SIZE_BYTES } from './constants';

const LLAMA_MODEL_FILENAME = 'SmolLM3-Q4_K_M.gguf';
const LLAMA_MODELS_DIR = `${RNBlobUtil.fs.dirs.DocumentDir}/llama-models`;

function _getLlamaModelPath(): string {
  return `${LLAMA_MODELS_DIR}/${LLAMA_MODEL_FILENAME}`;
}

function _getLlamaDownloadUrl(): string {
  const parts = LLAMA_MODEL_ID.split('/');
  const filename = parts[parts.length - 1];
  const repo = parts.slice(0, -1).join('/');
  return `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;
}

/**
 * Returns true only if the model file exists on disk AND its size matches
 * the expected byte count, ruling out partial downloads.
 */
async function _isLlamaModelAvailable(): Promise<boolean> {
  const path = _getLlamaModelPath();
  const exists = await RNBlobUtil.fs.exists(path);
  if (!exists) return false;
  const stat = await RNBlobUtil.fs.stat(path);
  return Number(stat.size) === LLAMA_MODEL_SIZE_BYTES;
}

// Module-level singletons — survive component unmounts
let llamaModel: LlamaLanguageModel | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appleModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDownloadTask: any = null;
let _isCancellingDownload = false;

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

/** Check if the local model file is fully present on disk (existence + size). */
export async function isLlamaModelDownloaded(): Promise<boolean> {
  return _isLlamaModelAvailable();
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

  const isAvailable = await _isLlamaModelAvailable();

  if (!isAvailable) {
    // Remove any partial download so the library starts fresh
    const path = _getLlamaModelPath();
    const partialExists = await RNBlobUtil.fs.exists(path);
    if (partialExists) {
      await RNBlobUtil.fs.unlink(path);
    }

    store.set(localModelStatusAtom, 'downloading');
    store.set(localModelProgressAtom, 0);
    try {
      const dirExists = await RNBlobUtil.fs.exists(LLAMA_MODELS_DIR);
      if (!dirExists) {
        await RNBlobUtil.fs.mkdir(LLAMA_MODELS_DIR);
      }
      activeDownloadTask = RNBlobUtil.config({ path: _getLlamaModelPath(), fileCache: true }).fetch(
        'GET',
        _getLlamaDownloadUrl(),
      );
      activeDownloadTask.progress((received: number, total: number) => {
        store.set(localModelProgressAtom, Math.round((Number(received) / Number(total)) * 100));
      });
      await activeDownloadTask;
      activeDownloadTask = null;
    } catch (err) {
      activeDownloadTask = null;
      if (_isCancellingDownload) return;
      store.set(localModelStatusAtom, 'error');
      store.set(localModelErrorAtom, err instanceof Error ? err.message : String(err));
      return;
    }
  }

  await _prepareLlamaModel();
}

/** Cancel an in-progress llama model download and reset state to idle. */
export async function cancelLocalModelDownload(): Promise<void> {
  _isCancellingDownload = true;
  if (activeDownloadTask) {
    activeDownloadTask.cancel();
    activeDownloadTask = null;
  }
  store.set(localModelStatusAtom, 'idle');
  store.set(localModelProgressAtom, 0);
  store.set(localModelErrorAtom, null);
  // Remove any partial file left by the cancelled download
  const path = _getLlamaModelPath();
  try {
    const exists = await RNBlobUtil.fs.exists(path);
    if (exists) {
      await RNBlobUtil.fs.unlink(path);
    }
  } catch {
    // ignore
  }
  _isCancellingDownload = false;
}

/** Delete the downloaded llama model from disk. */
export async function deleteLocalModel(): Promise<void> {
  if (llamaModel) {
    try {
      await llamaModel.unload();
    } catch {
      // ignore unload errors
    }
    llamaModel = null;
  }

  // Direct filesystem deletion — more reliable than the library's remove()
  const path = _getLlamaModelPath();
  try {
    const exists = await RNBlobUtil.fs.exists(path);
    if (exists) {
      await RNBlobUtil.fs.unlink(path);
    }
  } catch {
    // ignore deletion errors
  }

  store.set(localModelStatusAtom, 'idle');
  store.set(localModelFileAvailableAtom, false);
  store.set(localModelProgressAtom, 0);
}

// ─── private helpers ───────────────────────────────────────────────────────

async function _initAppleModel(): Promise<void> {
  store.set(localModelStatusAtom, 'preparing');
  try {
    const { apple } = await import('@react-native-ai/apple');
    appleModel = apple();
    store.set(localModelStatusAtom, 'ready');
  } catch {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, 'Apple Foundation Model is not available on this device.');
  }
}

async function _initLlamaModel(): Promise<void> {
  if (!llamaModel) {
    llamaModel = llama.languageModel(LLAMA_MODEL_ID, { n_ctx: 2048, n_gpu_layers: 99 });
  }
  const isAvailable = await _isLlamaModelAvailable();
  store.set(localModelFileAvailableAtom, isAvailable);
  if (!isAvailable) {
    // Not fully downloaded yet — surface idle so the UI shows the download button
    store.set(localModelStatusAtom, 'idle');
    return;
  }
  await _prepareLlamaModel();
}

async function _prepareLlamaModel(): Promise<void> {
  store.set(localModelStatusAtom, 'preparing');
  try {
    if (!llamaModel) throw new Error('llamaModel is not initialised');
    await llamaModel.prepare();
    store.set(localModelFileAvailableAtom, true);
    store.set(localModelStatusAtom, 'ready');
  } catch (err) {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, err instanceof Error ? err.message : String(err));
  }
}
