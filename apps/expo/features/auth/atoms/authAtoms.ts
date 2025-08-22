import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import Storage from 'expo-sqlite/kv-store';

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
  getItem: async (key) => Storage.getItem(key),
  setItem: async (key, value) => {
    if (value === null) return Storage.removeItem(key);
    return Storage.setItem(key, value);
  },
  removeItem: async (key) => Storage.removeItem(key),
});

export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null, {
  getItem: async (key) => Storage.getItem(key),
  setItem: async (key, value) => {
    if (value === null) return Storage.removeItem(key);
    return Storage.setItem(key, value);
  },
  removeItem: async (key) => Storage.removeItem(key),
});

// Loading state atom
export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');
