import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const usePostComments = (postId: number) => {
  return useInfiniteQuery({
    queryKey: ['feed', postId, 'comments'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient
        .feed({ postId: String(postId) })
        .comments.get({ query: { page: pageParam, limit: 20 } });
      if (error) throw new Error(`Failed to fetch comments: ${error.value}`);
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
