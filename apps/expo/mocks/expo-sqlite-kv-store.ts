type UpdateFn = (prevValue: string | null) => string;

const PREFIX = '__kv__';

const isClient = typeof window !== 'undefined';
const memFallback = new Map<string, string>();

const rawGet = (key: string): string | null =>
  isClient ? window.localStorage.getItem(PREFIX + key) : (memFallback.get(key) ?? null);

const rawSet = (key: string, value: string): void => {
  if (isClient) window.localStorage.setItem(PREFIX + key, value);
  else memFallback.set(key, value);
};

const rawRemove = (key: string): boolean => {
  const had = rawGet(key) !== null;
  if (isClient) window.localStorage.removeItem(PREFIX + key);
  else memFallback.delete(key);
  return had;
};

const rawKeys = (): string[] => {
  if (!isClient) return Array.from(memFallback.keys());
  return Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length));
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      out[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      out[key] = source[key];
    }
  }
  return out;
};

class LocalStorageStorage {
  getItemSync(key: string): string | null {
    return rawGet(key);
  }

  setItemSync(key: string, value: string | UpdateFn): void {
    const v = typeof value === 'function' ? value(rawGet(key)) : value;
    rawSet(key, v);
  }

  removeItemSync(key: string): boolean {
    return rawRemove(key);
  }

  getAllKeysSync(): string[] {
    return rawKeys();
  }

  clearSync(): boolean {
    const keys = rawKeys();
    for (const k of keys) rawRemove(k);
    return true;
  }

  closeSync(): void {}

  getLengthSync(): number {
    return rawKeys().length;
  }

  getKeyByIndexSync(index: number): string | null {
    return rawKeys()[index] ?? null;
  }

  async getItemAsync(key: string): Promise<string | null> {
    return Promise.resolve(this.getItemSync(key));
  }

  async setItemAsync(key: string, value: string | UpdateFn): Promise<void> {
    this.setItemSync(key, value);
  }

  async removeItemAsync(key: string): Promise<boolean> {
    return Promise.resolve(this.removeItemSync(key));
  }

  async getAllKeysAsync(): Promise<string[]> {
    return Promise.resolve(this.getAllKeysSync());
  }

  async clearAsync(): Promise<boolean> {
    return Promise.resolve(this.clearSync());
  }

  async closeAsync(): Promise<void> {}

  async getLengthAsync(): Promise<number> {
    return Promise.resolve(this.getLengthSync());
  }

  async getKeyByIndexAsync(index: number): Promise<string | null> {
    return Promise.resolve(this.getKeyByIndexSync(index));
  }

  getItem(key: string): Promise<string | null> {
    return this.getItemAsync(key);
  }

  setItem(key: string, value: string | UpdateFn): Promise<void> {
    return this.setItemAsync(key, value);
  }

  removeItem(key: string): Promise<void> {
    return this.removeItemAsync(key).then(() => undefined);
  }

  getAllKeys(): Promise<string[]> {
    return this.getAllKeysAsync();
  }

  clear(): Promise<void> {
    return this.clearAsync().then(() => undefined);
  }

  close(): Promise<void> {
    return this.closeAsync();
  }

  async mergeItem(key: string, value: string): Promise<void> {
    const existing = this.getItemSync(key);
    if (existing) {
      try {
        const merged = deepMerge(JSON.parse(existing), JSON.parse(value));
        rawSet(key, JSON.stringify(merged));
      } catch {
        rawSet(key, value);
      }
    } else {
      rawSet(key, value);
    }
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return Promise.resolve(keys.map((k) => [k, this.getItemSync(k)]));
  }

  async multiSet(pairs: [string, string][]): Promise<void> {
    for (const [k, v] of pairs) this.setItemSync(k, v);
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const k of keys) this.removeItemSync(k);
  }

  async multiMerge(pairs: [string, string][]): Promise<void> {
    for (const [k, v] of pairs) await this.mergeItem(k, v);
  }
}

export const AsyncStorage = new LocalStorageStorage();
export const Storage = AsyncStorage;
export default AsyncStorage;
