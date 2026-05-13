// localStorage token storage following resilientTokenStorage pattern from web-support-mvp.
// atomWithStorage JSON-encodes values; raw JWTs may also be written directly.
// Always use these helpers — never read localStorage tokens raw.

import { safeLocalStorage } from '@packrat/app/browser';
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
  return parseToken(safeLocalStorage.getItem(ACCESS_KEY));
}

export function getRefreshToken(): string | null {
  return parseToken(safeLocalStorage.getItem(REFRESH_KEY));
}

export function setTokens({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}): void {
  safeLocalStorage.setItem({ key: ACCESS_KEY, value: accessToken });
  safeLocalStorage.setItem({ key: REFRESH_KEY, value: refreshToken });
}

export function clearTokens(): void {
  safeLocalStorage.removeItem(ACCESS_KEY);
  safeLocalStorage.removeItem(REFRESH_KEY);
}

export const UserInfoSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

export function setUser(user: UserInfo): void {
  safeLocalStorage.setItem({ key: 'user', value: JSON.stringify(user) });
}

export function getUser(): UserInfo | null {
  try {
    const raw = safeLocalStorage.getItem('user');
    return raw ? (fromZod(UserInfoSchema)(JSON.parse(raw)) ?? null) : null;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  safeLocalStorage.removeItem('user');
}
