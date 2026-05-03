import { atom } from 'jotai';

export const isLoadingAtom = atom(false);
export const redirectToAtom = atom<string>('/');
export const needsReauthAtom = atom(false);
// Prevents AppLayout's useEffect from auto-navigating to /auth during the
// sign-out flow so the profile screen can show a post-sign-out prompt first.
export const suppressSignOutNavAtom = atom(false);
