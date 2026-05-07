import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

interface CreatePostBody {
  caption?: string;
  images: string[];
}

export function useCreatePostMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePostBody) => {
      const { data, error } = await client.feed.post(body);
      if (error) throw new Error('Failed to create post');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });
}
