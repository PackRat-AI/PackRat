import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment,
  deleteComment,
  editComment,
  listComments,
  report,
  toggleCommentLike,
} from '../lib/feedApi';
import type { Comment, FeedReportReason } from '../types';
import { updateCachedPost } from './postCache';
import { feedKeys } from './queryKeys';

export const usePostComments = (postId: number) =>
  useQuery({ queryKey: feedKeys.comments(postId), queryFn: () => listComments(postId) });

/** Writes to a post's comments, keeping the cached thread and the post's comment count in step. */
export const useCommentMutations = (postId: number) => {
  const queryClient = useQueryClient();
  const key = feedKeys.comments(postId);

  const setComments = (update: (comments: Comment[]) => Comment[]) => {
    const next = update(queryClient.getQueryData<Comment[]>(key) ?? []);
    queryClient.setQueryData<Comment[]>(key, next);
    updateCachedPost({ queryClient, postId, update: (p) => ({ ...p, commentCount: next.length }) });
  };

  const add = useMutation({
    mutationFn: (input: { content: string; parentCommentId?: number; taggedUserIds: string[] }) =>
      addComment({ postId, ...input }),
    onSuccess: (comment) => setComments((comments) => [...comments, comment]),
  });

  const edit = useMutation({
    mutationFn: (input: { commentId: number; content: string; taggedUserIds: string[] }) =>
      editComment({ postId, ...input }),
    onSuccess: (updated) =>
      setComments((comments) =>
        comments.map((c) =>
          c.id === updated.id ? { ...c, content: updated.content, editedAt: updated.editedAt } : c,
        ),
      ),
  });

  const remove = useMutation({
    mutationFn: (comment: Comment) => deleteComment({ postId, commentId: comment.id }),
    // Replies to a deleted comment stay; the server re-roots them.
    onSuccess: (_data, comment) =>
      setComments((comments) => comments.filter((c) => c.id !== comment.id)),
  });

  const like = useMutation({
    mutationFn: (comment: Comment) => toggleCommentLike({ postId, commentId: comment.id }),
    onMutate: (comment) =>
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                likedByMe: !comment.likedByMe,
                likeCount: Math.max(0, c.likeCount + (comment.likedByMe ? -1 : 1)),
              }
            : c,
        ),
      ),
    onSuccess: ({ liked, likeCount }, comment) =>
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((c) => (c.id === comment.id ? { ...c, likedByMe: liked, likeCount } : c)),
      ),
    onError: (_error, comment) =>
      queryClient.setQueryData<Comment[]>(key, (comments) =>
        comments?.map((c) =>
          c.id === comment.id
            ? { ...c, likedByMe: comment.likedByMe, likeCount: comment.likeCount }
            : c,
        ),
      ),
  });

  const reportComment = useMutation({
    mutationFn: ({ comment, reason }: { comment: Comment; reason: FeedReportReason }) =>
      report({ commentId: comment.id, reason }),
    onSuccess: (_data, { comment }) =>
      setComments((comments) => comments.filter((c) => c.id !== comment.id)),
  });

  return { add, edit, remove, like, report: reportComment };
};
