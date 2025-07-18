import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { GuidesSearchResponse } from '../types';

interface UseSearchGuidesParams {
  query: string;
  category?: string;
}

export const useSearchGuides = ({ query, category }: UseSearchGuidesParams) => {
  return useInfiniteQuery({
    queryKey: ['guides', 'search', { query, category }],
    queryFn: async ({ pageParam = 1 }) => {
      const params: Record<string, any> = {
        q: query,
        page: pageParam,
        limit: 20,
      };

      if (category) {
        params.category = category;
      }

      const response = await axiosInstance.get<GuidesSearchResponse>('/api/guides/search', {
        params,
      });

      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: query.length > 0,
  });
};
