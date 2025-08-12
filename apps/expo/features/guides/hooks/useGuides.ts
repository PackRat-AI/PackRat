import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { GuidesListResponse } from '../types';

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
      const params: Record<string, string | number> = {
        page: pageParam,
        limit: 20,
      };

      if (category) {
        params.category = category;
      }

      if (sort) {
        params['sort[field]'] = sort.field;
        params['sort[order]'] = sort.order;
      }

      const response = await axiosInstance.get<GuidesListResponse>('/api/guides', {
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
  });
};
