// expo-secure-store's web build is an empty stub that throws when called,
// which silently breaks web auth. Back it with localStorage instead.
//
// SECURITY NOTE: localStorage is NOT encrypted. This is acceptable for the
// web MVP because the browser already stores auth state in JS-accessible
// memory; the native builds keep using the real Keychain/Keystore.

const KEY_PREFIX = 'securestore:';

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export const getItem = (key: string): string | null => {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
};

export const setItem = (key: string, value: string): void => {
  localStorage.setItem(storageKey(key), value);
};

export const getItemAsync = (key: string): Promise<string | null> => Promise.resolve(getItem(key));

export const setItemAsync = (key: string, value: string): Promise<void> => {
  setItem(key, value);
  return Promise.resolve();
};

export const deleteItemAsync = (key: string): Promise<void> => {
  localStorage.removeItem(storageKey(key));
  return Promise.resolve();
};

export const isAvailableAsync = (): Promise<boolean> => Promise.resolve(true);

export const canUseBiometricAuthentication = (): boolean => false;

export const AFTER_FIRST_UNLOCK = 1;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 2;
export const ALWAYS = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 5;
export const WHEN_UNLOCKED = 6;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 7;
