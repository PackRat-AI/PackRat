import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

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
