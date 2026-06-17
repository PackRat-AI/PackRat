// Web implementation of the secure-store wrapper. expo-secure-store ships an
// empty stub on web (calling it throws), so back it with localStorage. The
// Better Auth session lives in an HttpOnly cookie rather than here, so reads of
// the cookie key simply return null — callers fall back to cookie auth.
function ls(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export function getItem(key: string): string | null {
  return ls()?.getItem(key) ?? null;
}

export function setItem(key: string, value: string): void {
  ls()?.setItem(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
  return ls()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  ls()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  ls()?.removeItem(key);
}
