import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { FeedResponse } from '../types';

export const useFeed = () => {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await axiosInstance.get<FeedResponse>('/api/feed', {
        params: { page: pageParam, limit: 20 },
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
