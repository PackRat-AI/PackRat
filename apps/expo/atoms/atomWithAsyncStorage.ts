import AsyncStorage from '@react-native-async-storage/async-storage';
import { atom } from 'jotai';

export const atomWithAsyncStorage = <T>(key: string, initialValue: T) => {
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
      const nextValue = typeof update === 'function' ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      AsyncStorage.setItem(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
