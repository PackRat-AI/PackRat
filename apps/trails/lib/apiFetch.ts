import {
  apiRefreshToken,
  clearTokens,
  clearUser,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from 'trails-app/lib/auth';

// Authenticated fetch with automatic token refresh on 401.
// On second 401 (refresh failed), clears auth and throws.
export async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status !== 401) return res;

  // Attempt token refresh
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    clearUser();
    throw new AuthExpiredError();
  }

  try {
    const { accessToken, refreshToken: newRefresh } = await apiRefreshToken(refreshToken);
    setTokens(accessToken, newRefresh);
    // Retry original request with fresh token
    headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  } catch {
    clearTokens();
    clearUser();
    throw new AuthExpiredError();
  }
}

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired. Please log in again.');
    this.name = 'AuthExpiredError';
  }
}
