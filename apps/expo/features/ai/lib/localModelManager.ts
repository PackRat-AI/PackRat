/**
 * Singleton manager for the on-device AI model.
 *
 * - On iOS 26+: uses @react-native-ai/apple (Apple Foundation Models, no download needed)
 * - On other devices: uses @react-native-ai/llama with Qwen2.5-3B-Instruct Q3_K_M
 *
 * Updates Jotai atoms via the global store so download progress is visible
 * from any component, even while the bottom sheet is closed.
 */

import { isString } from '@packrat/guards';
import type { LlamaLanguageModel } from '@react-native-ai/llama';
import { llama } from '@react-native-ai/llama';
import type { LanguageModel } from 'ai';
import { store } from 'expo-app/atoms/store';
import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import {
  localModelErrorAtom,
  localModelFileAvailableAtom,
  localModelProgressAtom,
  localModelStatusAtom,
} from '../atoms/aiModeAtoms';
import { AppleModelWrapper } from './appleModelWrapper';
import { LLAMA_MODEL_ID, LLAMA_MODEL_SIZE_BYTES } from './constants';
import { LlamaToolsWrapper } from './llamaToolsWrapper';
import { createLocalTools } from './tools';

const LLAMA_MODEL_FILENAME = LLAMA_MODEL_ID.split('/').at(-1) ?? 'model.gguf';
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

// ─── Apple Dynamic Import ───────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: dynamic import type unknown
let appleModule: any = null;

function getAppleModule() {
  if (appleModule) return appleModule;

  try {
    // require() is synchronous — import() returns a Promise, which breaks
    // the synchronous callers (isAppleIntelligenceAvailable, etc.)
    appleModule = require('@react-native-ai/apple');
    return appleModule;
  } catch (err) {
    console.error('Failed to load Apple module:', err);
    return null;
  }
}

// ─── Singletons ─────────────────────────────────────────────────────────────

let llamaModel: LlamaLanguageModel | null = null;
let llamaModelWrapper: LlamaToolsWrapper | null = null;
// biome-ignore lint/suspicious/noExplicitAny: Apple module type unknown
let appleModel: any = null;
// biome-ignore lint/suspicious/noExplicitAny: download task type unknown
let activeDownloadTask: any = null;
let _isCancellingDownload = false;

/**
 * Returns true if Apple Intelligence is available on this device.
 * Requires iOS 26+, Apple Intelligence enabled in Settings, and the
 * @react-native-ai/apple native module reporting availability.
 * Falls back to Llama (via isAvailable() === false) if any check fails.
 */
export function isAppleIntelligenceAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;

  const version = isString(Platform.Version) ? parseInt(Platform.Version, 10) : Platform.Version;

  if (version < 26) return false;

  const mod = getAppleModule();
  if (!mod) return false;

  try {
    return mod.apple.isAvailable();
  } catch {
    return false;
  }
}

/** Returns the ready model instance, or null if not prepared yet. */
export function getLocalModel(): LanguageModel | null {
  if (isAppleIntelligenceAvailable()) return appleModel;
  return llamaModelWrapper as unknown as LanguageModel;
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

  if (isAppleIntelligenceAvailable()) {
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
  if (isAppleIntelligenceAvailable()) {
    // Apple model needs no download — just init
    await _initAppleModel();
    return;
  }

  const status = store.get(localModelStatusAtom);
  if (status === 'downloading' || status === 'preparing' || status === 'ready') return;

  store.set(localModelStatusAtom, 'checking');
  store.set(localModelErrorAtom, null);

  if (!llamaModel) {
    llamaModel = llama.languageModel(LLAMA_MODEL_ID, { n_ctx: 4096, n_gpu_layers: 99 });
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
      const downloadRes = await activeDownloadTask;
      activeDownloadTask = null;
      const httpStatus = downloadRes.respInfo?.status ?? 0;
      if (httpStatus < 200 || httpStatus >= 300) {
        await RNBlobUtil.fs.unlink(_getLlamaModelPath()).catch(() => {});
        store.set(localModelStatusAtom, 'error');
        store.set(localModelErrorAtom, `Download failed: HTTP ${httpStatus}`);
        return;
      }
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

/**
 * Unload the active model from memory without deleting the file.
 * Use when backgrounding the app or before hot-reload, so native modules
 * are cleanly invalidated. Call `initLocalModel` to reload after.
 */
export async function releaseLocalModel(): Promise<void> {
  if (appleModel) {
    try {
      await appleModel.unload?.();
    } catch {
      // ignore
    }
    appleModel = null;
  }
  if (llamaModel) {
    try {
      await llamaModel.unload();
    } catch {
      // ignore
    }
    llamaModel = null;
    llamaModelWrapper = null;
  }
  store.set(localModelStatusAtom, 'idle');
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
    llamaModelWrapper = null;
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
  // isAppleIntelligenceAvailable() has already confirmed availability — just init.
  store.set(localModelStatusAtom, 'preparing');

  try {
    const mod = await getAppleModule();
    if (!mod) throw new Error('Apple module not available');

    const apple = mod.createAppleProvider({
      availableTools: createLocalTools(),
    });

    appleModel = new AppleModelWrapper(apple());
    store.set(localModelStatusAtom, 'ready');
  } catch {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, 'Failed to initialise Apple Foundation Model.');
  }
}

async function _initLlamaModel(): Promise<void> {
  if (!llamaModel) {
    llamaModel = llama.languageModel(LLAMA_MODEL_ID, { n_ctx: 4096, n_gpu_layers: 99 });
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
    llamaModelWrapper = new LlamaToolsWrapper(llamaModel);
    store.set(localModelFileAvailableAtom, true);
    store.set(localModelStatusAtom, 'ready');
  } catch (err) {
    store.set(localModelStatusAtom, 'error');
    store.set(localModelErrorAtom, err instanceof Error ? err.message : String(err));
  }
}
