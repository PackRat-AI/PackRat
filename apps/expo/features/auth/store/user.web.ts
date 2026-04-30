import { observable, observe, syncState } from '@legendapp/state';
import type { User } from 'expo-app/features/profile/types';

/**
 * Web version of the user store.
 * Uses localStorage for persistence instead of expo-sqlite.
 * Metro automatically picks this file over user.ts for web builds.
 */

export const userStore = observable<User | null>(null);

// Hydrate from localStorage on module load
if (typeof window !== 'undefined') {
  const storedUser = localStorage.getItem('packrat_user');
  if (storedUser) {
    try {
      userStore.set(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem('packrat_user');
    }
  }
}

// Persist changes to localStorage
observe(() => {
  if (typeof window === 'undefined') return;
  const user = userStore.get();
  if (user !== null) {
    localStorage.setItem('packrat_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('packrat_user');
  }
});

export const userSyncState = syncState(userStore);

export type UserStore = typeof userStore;
