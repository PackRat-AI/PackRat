import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

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

// atomWithStorage JSON-encodes values, but some code paths (token refresh in client.web.ts)
// write the raw JWT directly to localStorage. This custom storage reads both formats.
const baseStorage = createJSONStorage<string | null>(() => localStorage);
const resilientTokenStorage = {
  ...baseStorage,
  getItem(key: string, initialValue: string | null): string | null {
    const raw = localStorage.getItem(key);
    if (!raw) return initialValue;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
};

export const tokenAtom = atomWithStorage<string | null>(
  'access_token',
  null,
  resilientTokenStorage,
  { getOnInit: true },
);

export const refreshTokenAtom = atomWithStorage<string | null>(
  'refresh_token',
  null,
  resilientTokenStorage,
  { getOnInit: true },
);

export const isLoadingAtom = atom(false);

export const redirectToAtom = atom<string>('/');

export const needsReauthAtom = atom(false);
