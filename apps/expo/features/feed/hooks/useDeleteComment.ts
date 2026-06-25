import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const { error } = await apiClient
        .feed({ postId: String(postId) })
        .comments({ commentId: String(commentId) })
        .delete();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to delete comment'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'deleteComment' },
          extra: { postId, commentId, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
