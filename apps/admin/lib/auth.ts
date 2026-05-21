import { safeSessionStorage } from '@packrat/app/browser';

const TOKEN_KEY = 'packrat_admin_token';

/** Returns the stored admin JWT, or null if not logged in. */
export function getStoredToken(): string | null {
  return safeSessionStorage.getItem(TOKEN_KEY);
}

/** Persist a short-lived admin JWT for the session. */
export function storeToken(token: string): void {
  safeSessionStorage.setItem({ key: TOKEN_KEY, value: token });
}

/** Remove the token (logout). */
export function clearToken(): void {
  safeSessionStorage.removeItem(TOKEN_KEY);
}

/** Returns an Authorization header object, or empty object if not logged in. */
export function getAuthHeader(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
