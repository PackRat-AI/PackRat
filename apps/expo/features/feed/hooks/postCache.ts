import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { FeedResponse, Post } from '../types';
import { feedKeys } from './queryKeys';

/** Applies `update` to one post wherever it is cached: every feed list and its detail query. */
export function updateCachedPost({
  queryClient,
  postId,
  update,
}: {
  queryClient: QueryClient;
  postId: number;
  update: (post: Post) => Post;
}) {
  queryClient.setQueriesData<InfiniteData<FeedResponse>>({ queryKey: feedKeys.lists }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? update(post) : post)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<Post>(feedKeys.post(postId), (post) => (post ? update(post) : post));
}

/** Drops a post from every cached list — deleted, reported, or by someone just blocked. */
export function removeCachedPosts({
  queryClient,
  keep,
}: {
  queryClient: QueryClient;
  keep: (post: Post) => boolean;
}) {
  queryClient.setQueriesData<InfiniteData<FeedResponse>>({ queryKey: feedKeys.lists }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({ ...page, items: page.items.filter(keep) })),
        }
      : data,
  );
}
