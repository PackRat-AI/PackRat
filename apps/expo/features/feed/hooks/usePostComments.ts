import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { CommentsResponse } from '../types';

export const usePostComments = (postId: number) => {
  return useInfiniteQuery({
    queryKey: ['feed', postId, 'comments'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await axiosInstance.get<CommentsResponse>(
        `/api/feed/${postId}/comments`,
        { params: { page: pageParam, limit: 20 } },
      );
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
