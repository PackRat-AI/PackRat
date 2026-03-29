import { atomWithAsyncStorage } from 'expo-app/atoms/atomWithAsyncStorage';
import { atom } from 'jotai';

export type AIMode = 'cloud' | 'local';
export type ModelStatus = 'idle' | 'checking' | 'downloading' | 'preparing' | 'ready' | 'error';

/** Persisted user preference for cloud vs local inference */
export const aiModeAtom = atomWithAsyncStorage<AIMode>('ai:mode', 'cloud');

/** Current status of the local model */
export const localModelStatusAtom = atom<ModelStatus>('idle');

/** Download progress 0–100 */
export const localModelProgressAtom = atom<number>(0);

/** Error message if model status is 'error' */
export const localModelErrorAtom = atom<string | null>(null);
