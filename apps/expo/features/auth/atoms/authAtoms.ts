import { atom } from 'jotai';

export const isLoadingAtom = atom(false);
export const isSignOutRedirectingAtom = atom(false);
export const redirectToAtom = atom<string>('/');
export const needsReauthAtom = atom(false);
// Prevents AppLayout's useEffect from auto-navigating to /auth during the
// sign-out flow so the profile screen can show a post-sign-out prompt first.
export const suppressSignOutNavAtom = atom(false);
// Set by the profile screen once signOut() has finished. AppLayout's sign-out
// spinner shows the post-sign-out prompt while it is true; the profile screen
// itself is unmounted by then, so it cannot host the dialog.
export const showSignOutPromptAtom = atom(false);
