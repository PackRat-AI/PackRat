import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';
import { addComment, createPost, getFeed, togglePostLike } from './api';

export function useFeed() {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await getFeed(client, { page: pageParam as number, limit: 20 });
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

export function useCreatePostMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { caption?: string; images: string[] }) => {
      const { data, error } = await createPost(client, body);
      if (error) throw new Error('Failed to create post');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });
}

export function useAddCommentMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      body,
    }: {
      postId: number;
      body: { content: string; parentCommentId?: number };
    }) => {
      const { data, error } = await addComment(client, { postId, body });
      if (error) throw new Error('Failed to add comment');
      return data;
    },
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}

export function useTogglePostLikeMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const { data, error } = await togglePostLike(client, postId);
      if (error) throw new Error('Failed to toggle post like');
      return data;
    },
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: queryKeys.feed() });
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}
