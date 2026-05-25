const isClient = typeof window !== 'undefined';

export const secureStorage = {
  getItem: (key: string) => (isClient ? window.localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (isClient) window.localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string) => (isClient ? window.localStorage.getItem(key) : null),
  setItemAsync: async (key: string, value: string) => {
    if (isClient) window.localStorage.setItem(key, value);
  },
  deleteItemAsync: async (key: string) => {
    if (isClient) window.localStorage.removeItem(key);
  },
};
