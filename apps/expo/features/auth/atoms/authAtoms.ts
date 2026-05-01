import { atom } from 'jotai';

export const isLoadingAtom = atom(false);
export const redirectToAtom = atom<string>('/');
export const needsReauthAtom = atom(false);
