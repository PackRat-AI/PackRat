import { atom } from 'jotai';

/**
 * Web (localStorage) equivalent of atomWithSecureStorage.
 * Note: localStorage is NOT cryptographically secure. This is a functional
 * fallback for web; sensitive flows should use server-side sessions on web.
 * Metro automatically picks this file over atomWithSecureStorage.ts for web builds.
 */
export const atomWithSecureStorage = <T>(key: string, initialValue: T) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    try {
      const item = localStorage.getItem(key);
      setValue(item !== null ? JSON.parse(item) : initialValue);
    } catch {
      setValue(initialValue);
    }
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: T | ((prev: T) => T)) => {
      const nextValue =
        typeof update === 'function' ? (update as (prev: T) => T)(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      try {
        localStorage.setItem(key, JSON.stringify(nextValue));
      } catch {
        // Ignore storage errors
      }
    },
  );

  return derivedAtom;
};
