import * as SecureStore from "expo-secure-store";
import { atom } from "jotai";

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
    (get, set, update) => {
      const nextValue = typeof update === "function" ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      SecureStore.setItemAsync(key, JSON.stringify(nextValue));
    },
  );

  return derivedAtom;
};
