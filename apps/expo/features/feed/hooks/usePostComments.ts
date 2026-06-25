import * as Sentry from '@sentry/react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const usePostComments = (postId: number) => {
  return useInfiniteQuery({
    queryKey: ['feed', postId, 'comments'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient
        .feed({ postId: String(postId) })
        .comments.get({ query: { page: pageParam, limit: 20 } });
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to fetch comments'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'fetchPostComments' },
          extra: { postId, page: pageParam, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage && lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
};
