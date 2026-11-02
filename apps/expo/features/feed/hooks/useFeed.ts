import { useInfiniteQuery } from '@tanstack/react-query';
import { listPosts } from '../lib/feedApi';
import type { FeedScope } from '../types';
import { feedKeys } from './queryKeys';

export const useFeed = (scope: FeedScope = 'all', { enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: feedKeys.list(scope),
    queryFn: ({ pageParam }) => listPosts({ scope, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled,
  });
