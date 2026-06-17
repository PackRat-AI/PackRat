import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const { error } = await apiClient.feed({ postId: String(postId) }).delete();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to delete post'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'deletePost' },
          extra: { postId, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
