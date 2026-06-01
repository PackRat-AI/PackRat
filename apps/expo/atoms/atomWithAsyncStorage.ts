import { isFunction } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      setValue(item ? safeJsonParse<T>(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue = isFunction(update) ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      AsyncStorage.setItem(key, safeJsonStringify(nextValue));
    },
  );

  return derivedAtom;
};
