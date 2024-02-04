import EventEmitter from 'events';

class StorageEventEmitter extends EventEmitter {}
export const storageEvents = new StorageEventEmitter();

export const Storage = {
  getItem: async (key) => {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    } catch {
      console.error('Failed to load data from storage');
    }
    return null;
  },
  setItem: async (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      storageEvents.emit('change', { key, value });

      return true;
    } catch {
      console.error('Failed to change data from storage');
    }
    return false;
  },
  removeItem: async (key) => {
    try {
      window.localStorage.removeItem(key);
      storageEvents.emit('remove', { key });

      return true;
    } catch {
      console.error('Failed to remove data from storage');
    }
    return false;
  },
};
