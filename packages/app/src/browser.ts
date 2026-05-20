export const isBrowser = (): boolean => typeof window !== 'undefined';

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(key);
  },
  setItem({ key, value }: { key: string; value: string }): void {
    if (!isBrowser()) return;
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (!isBrowser()) return;
    localStorage.removeItem(key);
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    return sessionStorage.getItem(key);
  },
  setItem({ key, value }: { key: string; value: string }): void {
    if (!isBrowser()) return;
    sessionStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (!isBrowser()) return;
    sessionStorage.removeItem(key);
  },
};
