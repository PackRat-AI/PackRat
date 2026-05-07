import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

export function useTogglePostLikeMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const { data, error } = await client.feed({ postId }).like.post();
      if (error) throw new Error('Failed to toggle post like');
      return data;
    },
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: queryKeys.feed() });
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}
