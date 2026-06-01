import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';

export function useCurrentUser() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const { data, error } = await client.user.profile.get();
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

interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string | null;
}

export function useUpdateProfileMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProfileInput) => {
      const { data, error } = await client.user.profile.put(body);
      if (error) throw new Error('Failed to update profile');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.user }),
  });
}
