// expo-sqlite/kv-store relies on the native SQLite module, which has no usable
// web build. Back the same API (async aliases + sync variants + getAllKeys)
// with localStorage so callers need no Platform branches on web.

const getItemSync = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setItemSync = (key: string, value: string): void => {
  localStorage.setItem(key, value);
};

const removeItemSync = (key: string): void => {
  localStorage.removeItem(key);
};

const getAllKeysSync = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
};

const Storage = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(getItemSync(key)),
  setItem: (key: string, value: string): Promise<void> => {
    setItemSync(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    removeItemSync(key);
    return Promise.resolve();
  },
  getAllKeys: (): Promise<string[]> => Promise.resolve(getAllKeysSync()),
  clear: (): Promise<void> => {
    localStorage.clear();
    return Promise.resolve();
  },
  getItemAsync: (key: string): Promise<string | null> => Promise.resolve(getItemSync(key)),
  setItemAsync: (key: string, value: string): Promise<void> => {
    setItemSync(key, value);
    return Promise.resolve();
  },
  removeItemAsync: (key: string): Promise<boolean> => {
    removeItemSync(key);
    return Promise.resolve(true);
  },
  getAllKeysAsync: (): Promise<string[]> => Promise.resolve(getAllKeysSync()),
  getItemSync,
  setItemSync,
  removeItemSync,
  getAllKeysSync,
};

export default Storage;
