import type { ApiClient } from '../../shared/api';

export const getFeed = (client: ApiClient, params: { page?: number; limit?: number } = {}) =>
  client.feed.get({ query: { page: params.page ?? 1, limit: params.limit ?? 20 } });

export const createPost = (client: ApiClient, body: { caption?: string; images: string[] }) =>
  client.feed.post(body);

export const addComment = (
  client: ApiClient,
  { postId, body }: { postId: number; body: { content: string; parentCommentId?: number } },
) => client.feed({ postId }).comments.post(body);

export const togglePostLike = (client: ApiClient, postId: number) =>
  client.feed({ postId }).like.post();
