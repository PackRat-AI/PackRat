import { describe, expect, it } from 'vitest';
import type { Comment } from '../../types';
import { commentThreads, replyParentId } from '../commentThreads';

const comment = (id: number, parentCommentId: number | null = null): Comment => ({
  id,
  postId: 1,
  userId: 'u1',
  content: `c${id}`,
  parentCommentId,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  likeCount: 0,
  likedByMe: false,
});

describe('commentThreads', () => {
  it('puts replies under their root in order', () => {
    const threads = commentThreads([comment(1), comment(2), comment(3, 1), comment(4, 1)]);
    expect(threads.map((t) => [t.root.id, t.replies.map((r) => r.id)])).toEqual([
      [1, [3, 4]],
      [2, []],
    ]);
  });

  it('shows a reply whose parent is gone as its own thread', () => {
    const threads = commentThreads([comment(5, 99)]);
    expect(threads.map((t) => t.root.id)).toEqual([5]);
  });
});

describe('replyParentId', () => {
  it('attaches to the thread root', () => {
    expect(replyParentId(comment(3, 1))).toBe(1);
    expect(replyParentId(comment(2))).toBe(2);
  });
});
