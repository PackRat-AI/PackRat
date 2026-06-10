import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useToggleCommentLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const { data, error } = await apiClient
        .feed({ postId: String(postId) })
        .comments({ commentId: String(commentId) })
        .like.post();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to toggle comment like'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'toggleCommentLike' },
          extra: { postId, commentId, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
    },
  });
};
