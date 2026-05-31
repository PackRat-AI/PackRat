import Cookies from 'js-cookie';

export function setTokens({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}) {
  Cookies.set('access_token', accessToken, { expires: 1, sameSite: 'strict' });
  Cookies.set('refresh_token', refreshToken, { expires: 30, sameSite: 'strict' });
}

export function clearTokens() {
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
}

export function getAccessToken() {
  return Cookies.get('access_token') ?? null;
}

export function isAuthenticated() {
  return !!Cookies.get('access_token');
}
