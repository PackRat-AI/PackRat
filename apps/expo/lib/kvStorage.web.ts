import AsyncStorage from 'expo-app/lib/asyncStorage';

export default {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string | null) => {
    if (value === null) return AsyncStorage.removeItem(key);
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
