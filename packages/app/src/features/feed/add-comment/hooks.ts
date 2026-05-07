import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

interface AddCommentBody {
  content: string;
  parentCommentId?: number;
}

export function useAddCommentMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, body }: { postId: number; body: AddCommentBody }) => {
      const { data, error } = await client.feed({ postId }).comments.post(body);
      if (error) throw new Error('Failed to add comment');
      return data;
    },
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}
