import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

export const useFeed = () => {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.feed.get({
        query: { page: pageParam, limit: 20 },
      });
      if (error) throw new Error(`Failed to fetch feed: ${error.value}`);
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
