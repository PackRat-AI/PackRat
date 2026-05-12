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

// Auth routes are handled by Better Auth (/api/auth/**), not Eden Treaty.
// These hooks use a cast to maintain backwards-compatibility until the
// auth screen is rebuilt against Better Auth.
type LegacyAuthClient = {
  auth: {
    login: {
      post: (b: { email: string; password: string }) => Promise<{ data: unknown; error: unknown }>;
    };
    register: {
      post: (b: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
      }) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export function useLoginMutation() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error } = await (client as unknown as LegacyAuthClient).auth.login.post(body);
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
      const { data, error } = await (client as unknown as LegacyAuthClient).auth.register.post(
        body,
      );
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
