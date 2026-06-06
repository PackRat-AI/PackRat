import * as Sentry from '@sentry/react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useFeed = () => {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.feed.get({
        query: { page: pageParam, limit: 20 },
      });
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to fetch feed'));
        Sentry.captureException(err, {
          tags: { feature: 'feed', action: 'fetchFeed' },
          extra: { page: pageParam, apiError: error.value, httpStatus: error.status },
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
