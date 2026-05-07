// localStorage token storage following resilientTokenStorage pattern from web-support-mvp.
// atomWithStorage JSON-encodes values; raw JWTs may also be written directly.
// Always use these helpers — never read localStorage tokens raw.

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

function parseToken(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
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

export interface UserInfo {
  id: string;
  email: string;
  username?: string;
}

export function setUser(user: UserInfo): void {
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  localStorage.removeItem('user');
}

// --- API helpers ---

const API_BASE = '/api';

export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: UserInfo;
  message?: string;
  userId?: string;
}

async function authFetch(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as AuthResponse;
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Request failed: ${res.status}`);
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
