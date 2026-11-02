import type { Comment } from '../types';

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

/**
 * Groups comments into top-level threads with their replies underneath.
 *
 * The API returns comments flat and oldest first, with replies pointing at their thread's root
 * through `parentCommentId` (it flattens a reply to a reply onto the root). A reply whose parent is
 * gone — deleted, reported or from a blocked person — is shown as its own thread rather than
 * dropped.
 */
export function commentThreads(comments: Comment[]): CommentThread[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const roots: Comment[] = [];
  const replies = new Map<number, Comment[]>();
  for (const comment of comments) {
    const parent = comment.parentCommentId;
    if (parent !== null && ids.has(parent)) {
      replies.set(parent, [...(replies.get(parent) ?? []), comment]);
    } else {
      roots.push(comment);
    }
  }
  return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
}

/** The comment a reply attaches to: threads go one level deep, so replying to a reply joins its thread. */
export function replyParentId(comment: Pick<Comment, 'id' | 'parentCommentId'>): number {
  return comment.parentCommentId ?? comment.id;
}
