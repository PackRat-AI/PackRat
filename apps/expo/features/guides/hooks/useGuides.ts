import * as Sentry from '@sentry/react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

interface UseGuidesParams {
  category?: string;
  sort?: {
    field: 'title' | 'category' | 'createdAt' | 'updatedAt';
    order: 'asc' | 'desc';
  };
}

export const useGuides = ({ category, sort }: UseGuidesParams = {}) => {
  return useInfiniteQuery({
    queryKey: ['guides', { category, sort }],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.guides.get({
        query: {
          page: pageParam,
          limit: 20,
          ...(category ? { category } : {}),
          ...(sort
            ? {
                'sort[field]': sort.field,
                'sort[order]': sort.order,
              }
            : {}),
        },
      });
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to fetch guides'));
        Sentry.captureException(err, {
          tags: { feature: 'guides', action: 'fetchGuides' },
          extra: { page: pageParam, category, apiError: error.value, httpStatus: error.status },
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
