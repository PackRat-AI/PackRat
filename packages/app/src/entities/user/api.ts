import type { ApiClient } from '../../shared/api';
import { UserProfileSchema, UserSchema } from './schema';

export async function fetchCurrentUser(client: ApiClient) {
  const { data, error } = await client.auth.me.get();
  if (error) throw new Error('Failed to fetch current user');
  return UserSchema.parse((data as { user?: unknown })?.user ?? data);
}

export async function fetchUserProfile(client: ApiClient) {
  const { data, error } = await client.user.profile.get();
  if (error) throw new Error('Failed to fetch user profile');
  return UserProfileSchema.parse(data);
}
