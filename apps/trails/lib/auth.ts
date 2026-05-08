// localStorage token storage following resilientTokenStorage pattern from web-support-mvp.
// atomWithStorage JSON-encodes values; raw JWTs may also be written directly.
// Always use these helpers — never read localStorage tokens raw.

import { fromZod, isString } from '@packrat/guards';
import z from 'zod';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

function parseToken(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isString(parsed) ? parsed : null;
  } catch {
    // Not JSON-encoded — return as-is (raw JWT)
    return raw;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return parseToken(localStorage.getItem(ACCESS_KEY));
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return parseToken(localStorage.getItem(REFRESH_KEY));
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const UserInfoSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

export function setUser(user: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (fromZod(UserInfoSchema)(JSON.parse(raw)) ?? null) : null;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
}
