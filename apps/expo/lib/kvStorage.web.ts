import AsyncStorage from '@react-native-async-storage/async-storage';

export default {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string | null) => {
    if (value === null) return AsyncStorage.removeItem(key);
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
