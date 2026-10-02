import { isFunction } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import AsyncStorage from 'expo-app/lib/asyncStorage';
import { atom } from 'jotai';

export const atomWithAsyncStorage = <T>({
  key,
  initialValue,
  deserialize,
}: {
  key: string;
  initialValue: T;
  /**
   * Optional validator applied to the rehydrated value before it reaches the
   * atom. `safeJsonParse` is an unchecked cast — it will happily hand back a
   * map persisted by an older build, missing keys the current build expects.
   * Pass a normalizer for any atom whose shape can drift across app versions.
   */
  deserialize?: (raw: unknown) => T;
}) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await AsyncStorage.getItem(key);
      const parsed = item ? safeJsonParse<T>(item) : initialValue;
      setValue(deserialize ? deserialize(parsed) : parsed);
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
