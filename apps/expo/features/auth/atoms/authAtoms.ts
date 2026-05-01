import kvStorage from 'expo-app/lib/kvStorage';
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
export const tokenAtom = atomWithStorage<string | null>('access_token', null, kvStorage);

export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null, kvStorage);

// Loading state atom
export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');

// Re-authentication state
export const needsReauthAtom = atom(false);
