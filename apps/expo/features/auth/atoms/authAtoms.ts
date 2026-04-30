import Storage from 'expo-sqlite/kv-store';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { Platform } from 'react-native';

// User type definition
export type User = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
};

// On web, SQLite sync methods require SharedArrayBuffer (COEP/COOP headers).
// Without those headers getItemSync/setItemSync throw, which wipes in-memory
// atom state on onMount. We keep a module-level write-through cache on web so
// getItem() always returns the value that was last written in this session.
const webCache = new Map<string, string | null>();

function makeKvStorage() {
  return {
    getItem: (_key: string): string | null => {
      if (Platform.OS === 'web') return webCache.get(_key) ?? null;
      return Storage.getItemSync(_key);
    },
    setItem: (_key: string, value: string | null) => {
      if (Platform.OS === 'web') {
        webCache.set(_key, value);
        // Persist async so the value survives a page refresh via Storage.getItem
        if (value === null) void Storage.removeItem(_key);
        else void Storage.setItem(_key, value);
        return;
      }
      if (value === null) return Storage.removeItemSync(_key);
      return Storage.setItemSync(_key, value);
    },
    removeItem: (_key: string) => {
      if (Platform.OS === 'web') {
        webCache.delete(_key);
        void Storage.removeItem(_key);
        return;
      }
      return Storage.removeItemSync(_key);
    },
  };
}

// Token storage atom
export const tokenAtom = atomWithStorage<string | null>('access_token', null, makeKvStorage());

export const refreshTokenAtom = atomWithStorage<string | null>(
  'refresh_token',
  null,
  makeKvStorage(),
);

// Loading state atom
export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');

// Re-authentication state
export const needsReauthAtom = atom(false);
