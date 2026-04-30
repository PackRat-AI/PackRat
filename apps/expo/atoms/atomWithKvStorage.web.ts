import { atom } from 'jotai';

/**
 * Web (localStorage) equivalent of atomWithKvStorage.
 * Metro automatically picks this file over atomWithKvStorage.ts for web builds.
 */
export const atomWithKvStorage = <T>(key: string, initialValue: T) => {
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
        // Ignore storage errors (e.g. private browsing quota)
      }
    },
  );

  return derivedAtom;
};
