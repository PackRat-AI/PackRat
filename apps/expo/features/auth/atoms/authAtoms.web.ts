import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

/**
 * Web version of auth atoms.
 * Uses jotai's atomWithStorage which defaults to localStorage on web.
 * Metro automatically picks this file over authAtoms.ts for web builds.
 */

export type User = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
};

export const tokenAtom = atomWithStorage<string | null>('access_token', null);

export const refreshTokenAtom = atomWithStorage<string | null>('refresh_token', null);

export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');

export const needsReauthAtom = atom(false);
