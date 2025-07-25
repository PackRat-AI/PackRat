import * as SecureStore from 'expo-secure-store';
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
  getItem: async (key) => await SecureStore.getItemAsync(key),
  setItem: async (key, value) => {
    if (value === null) {
      return await SecureStore.deleteItemAsync(key);
    }
    return await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => SecureStore.deleteItemAsync(key),
});

export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null, {
  getItem: async (key) => await SecureStore.getItemAsync(key),
  setItem: async (key, value) => {
    if (value === null) {
      return await SecureStore.deleteItemAsync(key);
    }
    return await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => SecureStore.deleteItemAsync(key),
});

// Loading state atom
export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');
