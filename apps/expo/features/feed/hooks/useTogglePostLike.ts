import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useTogglePostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const { data, error } = await apiClient.feed({ postId: String(postId) }).like.post();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to toggle post like'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'togglePostLike' },
          extra: { postId, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
