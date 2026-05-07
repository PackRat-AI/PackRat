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
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const UserInfoSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().optional(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

export function setUser(user: UserInfo): void {
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
  localStorage.removeItem('user');
}

// --- API helpers ---

const API_BASE = '/api';

const AuthResponseSchema = z.object({
  success: z.boolean().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  user: UserInfoSchema.optional(),
  message: z.string().optional(),
  userId: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

async function authFetch(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = fromZod(AuthResponseSchema)(await res.json()) ?? {};
  if (!res.ok) {
    throw new Error(data.message ?? `Request failed: ${res.status}`);
  }
  return data;
}

export async function apiRegister(opts: {
  email: string;
  password: string;
  username: string;
}): Promise<{ userId: string }> {
  const data = await authFetch('/auth/register', opts);
  return { userId: data.userId ?? '' };
}

export async function apiVerifyEmail(
  email: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string; user: UserInfo }> {
  const data = await authFetch('/auth/verify-email', { email, otp });
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Verification failed: missing token data');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
}

export async function apiResendVerification(email: string): Promise<void> {
  await authFetch('/auth/resend-verification', { email });
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: UserInfo }> {
  const data = await authFetch('/auth/login', { email, password });
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Login failed: missing token data');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
}

export async function apiForgotPassword(email: string): Promise<void> {
  await authFetch('/auth/forgot-password', { email });
}

export async function apiRefreshToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await authFetch('/auth/refresh', { refreshToken });
  if (!data.accessToken || !data.refreshToken) {
    throw new Error('Token refresh failed');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await authFetch('/auth/logout', { refreshToken });
}
