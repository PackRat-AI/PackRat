import { isFunction } from '@packrat/guards';
import AsyncStorage from 'expo-app/lib/asyncStorage';
import { atom } from 'jotai';

export const atomWithAsyncStorage = <T>({
  key,
  initialValue,
}: {
  key: string;
  initialValue: T;
}) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await AsyncStorage.getItem(key);
      setValue(item ? JSON.parse(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue = isFunction(update) ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      AsyncStorage.setItem(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
