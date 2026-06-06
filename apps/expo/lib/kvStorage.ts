import Storage from 'expo-app/lib/expoSqliteKvStore';

export default {
  getItem: (key: string): string | null => Storage.getItemSync(key),
  setItem: (key: string, value: string | null) => {
    if (value === null) Storage.removeItemSync(key);
    else Storage.setItemSync(key, value);
  },
  removeItem: (key: string) => Storage.removeItemSync(key),
};
