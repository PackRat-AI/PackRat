import { apiClient } from '@packrat/app/lib/api/packrat';
import { useInfiniteQuery } from '@tanstack/react-query';

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
      if (error) throw new Error(`Failed to search guides: ${error.value}`);
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
