import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  getItem: (key: string) => SecureStore.getItem(key),
  setItem: (key: string, value: string) => SecureStore.setItem(key, value),
  getItemAsync: (key: string) => SecureStore.getItemAsync(key),
  setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
};
