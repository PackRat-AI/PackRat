import { isFunction } from '@packrat/guards';
import * as SecureStore from 'expo-app/lib/secureStore';
import { atom } from 'jotai';

export const atomWithSecureStorage = <T>({
  key,
  initialValue,
}: {
  key: string;
  initialValue: T;
}) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await SecureStore.getItemAsync(key);
      setValue(item ? JSON.parse(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue = isFunction(update) ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      SecureStore.setItemAsync(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
