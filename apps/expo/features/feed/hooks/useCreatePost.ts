import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

interface CreatePostInput {
  caption?: string;
  images: string[];
}

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const { data, error } = await apiClient.feed.post(input);
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to create post'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'createPost' },
          extra: { apiError: error.value, httpStatus: error.status },
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
