import { atom } from 'jotai';

/**
 * Set when a place was watched from search on a phone that blocks notifications. Search closes
 * before the answer is known, so the watch list it returns to shows the notice instead.
 */
export const notificationsBlockedNoticeAtom = atom(false);
