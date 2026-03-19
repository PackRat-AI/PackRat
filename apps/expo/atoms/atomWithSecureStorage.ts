import * as SecureStore from 'expo-secure-store';
import { atom } from 'jotai';

// biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
export const atomWithSecureStorage = <T>(key: string, initialValue: T) => {
  const baseAtom = atom(initialValue);

  baseAtom.onMount = (setValue) => {
    (async () => {
      const item = await SecureStore.getItemAsync(key);
      setValue(item ? JSON.parse(item) : initialValue);
    })();
  };

  const derivedAtom = atom(
    (get) => get(baseAtom),
    // biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
    (get, set, update) => {
      const nextValue = typeof update === 'function' ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      SecureStore.setItemAsync(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
