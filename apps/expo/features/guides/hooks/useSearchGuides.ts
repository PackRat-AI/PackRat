import * as Sentry from '@sentry/react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

interface UseSearchGuidesParams {
  query: string;
  category?: string;
}

export const useSearchGuides = ({ query, category }: UseSearchGuidesParams) => {
  return useInfiniteQuery({
    queryKey: ['guides', 'search', { query, category }],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.guides.search.get({
        query: {
          q: query,
          page: pageParam,
          limit: 20,
          ...(category ? { category } : {}),
        },
      });
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to search guides'));
        Sentry.captureException(err, {
          tags: { feature: 'guides', action: 'searchGuides' },
          extra: { query, page: pageParam, category, apiError: error.value, httpStatus: error.status },
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
    enabled: query.length > 0,
  });
};
