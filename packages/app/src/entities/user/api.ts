import type { ApiClient } from '../../shared/api';

export async function fetchCurrentUser(client: ApiClient) {
  const { data, error } = await client.auth.me.get();
  if (error) throw new Error('Failed to fetch current user');
  return data;
}

export async function fetchUserProfile(client: ApiClient) {
  const { data, error } = await client.user.profile.get();
  if (error) throw new Error('Failed to fetch user profile');
  return data;
}
