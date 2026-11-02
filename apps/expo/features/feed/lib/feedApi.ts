import * as Sentry from '@sentry/react-native';
import { apiClient } from 'expo-app/lib/api/packrat';
import type {
  Comment,
  FeedReportReason,
  FeedResponse,
  FeedScope,
  Post,
  PostAuthor,
  SocialSettings,
} from '../types';
import { FeedApiError, serverMessage } from '../utils/errorCopy';

type TreatyError = { status: unknown; value: unknown } | null;

/**
 * Unwraps an Eden Treaty response. A refused or failed request is reported to Sentry and thrown
 * as a `FeedApiError`, which keeps the server's human-readable reason for the alert copy.
 */
function unwrap<T>({
  data,
  error,
  action,
  extra,
}: {
  data: T | null | undefined;
  error: TreatyError;
  action: string;
  extra?: Record<string, unknown>;
}): T {
  if (error || data == null) {
    const status = typeof error?.status === 'number' ? error.status : 0;
    const err = new FeedApiError({
      message: `Feed ${action} failed (${status})`,
      status,
      serverMessage: serverMessage(error?.value),
    });
    Sentry.captureException(err, {
      tags: { feature: 'feed', action },
      extra: { ...extra, httpStatus: status, errorCode: serverMessage(error?.value) },
    });
    throw err;
  }
  return data;
}

const id = (postId: number) => ({ postId: String(postId) });

export async function listPosts({ scope, page }: { scope: FeedScope; page: number }) {
  const query = { query: { page, limit: 20 } };
  const response =
    scope === 'saved'
      ? await apiClient.feed.saved.get(query)
      : scope === 'tagged'
        ? await apiClient.feed.tagged.get(query)
        : await apiClient.feed.get(query);
  return unwrap<FeedResponse>({ ...response, action: 'listPosts', extra: { scope, page } });
}

export async function getPost(postId: number) {
  const response = await apiClient.feed(id(postId)).get();
  return unwrap<Post>({ ...response, action: 'getPost', extra: { postId } });
}

export async function getSharedPost(publicId: string) {
  const response = await apiClient.feed.shared({ publicId }).get();
  return unwrap<Post>({ ...response, action: 'getSharedPost', extra: { publicId } });
}

export async function createPost(body: {
  caption?: string;
  images: string[];
  taggedUserIds: string[];
}) {
  const response = await apiClient.feed.post(body);
  return unwrap<Post>({
    ...response,
    action: 'createPost',
    extra: { photoCount: body.images.length },
  });
}

export async function updateCaption({
  postId,
  caption,
  taggedUserIds,
}: {
  postId: number;
  caption: string | null;
  taggedUserIds: string[];
}) {
  const response = await apiClient.feed(id(postId)).patch({ caption, taggedUserIds });
  return unwrap<Post>({ ...response, action: 'updateCaption', extra: { postId } });
}

export async function deletePost(postId: number) {
  const response = await apiClient.feed(id(postId)).delete();
  unwrap({ ...response, data: response.data ?? true, action: 'deletePost', extra: { postId } });
}

export async function toggleLike(postId: number) {
  const response = await apiClient.feed(id(postId)).like.post();
  return unwrap<{ liked: boolean; likeCount: number }>({
    ...response,
    action: 'togglePostLike',
    extra: { postId },
  });
}

export async function setSaved({ postId, saved }: { postId: number; saved: boolean }) {
  const route = apiClient.feed(id(postId)).save;
  const response = saved ? await route.post() : await route.delete();
  return unwrap<{ saved: boolean }>({ ...response, action: 'setSaved', extra: { postId, saved } });
}

export async function removeMyTag(postId: number) {
  const response = await apiClient.feed(id(postId)).tags.me.delete();
  unwrap({ ...response, data: response.data ?? true, action: 'removeMyTag', extra: { postId } });
}

/** Every comment on a post, oldest first. Pages through the 50-per-page limit, up to 20 pages. */
export async function listComments(postId: number) {
  const comments: Comment[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await apiClient.feed(id(postId)).comments.get({ query: { page, limit: 50 } });
    const data = unwrap<{ items: Comment[]; totalPages: number }>({
      ...response,
      action: 'listComments',
      extra: { postId, page },
    });
    comments.push(...data.items);
    if (page >= data.totalPages) break;
  }
  return comments;
}

export async function addComment({
  postId,
  content,
  parentCommentId,
  taggedUserIds,
}: {
  postId: number;
  content: string;
  parentCommentId?: number;
  taggedUserIds: string[];
}) {
  const response = await apiClient.feed(id(postId)).comments.post({
    content,
    taggedUserIds,
    ...(parentCommentId !== undefined ? { parentCommentId } : {}),
  });
  return unwrap<Comment>({ ...response, action: 'addComment', extra: { postId, parentCommentId } });
}

export async function editComment({
  postId,
  commentId,
  content,
  taggedUserIds,
}: {
  postId: number;
  commentId: number;
  content: string;
  taggedUserIds: string[];
}) {
  const response = await apiClient
    .feed(id(postId))
    .comments({ commentId: String(commentId) })
    .patch({ content, taggedUserIds });
  return unwrap<Pick<Comment, 'id' | 'content' | 'editedAt'>>({
    ...response,
    action: 'editComment',
    extra: { postId, commentId },
  });
}

export async function deleteComment({ postId, commentId }: { postId: number; commentId: number }) {
  const response = await apiClient
    .feed(id(postId))
    .comments({ commentId: String(commentId) })
    .delete();
  unwrap({
    ...response,
    data: response.data ?? true,
    action: 'deleteComment',
    extra: { postId, commentId },
  });
}

export async function toggleCommentLike({
  postId,
  commentId,
}: {
  postId: number;
  commentId: number;
}) {
  const response = await apiClient
    .feed(id(postId))
    .comments({ commentId: String(commentId) })
    .like.post();
  return unwrap<{ liked: boolean; likeCount: number }>({
    ...response,
    action: 'toggleCommentLike',
    extra: { postId, commentId },
  });
}

export async function report(
  body:
    | { postId: number; reason: FeedReportReason }
    | { commentId: number; reason: FeedReportReason },
) {
  const response = await apiClient.feed.reports.post(body);
  unwrap({ ...response, data: response.data ?? true, action: 'report', extra: body });
}

export async function listBlocked() {
  const response = await apiClient.feed.blocks.get();
  return unwrap<{ items: PostAuthor[] }>({ ...response, action: 'listBlocked' }).items;
}

export async function blockUser(userId: string) {
  const response = await apiClient.feed.blocks.post({ userId });
  unwrap({ ...response, data: response.data ?? true, action: 'blockUser', extra: { userId } });
}

export async function unblockUser(userId: string) {
  const response = await apiClient.feed.blocks({ userId }).delete();
  unwrap({ ...response, data: response.data ?? true, action: 'unblockUser', extra: { userId } });
}

export async function getSettings() {
  const response = await apiClient.feed.settings.get();
  return unwrap<SocialSettings>({ ...response, action: 'getSettings' });
}

export async function updateSettings(changes: Partial<SocialSettings>) {
  const response = await apiClient.feed.settings.patch(changes);
  return unwrap<SocialSettings>({ ...response, action: 'updateSettings', extra: changes });
}

export async function mentionSuggestions(q: string) {
  const response = await apiClient.feed.mentions.get({ query: { q } });
  return unwrap<{ items: PostAuthor[] }>({ ...response, action: 'mentionSuggestions' }).items;
}
