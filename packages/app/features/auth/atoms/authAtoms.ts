import Storage from 'expo-sqlite/kv-store';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// User type definition
export type User = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
};

// Token storage atom
export const tokenAtom = atomWithStorage<string | null>('access_token', null, {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => {
    if (value === null) return Storage.removeItemSync(key);
    return Storage.setItemSync(key, value);
  },
  removeItem: (key) => Storage.removeItemSync(key),
});

export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null, {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => {
    if (value === null) return Storage.removeItemSync(key);
    return Storage.setItemSync(key, value);
  },
  removeItem: (key) => Storage.removeItemSync(key),
});

// Loading state atom
export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');

// Re-authentication state
export const needsReauthAtom = atom(false);
