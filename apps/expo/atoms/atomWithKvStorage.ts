import { isFunction } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import Storage from 'expo-sqlite/kv-store';
import { atom } from 'jotai';

export const atomWithKvStorage = <T>({ key, initialValue }: { key: string; initialValue: T }) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await Storage.getItem(key);
      setValue(item ? safeJsonParse<T>(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue = isFunction(update) ? update(get(baseAtom)) : update;

      set(baseAtom, nextValue);

      Storage.setItem(key, safeJsonStringify(nextValue));
    },
  );

  return derivedAtom;
};
