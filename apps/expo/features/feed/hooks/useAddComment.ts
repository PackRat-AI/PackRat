import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

interface AddCommentInput {
  postId: number;
  content: string;
  parentCommentId?: number;
}

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: AddCommentInput) => {
      const { data, error } = await apiClient.feed({ postId: String(postId) }).comments.post({
        content,
        ...(parentCommentId !== undefined ? { parentCommentId } : {}),
      });
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to add comment'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'addComment' },
          extra: { postId, parentCommentId, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
