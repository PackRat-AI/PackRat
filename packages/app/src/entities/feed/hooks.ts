import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiClient } from '../../shared/api';
import { queryKeys } from '../../shared/api/query-keys';

export function useFeed() {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await client.feed.get({
        query: { page: pageParam as number, limit: 20 },
      });
      if (error) throw new Error(`Failed to fetch feed: ${String(error)}`);
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
}
