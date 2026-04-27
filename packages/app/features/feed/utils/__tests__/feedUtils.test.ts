import { describe, expect, it, vi } from 'vitest';

// Mock clientEnvs before importing the module under test so that
// buildPostImageUrl has a deterministic CDN base URL.
vi.mock('@packrat/env/expo-client', () => ({
  clientEnvs: {
    EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.example.com',
  },
}));

// Also mock getRelativeTime so that formatRelativeDate has a predictable
// alias target that does not depend on the current clock.
vi.mock('app/lib/utils/getRelativeTime', () => ({
  getRelativeTime: (input: string | Date) => `relative(${String(input)})`,
}));

import type { Comment, Post } from '../../types';
import { buildPostImageUrl, formatAuthorName, formatRelativeDate } from '../index';

const basePost: Post = {
  id: 1,
  userId: 42,
  caption: 'hello',
  images: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
};

const baseComment: Comment = {
  id: 1,
  postId: 1,
  userId: 42,
  content: 'nice',
  parentCommentId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  likeCount: 0,
  likedByMe: false,
};

describe('feed/utils', () => {
  // ---------------------------------------------------------------------------
  // buildPostImageUrl
  // ---------------------------------------------------------------------------
  describe('buildPostImageUrl', () => {
    it('joins the CDN base URL with the image key', () => {
      expect(buildPostImageUrl('posts/abc.jpg')).toBe('https://cdn.example.com/posts/abc.jpg');
    });

    it('does not double-encode or trim the image key', () => {
      expect(buildPostImageUrl('folder/sub folder/image (1).png')).toBe(
        'https://cdn.example.com/folder/sub folder/image (1).png',
      );
    });

    it('handles an empty image key by returning the base URL with a trailing slash', () => {
      expect(buildPostImageUrl('')).toBe('https://cdn.example.com/');
    });
  });

  // ---------------------------------------------------------------------------
  // formatAuthorName
  // ---------------------------------------------------------------------------
  describe('formatAuthorName', () => {
    it('returns "Unknown" when the author is missing', () => {
      expect(formatAuthorName(basePost)).toBe('Unknown');
      expect(formatAuthorName(baseComment)).toBe('Unknown');
    });

    it('returns "first last" when both names are present', () => {
      const post: Post = {
        ...basePost,
        author: { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
      };
      expect(formatAuthorName(post)).toBe('Ada Lovelace');
    });

    it('returns just the first name when only firstName is present', () => {
      const post: Post = {
        ...basePost,
        author: { id: 1, firstName: 'Ada', lastName: null },
      };
      expect(formatAuthorName(post)).toBe('Ada');
    });

    it('returns just the last name when only lastName is present', () => {
      const post: Post = {
        ...basePost,
        author: { id: 1, firstName: null, lastName: 'Lovelace' },
      };
      expect(formatAuthorName(post)).toBe('Lovelace');
    });

    it('returns "User" when the author exists but both names are null', () => {
      const post: Post = {
        ...basePost,
        author: { id: 1, firstName: null, lastName: null },
      };
      expect(formatAuthorName(post)).toBe('User');
    });

    it('also works for Comment entities', () => {
      const comment: Comment = {
        ...baseComment,
        author: { id: 1, firstName: 'Grace', lastName: 'Hopper' },
      };
      expect(formatAuthorName(comment)).toBe('Grace Hopper');
    });
  });

  // ---------------------------------------------------------------------------
  // formatRelativeDate (deprecated alias of getRelativeTime)
  // ---------------------------------------------------------------------------
  describe('formatRelativeDate', () => {
    it('delegates to getRelativeTime', () => {
      expect(formatRelativeDate('2024-01-01T00:00:00.000Z')).toBe(
        'relative(2024-01-01T00:00:00.000Z)',
      );
    });
  });
});
