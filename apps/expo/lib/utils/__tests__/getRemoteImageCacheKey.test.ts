import { describe, expect, it } from 'vitest';

import { getRemoteImageCacheKey } from '../getRemoteImageCacheKey';

describe('getRemoteImageCacheKey', () => {
  describe('determinism', () => {
    it('returns the same key for the same URL', () => {
      const url = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
      expect(getRemoteImageCacheKey({ url })).toBe(getRemoteImageCacheKey({ url }));
    });

    it('returns different keys for different URLs', () => {
      const a = getRemoteImageCacheKey({ url: 'https://example.com/a.jpg' });
      const b = getRemoteImageCacheKey({ url: 'https://example.com/b.jpg' });
      expect(a).not.toBe(b);
    });
  });

  describe('filesystem safety', () => {
    it('produces a key without slashes, query strings, or hashes', () => {
      const key = getRemoteImageCacheKey({
        url: 'https://cdn.example.com/path/to/avatar.png?size=200#frag',
      });
      expect(key).not.toMatch(/[/?#]/);
    });

    it('ignores query strings when deriving the extension', () => {
      const key = getRemoteImageCacheKey({ url: 'https://example.com/avatar.jpg?v=2' });
      expect(key.endsWith('.jpg')).toBe(true);
    });
  });

  describe('prefix', () => {
    it('defaults to the remote-img prefix', () => {
      const key = getRemoteImageCacheKey({ url: 'https://example.com/a.jpg' });
      expect(key.startsWith('remote-img-')).toBe(true);
    });

    it('uses a custom prefix when provided', () => {
      const key = getRemoteImageCacheKey({
        url: 'https://example.com/a.jpg',
        prefix: 'oauth-avatar',
      });
      expect(key.startsWith('oauth-avatar-')).toBe(true);
    });
  });

  describe('extension handling', () => {
    it('preserves and lowercases a known extension', () => {
      const key = getRemoteImageCacheKey({ url: 'https://example.com/PHOTO.PNG' });
      expect(key.endsWith('.png')).toBe(true);
    });

    it('omits the extension when the URL has none', () => {
      const key = getRemoteImageCacheKey({ url: 'https://lh3.googleusercontent.com/a/ACg8ocK' });
      expect(key).not.toMatch(/\.[a-z0-9]+$/i);
    });

    it('omits the extension when the last segment is empty', () => {
      const key = getRemoteImageCacheKey({ url: 'https://example.com/avatars/' });
      expect(key).not.toMatch(/\.[a-z0-9]+$/i);
    });
  });
});
