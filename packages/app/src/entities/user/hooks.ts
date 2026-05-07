import { useQuery } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';

export function useCurrentUser() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const { data, error } = await client.auth.me.get();
      if (error) throw new Error('Failed to fetch current user');
      return data;
    },
  });
}

export function useUserProfile() {
  const client = useApiClient();
  return useQuery({
    queryKey: [...queryKeys.user, 'profile'],
    queryFn: async () => {
      const { data, error } = await client.user.profile.get();
      if (error) throw new Error('Failed to fetch user profile');
      return data;
    },
  });
}
