import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useLoginMutation() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error } = await client.auth.login.post(body);
      if (error) throw new Error('Login failed');
      return data;
    },
  });
}

export function useRegisterMutation() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const { data, error } = await client.auth.register.post(body);
      if (error) throw new Error('Registration failed');
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
