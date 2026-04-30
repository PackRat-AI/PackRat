// SSR-safe async-storage shim for web — guards window.localStorage access
const isClient = typeof window !== 'undefined';

const storage: typeof import('@react-native-async-storage/async-storage').default = {
  getItem: (key) => {
    if (!isClient) return Promise.resolve(null);
    return Promise.resolve(window.localStorage.getItem(key));
  },
  setItem: (key, value) => {
    if (!isClient) return Promise.resolve();
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    if (!isClient) return Promise.resolve();
    window.localStorage.removeItem(key);
    return Promise.resolve();
  },
  mergeItem: (key, value) => {
    if (!isClient) return Promise.resolve();
    const existing = window.localStorage.getItem(key);
    const merged = existing
      ? JSON.stringify({ ...JSON.parse(existing), ...JSON.parse(value) })
      : value;
    window.localStorage.setItem(key, merged);
    return Promise.resolve();
  },
  clear: () => {
    if (!isClient) return Promise.resolve();
    window.localStorage.clear();
    return Promise.resolve();
  },
  getAllKeys: () => {
    if (!isClient) return Promise.resolve([]);
    return Promise.resolve(Object.keys(window.localStorage));
  },
  multiGet: (keys) => {
    if (!isClient) return Promise.resolve(keys.map((k) => [k, null]));
    return Promise.resolve(keys.map((k) => [k, window.localStorage.getItem(k)]));
  },
  multiSet: (pairs) => {
    if (!isClient) return Promise.resolve();
    for (const [k, v] of pairs) window.localStorage.setItem(k, v);
    return Promise.resolve();
  },
  multiRemove: (keys) => {
    if (!isClient) return Promise.resolve();
    for (const k of keys) window.localStorage.removeItem(k);
    return Promise.resolve();
  },
  multiMerge: (pairs) => {
    if (!isClient) return Promise.resolve();
    for (const [k, v] of pairs) {
      const existing = window.localStorage.getItem(k);
      const merged = existing ? JSON.stringify({ ...JSON.parse(existing), ...JSON.parse(v) }) : v;
      window.localStorage.setItem(k, merged);
    }
    return Promise.resolve();
  },
  flushGetRequests: () => {},
};

export default storage;
