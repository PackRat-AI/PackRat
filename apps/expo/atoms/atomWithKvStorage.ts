import { isFunction } from '@packrat/guards';
import Storage from 'expo-app/lib/expoSqliteKvStore';
import { atom } from 'jotai';

export const atomWithKvStorage = <T>({ key, initialValue }: { key: string; initialValue: T }) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await Storage.getItem(key);
      setValue(item ? JSON.parse(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue = isFunction(update) ? update(get(baseAtom)) : update;

      set(baseAtom, nextValue);

      Storage.setItem(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
