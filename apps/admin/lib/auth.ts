const CREDS_KEY = 'packrat_admin_creds';

/** Returns the stored Base64 credential string, or null if not logged in. */
export function getStoredCredentials(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CREDS_KEY);
}

/** Encode and persist credentials for the session. */
export function storeCredentials(username: string, password: string): void {
  sessionStorage.setItem(CREDS_KEY, btoa(`${username}:${password}`));
}

/** Remove credentials (logout). */
export function clearCredentials(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(CREDS_KEY);
}

/** Returns an Authorization header object, or empty object if not logged in. */
export function getAuthHeader(): Record<string, string> {
  const creds = getStoredCredentials();
  return creds ? { Authorization: `Basic ${creds}` } : {};
}
