import type { FeedScope } from '../types';

/** Every feed query lives under `['feed']`, so one invalidation refreshes the lot. */
export const feedKeys = Object.freeze({
  all: ['feed'] as const,
  lists: ['feed', 'list'] as const,
  list: (scope: FeedScope) => ['feed', 'list', scope] as const,
  post: (postId: number) => ['feed', 'post', postId] as const,
  shared: (publicId: string) => ['feed', 'shared', publicId] as const,
  comments: (postId: number) => ['feed', 'post', postId, 'comments'] as const,
  settings: ['feed', 'settings'] as const,
  blocks: ['feed', 'blocks'] as const,
  mentions: (q: string) => ['feed', 'mentions', q] as const,
});
