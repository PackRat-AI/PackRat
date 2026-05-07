import type { ApiClient } from '../../shared/api';

export const getCurrentUser = (client: ApiClient) => client.auth.me.get();

export const getUserProfile = (client: ApiClient) => client.user.profile.get();

export const login = (client: ApiClient, body: { email: string; password: string }) =>
  client.auth.login.post(body);

export const register = (
  client: ApiClient,
  body: { email: string; password: string; firstName?: string; lastName?: string },
) => client.auth.register.post(body);

export const updateProfile = (
  client: ApiClient,
  body: { firstName?: string; lastName?: string; email?: string; avatarUrl?: string | null },
) => client.user.profile.put(body);
