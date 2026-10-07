import { users } from '@packrat/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every query in feedService starts with `db.tag(label)`, so the fake db records
 * each tagged chain (label + method calls) and resolves it with whatever the test
 * queued for that label, defaulting to `[]`. Untagged chains are the subqueries
 * built inside `visibleAuthor`/`notReported*` — they are embedded in a where
 * clause and never awaited, so they stay inert.
 */
type Call = { method: string; args: unknown[] };
type Query = { label: string; calls: Call[] };

const mocks = vi.hoisted(() => ({
  queries: [] as Array<{ label: string; calls: Array<{ method: string; args: unknown[] }> }>,
  results: new Map<string, unknown[]>(),
  notifyFeedRecipients: vi.fn(async () => {}),
  publishCommentsChanged: vi.fn(async () => {}),
}));

function chain(query: Query | null): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          if (!query) return undefined;
          const queued = mocks.results.get(query.label);
          const value = queued && queued.length > 0 ? queued.shift() : [];
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (typeof prop === 'symbol') return undefined;
        return (...args: unknown[]) => {
          query?.calls.push({ method: prop, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock('@packrat/api/db', () => {
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'tag') {
          return (label: string) => {
            const query: Query = { label, calls: [] };
            mocks.queries.push(query);
            return chain(query);
          };
        }
        return () => chain(null);
      },
    },
  );
  return { createDb: () => db };
});

vi.mock('@packrat/api/services/push/notifyFeed', () => ({
  notifyFeedRecipients: mocks.notifyFeedRecipients,
  runAfterResponse: async (task: () => Promise<void>) => task(),
}));

vi.mock('@packrat/api/services/feedLive', () => ({
  publishCommentsChanged: mocks.publishCommentsChanged,
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: () => ({ R2_PUBLIC_URL: 'https://cdn.example.com/' }),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, ilike: vi.fn(actual.ilike) };
});

import * as drizzle from 'drizzle-orm';
import * as feed from '../feedService';

/** Queue results for the next awaits of `label`, in order. */
function respond(label: string, ...values: unknown[]) {
  mocks.results.set(label, [...(mocks.results.get(label) ?? []), ...values]);
}

function queriesFor(label: string): Query[] {
  return mocks.queries.filter((q) => q.label === label);
}

/** First argument of `method` on the first query tagged `label`. */
function argOf(label: string, method: string): unknown {
  return queriesFor(label)[0]?.calls.find((c) => c.method === method)?.args[0];
}

const AUTHOR = 'author-1';
const VIEWER = 'viewer-1';
const T0 = new Date('2026-09-01T10:00:00.000Z');
const T1 = new Date('2026-09-02T10:00:00.000Z');

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: AUTHOR,
    caption: 'Summit day',
    images: [`${AUTHOR}-a.jpg`],
    publicId: '00000000-0000-4000-8000-000000000001',
    captionEditedAt: null,
    createdAt: T0,
    updatedAt: T0,
    firstName: 'Ana',
    lastName: 'Lee',
    avatarUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries.length = 0;
  mocks.results.clear();
});

describe('displayName', () => {
  it('joins first and last name', () => {
    expect(feed.displayName({ firstName: 'Ana', lastName: 'Lee' })).toBe('Ana Lee');
  });

  it('falls back to the account name, then to "Someone"', () => {
    expect(feed.displayName({ firstName: null, lastName: null, name: ' ana ' })).toBe('ana');
    expect(feed.displayName({ firstName: null, lastName: null })).toBe('Someone');
  });
});

describe('listPosts', () => {
  it('hydrates counts, likes, saves and tags for each post', async () => {
    respond('feed.countPosts', [{ count: 3 }]);
    respond('feed.listPosts', [
      postRow({ id: 1, captionEditedAt: T1 }),
      postRow({ id: 2, images: null }),
    ]);
    respond('feed.countPostLikes', [{ postId: 1, cnt: 4 }]);
    respond('feed.myPostLikes', [{ postId: 1 }]);
    respond('feed.countComments', [{ postId: 2, cnt: 7 }]);
    respond('feed.mySaves', [{ postId: 2 }]);
    respond('feed.listTags', [
      { postId: 1, id: 'u-a', firstName: 'A', lastName: null, avatarUrl: null },
      { postId: 1, id: 'u-b', firstName: 'B', lastName: null, avatarUrl: 'b.jpg' },
    ]);

    const result = await feed.listPosts({ viewerId: VIEWER, page: 2, limit: 2, scope: 'all' });

    expect(result).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(argOf('feed.listPosts', 'offset')).toBe(2);
    expect(result.items[0]).toMatchObject({
      id: 1,
      likeCount: 4,
      likedByMe: true,
      commentCount: 0,
      savedByMe: false,
      captionEditedAt: T1.toISOString(),
      createdAt: T0.toISOString(),
      author: { id: AUTHOR, firstName: 'Ana', lastName: 'Lee', avatarUrl: null },
      tags: [
        { id: 'u-a', firstName: 'A', lastName: null, avatarUrl: null },
        { id: 'u-b', firstName: 'B', lastName: null, avatarUrl: 'b.jpg' },
      ],
    });
    expect(result.items[1]).toMatchObject({
      id: 2,
      images: [],
      likeCount: 0,
      likedByMe: false,
      commentCount: 7,
      savedByMe: true,
      captionEditedAt: null,
      tags: [],
    });
  });

  it.each([
    'saved',
    'tagged',
  ] as const)('returns an empty %s page without hydrating', async (scope) => {
    const result = await feed.listPosts({ viewerId: VIEWER, page: 1, limit: 20, scope });

    expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    expect(queriesFor('feed.countPostLikes')).toHaveLength(0);
  });
});

describe('getPost / getPostByPublicId', () => {
  it('returns 404 when the post is not visible', async () => {
    expect(await feed.getPost({ viewerId: VIEWER, postId: 9 })).toEqual({
      ok: false,
      status: 404,
      error: 'Post not found',
    });
  });

  it('resolves a share-link id to the hydrated post', async () => {
    respond('feed.getPostIdByPublicId', [{ id: 5 }]);
    respond('feed.getPost', [postRow({ id: 5 })]);

    const result = await feed.getPostByPublicId({ viewerId: VIEWER, publicId: 'pub' });

    expect(result).toMatchObject({ ok: true, value: { id: 5, caption: 'Summit day' } });
  });

  it('returns 404 for an unknown share-link id', async () => {
    const result = await feed.getPostByPublicId({ viewerId: VIEWER, publicId: 'nope' });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(queriesFor('feed.getPost')).toHaveLength(0);
  });
});

describe('createPost', () => {
  it('rejects a suspended user with 403 before writing anything', async () => {
    respond('feed.checkSuspended', [{ suspendedAt: T0 }]);

    const result = await feed.createPost({
      userId: AUTHOR,
      caption: 'hi',
      images: [],
      taggedUserIds: undefined,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'Posting is suspended for this account',
    });
    expect(queriesFor('feed.createPost')).toHaveLength(0);
  });

  it.each([
    ['owned by someone else', 'someone-else-a.jpg'],
    ['containing a path', `${AUTHOR}-x/../other.jpg`],
  ])('rejects an image key %s with 400', async (_case, key) => {
    const result = await feed.createPost({
      userId: AUTHOR,
      caption: undefined,
      images: [`${AUTHOR}-ok.jpg`, key],
      taggedUserIds: undefined,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Images must be uploaded by the poster',
    });
    expect(queriesFor('feed.createPost')).toHaveLength(0);
  });

  it('trims the caption and stores the images', async () => {
    respond('feed.createPost', [{ id: 11 }]);
    respond('feed.getPost', [postRow({ id: 11 })]);

    const result = await feed.createPost({
      userId: AUTHOR,
      caption: '  Summit day  ',
      images: [`${AUTHOR}-a.jpg`],
      taggedUserIds: undefined,
    });

    expect(argOf('feed.createPost', 'values')).toEqual({
      userId: AUTHOR,
      caption: 'Summit day',
      images: [`${AUTHOR}-a.jpg`],
    });
    expect(result).toMatchObject({ ok: true, value: { id: 11 } });
    expect(queriesFor('feed.filterTaggable')).toHaveLength(0);
  });

  it('stores a whitespace-only caption as null', async () => {
    respond('feed.createPost', [{ id: 11 }]);

    await feed.createPost({
      userId: AUTHOR,
      caption: '   ',
      images: [`${AUTHOR}-a.jpg`],
      taggedUserIds: undefined,
    });

    expect(argOf('feed.createPost', 'values')).toMatchObject({ caption: null });
  });

  it('returns 400 when the insert returns no row', async () => {
    const result = await feed.createPost({
      userId: AUTHOR,
      caption: 'x',
      images: [],
      taggedUserIds: undefined,
    });

    expect(result).toEqual({ ok: false, status: 400, error: 'Failed to create post' });
  });

  it('tags only allowed users and notifies only the newly tagged', async () => {
    respond('feed.createPost', [{ id: 11 }]);
    respond('feed.filterTaggable', [{ id: 'u-a' }, { id: 'u-b' }]);
    // u-b was already tagged, so the conflict-skipping insert only returns u-a.
    respond('feed.insertTags', [{ userId: 'u-a' }]);
    respond('feed.getAuthorName', [{ firstName: 'Ana', lastName: 'Lee', name: 'ana' }]);

    await feed.createPost({
      userId: AUTHOR,
      caption: 'x',
      images: [],
      taggedUserIds: ['u-a', 'u-b', 'u-a', AUTHOR, 'u-blocked'],
    });

    expect(argOf('feed.insertTags', 'values')).toEqual([
      { postId: 11, userId: 'u-a', taggedBy: AUTHOR },
      { postId: 11, userId: 'u-b', taggedBy: AUTHOR },
    ]);
    expect(mocks.notifyFeedRecipients).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFeedRecipients).toHaveBeenCalledWith({
      recipientIds: ['u-a'],
      kind: 'tag',
      title: 'Ana Lee tagged you',
      body: 'Tap to see the post.',
      postId: 11,
    });
  });

  it('skips the insert and notification when no candidate may be tagged', async () => {
    respond('feed.createPost', [{ id: 11 }]);

    await feed.createPost({ userId: AUTHOR, caption: 'x', images: [], taggedUserIds: ['u-x'] });

    expect(queriesFor('feed.insertTags')).toHaveLength(0);
    expect(mocks.notifyFeedRecipients).toHaveBeenCalledTimes(0);
  });

  it('names an unknown tagger "Someone"', async () => {
    respond('feed.createPost', [{ id: 11 }]);
    respond('feed.filterTaggable', [{ id: 'u-a' }]);
    respond('feed.insertTags', [{ userId: 'u-a' }]);

    await feed.createPost({ userId: AUTHOR, caption: 'x', images: [], taggedUserIds: ['u-a'] });

    expect(mocks.notifyFeedRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Someone tagged you' }),
    );
  });
});

describe('updatePost', () => {
  const args = { userId: AUTHOR, postId: 1, caption: ' new ', taggedUserIds: undefined };

  it('returns 404 for a missing post', async () => {
    expect(await feed.updatePost(args)).toMatchObject({ ok: false, status: 404 });
  });

  it("forbids editing someone else's post", async () => {
    respond('feed.getOwnPost', [{ id: 1, userId: 'other', images: [] }]);

    expect(await feed.updatePost(args)).toEqual({ ok: false, status: 403, error: 'Forbidden' });
    expect(queriesFor('feed.updatePostCaption')).toHaveLength(0);
  });

  it.each([
    [[]],
    [null],
  ])('rejects clearing the caption of a post with images %j', async (images) => {
    respond('feed.getOwnPost', [{ id: 1, userId: AUTHOR, images }]);

    const result = await feed.updatePost({ ...args, caption: '  ' });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'A post needs at least one photo or a caption',
    });
  });

  it('allows clearing the caption when the post has a photo', async () => {
    respond('feed.getOwnPost', [{ id: 1, userId: AUTHOR, images: ['a.jpg'] }]);

    await feed.updatePost({ ...args, caption: null });

    expect(argOf('feed.updatePostCaption', 'set')).toMatchObject({ caption: null });
  });

  it('stores the trimmed caption and stamps the edit', async () => {
    respond('feed.getOwnPost', [{ id: 1, userId: AUTHOR, images: [] }]);
    respond('feed.getPost', [postRow()]);

    const result = await feed.updatePost(args);

    const set = argOf('feed.updatePostCaption', 'set') as Record<string, unknown>;
    expect(set.caption).toBe('new');
    expect(set.captionEditedAt).toBeInstanceOf(Date);
    expect(set.updatedAt).toBe(set.captionEditedAt);
    expect(result).toMatchObject({ ok: true, value: { id: 1 } });
  });
});

describe('deletePost', () => {
  it('returns 404 for a missing post', async () => {
    expect(await feed.deletePost({ userId: AUTHOR, postId: 1 })).toMatchObject({ status: 404 });
  });

  it("forbids deleting someone else's post", async () => {
    respond('feed.getOwnPost', [{ userId: 'other' }]);

    expect(await feed.deletePost({ userId: AUTHOR, postId: 1 })).toMatchObject({ status: 403 });
    expect(queriesFor('feed.softDeletePost')).toHaveLength(0);
  });

  it('soft-deletes by setting deletedAt', async () => {
    respond('feed.getOwnPost', [{ userId: AUTHOR }]);

    expect(await feed.deletePost({ userId: AUTHOR, postId: 1 })).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(argOf('feed.softDeletePost', 'set')).toEqual({ deletedAt: expect.any(Date) });
  });
});

describe('togglePostLike', () => {
  it('returns 404 when the post is not visible', async () => {
    expect(await feed.togglePostLike({ userId: VIEWER, postId: 1 })).toMatchObject({
      status: 404,
    });
    expect(queriesFor('feed.unlikePost')).toHaveLength(0);
  });

  it('likes a post the viewer had not liked', async () => {
    respond('feed.getVisiblePost', [{ id: 1, userId: AUTHOR, caption: null }]);
    respond('feed.countLikes', [{ cnt: 3 }]);

    const result = await feed.togglePostLike({ userId: VIEWER, postId: 1 });

    expect(argOf('feed.likePost', 'values')).toEqual({ postId: 1, userId: VIEWER });
    expect(result).toEqual({ ok: true, value: { liked: true, likeCount: 3 } });
  });

  it('unlikes a post the viewer had liked', async () => {
    respond('feed.getVisiblePost', [{ id: 1, userId: AUTHOR, caption: null }]);
    respond('feed.unlikePost', [{ postId: 1, userId: VIEWER }]);

    const result = await feed.togglePostLike({ userId: VIEWER, postId: 1 });

    expect(queriesFor('feed.likePost')).toHaveLength(0);
    expect(result).toEqual({ ok: true, value: { liked: false, likeCount: 0 } });
  });
});

describe('setPostSaved / removeOwnTag', () => {
  it('returns 404 when saving a post the viewer cannot see', async () => {
    const result = await feed.setPostSaved({ userId: VIEWER, postId: 1, saved: true });

    expect(result).toMatchObject({ status: 404 });
    expect(queriesFor('feed.savePost')).toHaveLength(0);
  });

  it('saves a visible post', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);

    const result = await feed.setPostSaved({ userId: VIEWER, postId: 1, saved: true });

    expect(argOf('feed.savePost', 'values')).toEqual({ postId: 1, userId: VIEWER });
    expect(result).toEqual({ ok: true, value: { saved: true } });
  });

  it('unsaves without a visibility check', async () => {
    const result = await feed.setPostSaved({ userId: VIEWER, postId: 1, saved: false });

    expect(queriesFor('feed.unsavePost')).toHaveLength(1);
    expect(queriesFor('feed.getVisiblePost')).toHaveLength(0);
    expect(result).toEqual({ ok: true, value: { saved: false } });
  });

  it('removes the viewer from a post they were tagged in', async () => {
    expect(await feed.removeOwnTag({ userId: VIEWER, postId: 1 })).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(queriesFor('feed.removeOwnTag')).toHaveLength(1);
  });
});

describe('listComments', () => {
  it('returns 404 when the post is not visible', async () => {
    const result = await feed.listComments({ viewerId: VIEWER, postId: 1, page: 1, limit: 20 });

    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('returns comments with like counts and the viewer like state', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);
    respond('feed.countComments', [{ count: 2 }]);
    respond('feed.listComments', [
      {
        id: 10,
        postId: 1,
        userId: 'u-a',
        content: 'Nice',
        parentCommentId: null,
        editedAt: T1,
        createdAt: T0,
        updatedAt: T1,
        firstName: 'A',
        lastName: null,
        avatarUrl: null,
      },
      {
        id: 11,
        postId: 1,
        userId: 'u-b',
        content: 'Agreed',
        parentCommentId: 10,
        editedAt: null,
        createdAt: T0,
        updatedAt: T0,
        firstName: 'B',
        lastName: null,
        avatarUrl: null,
      },
    ]);
    respond('feed.countCommentLikes', [{ commentId: 10, cnt: 5 }]);
    respond('feed.myCommentLikes', [{ commentId: 11 }]);

    const result = await feed.listComments({ viewerId: VIEWER, postId: 1, page: 1, limit: 20 });

    expect(result).toMatchObject({
      ok: true,
      value: {
        total: 2,
        totalPages: 1,
        items: [
          { id: 10, likeCount: 5, likedByMe: false, editedAt: T1.toISOString() },
          { id: 11, likeCount: 0, likedByMe: true, editedAt: null, parentCommentId: 10 },
        ],
      },
    });
  });

  it('skips the like queries for an empty page', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);

    const result = await feed.listComments({ viewerId: VIEWER, postId: 1, page: 3, limit: 20 });

    expect(result).toEqual({
      ok: true,
      value: { items: [], page: 3, limit: 20, total: 0, totalPages: 0 },
    });
    expect(queriesFor('feed.myCommentLikes')).toHaveLength(0);
  });
});

describe('createComment', () => {
  const base = {
    userId: VIEWER,
    postId: 1,
    content: '  Great shot  ',
    parentCommentId: undefined,
    taggedUserIds: undefined,
  };

  function visiblePost(userId = AUTHOR) {
    respond('feed.getVisiblePost', [{ id: 1, userId, caption: null }]);
    respond('feed.createComment', [{ id: 50 }]);
    respond('feed.getAuthorName', [{ firstName: 'Vic', lastName: null, name: 'vic' }]);
  }

  function notifiedKinds() {
    return mocks.notifyFeedRecipients.mock.calls.map((c) => {
      const [arg] = c as unknown as [{ kind: string; recipientIds: string[] }];
      return [arg.kind, arg.recipientIds];
    });
  }

  it('rejects a suspended user with 403', async () => {
    respond('feed.checkSuspended', [{ suspendedAt: T0 }]);

    expect(await feed.createComment(base)).toEqual({
      ok: false,
      status: 403,
      error: 'Commenting is suspended for this account',
    });
  });

  it('returns 404 when the post is not visible', async () => {
    expect(await feed.createComment(base)).toMatchObject({ status: 404, error: 'Post not found' });
  });

  it('returns 404 when the parent comment is gone', async () => {
    respond('feed.getVisiblePost', [{ id: 1, userId: AUTHOR }]);

    const result = await feed.createComment({ ...base, parentCommentId: 99 });

    expect(result).toMatchObject({ status: 404, error: 'Comment not found' });
    expect(queriesFor('feed.createComment')).toHaveLength(0);
    expect(mocks.publishCommentsChanged).not.toHaveBeenCalled();
  });

  it('tells live viewers of the post that its comments changed', async () => {
    visiblePost();

    await feed.createComment(base);

    expect(mocks.publishCommentsChanged).toHaveBeenCalledWith({ postId: 1 });
  });

  it('returns 400 when the insert returns no row', async () => {
    respond('feed.getVisiblePost', [{ id: 1, userId: AUTHOR }]);

    expect(await feed.createComment(base)).toMatchObject({ status: 400 });
  });

  it('stores a top-level comment trimmed and notifies the post author', async () => {
    visiblePost();
    respond('feed.getCreatedComment', [
      { createdAt: T0, updatedAt: T1, firstName: 'Vic', lastName: 'R', avatarUrl: 'v.jpg' },
    ]);

    const result = await feed.createComment(base);

    expect(argOf('feed.createComment', 'values')).toEqual({
      postId: 1,
      userId: VIEWER,
      content: 'Great shot',
      parentCommentId: null,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        id: 50,
        postId: 1,
        userId: VIEWER,
        content: 'Great shot',
        parentCommentId: null,
        editedAt: null,
        createdAt: T0.toISOString(),
        updatedAt: T1.toISOString(),
        author: { id: VIEWER, firstName: 'Vic', lastName: 'R', avatarUrl: 'v.jpg' },
        likeCount: 0,
        likedByMe: false,
      },
    });
    expect(mocks.notifyFeedRecipients).toHaveBeenCalledWith({
      recipientIds: [AUTHOR],
      kind: 'comment',
      title: 'Vic commented on your post',
      body: 'Great shot',
      postId: 1,
    });
  });

  it('falls back to now and null author fields when the re-read misses', async () => {
    visiblePost();

    const result = await feed.createComment(base);

    expect(result).toMatchObject({
      ok: true,
      value: { author: { id: VIEWER, firstName: null, lastName: null, avatarUrl: null } },
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.updatedAt).toBe(result.value.createdAt);
  });

  it('flattens a reply-to-a-reply onto the thread root', async () => {
    visiblePost();
    respond('feed.getParentComment', [{ id: 21, userId: 'u-reply', parentCommentId: 20 }]);

    const result = await feed.createComment({ ...base, parentCommentId: 21 });

    expect(argOf('feed.createComment', 'values')).toMatchObject({ parentCommentId: 20 });
    expect(result).toMatchObject({ ok: true, value: { parentCommentId: 20 } });
  });

  it('threads a reply to a top-level comment under that comment', async () => {
    visiblePost();
    respond('feed.getParentComment', [{ id: 20, userId: 'u-root', parentCommentId: null }]);

    await feed.createComment({ ...base, parentCommentId: 20 });

    expect(argOf('feed.createComment', 'values')).toMatchObject({ parentCommentId: 20 });
  });

  it('notifies the replied-to commenter and the post author separately', async () => {
    visiblePost();
    respond('feed.getParentComment', [{ id: 20, userId: 'u-root', parentCommentId: null }]);

    await feed.createComment({ ...base, parentCommentId: 20 });

    expect(notifiedKinds()).toEqual([
      ['reply', ['u-root']],
      ['comment', [AUTHOR]],
    ]);
    expect(mocks.notifyFeedRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'reply', title: 'Vic replied to you' }),
    );
  });

  it('notifies the post author once when replying to their own comment', async () => {
    visiblePost();
    respond('feed.getParentComment', [{ id: 20, userId: AUTHOR, parentCommentId: null }]);

    await feed.createComment({ ...base, parentCommentId: 20 });

    expect(notifiedKinds()).toEqual([['reply', [AUTHOR]]]);
  });

  it('never notifies the commenter about their own comment or reply', async () => {
    visiblePost(VIEWER);
    respond('feed.getParentComment', [{ id: 20, userId: VIEWER, parentCommentId: null }]);

    await feed.createComment({ ...base, parentCommentId: 20 });

    expect(mocks.notifyFeedRecipients).toHaveBeenCalledTimes(0);
  });

  it('does not also send a reply or comment notification to someone just tagged', async () => {
    visiblePost();
    respond('feed.getParentComment', [{ id: 20, userId: 'u-root', parentCommentId: null }]);
    respond('feed.filterTaggable', [{ id: 'u-root' }, { id: AUTHOR }]);
    respond('feed.insertTags', [{ userId: 'u-root' }, { userId: AUTHOR }]);

    await feed.createComment({ ...base, parentCommentId: 20, taggedUserIds: ['u-root', AUTHOR] });

    expect(notifiedKinds()).toEqual([['tag', ['u-root', AUTHOR]]]);
  });

  it('truncates a long comment in the notification body', async () => {
    visiblePost();
    const long = 'a'.repeat(100);

    await feed.createComment({ ...base, content: long });

    expect(mocks.notifyFeedRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ body: `${'a'.repeat(79)}…` }),
    );
  });
});

describe('updateComment', () => {
  const args = { userId: VIEWER, postId: 1, commentId: 10, content: ' edited ', taggedUserIds: [] };

  it('returns 404 for a missing comment', async () => {
    expect(await feed.updateComment(args)).toMatchObject({ status: 404 });
  });

  it('only lets the commenter edit, not the post author', async () => {
    respond('feed.getComment', [{ id: 10, userId: 'someone-else' }]);

    expect(await feed.updateComment(args)).toMatchObject({ status: 403 });
    expect(queriesFor('feed.updateComment')).toHaveLength(0);
    expect(mocks.publishCommentsChanged).not.toHaveBeenCalled();
  });

  it('stores trimmed content and stamps editedAt', async () => {
    respond('feed.getComment', [{ id: 10, userId: VIEWER }]);

    const result = await feed.updateComment(args);

    const set = argOf('feed.updateComment', 'set') as Record<string, unknown>;
    expect(set).toMatchObject({ content: 'edited', editedAt: expect.any(Date) });
    expect(result).toEqual({
      ok: true,
      value: { id: 10, content: 'edited', editedAt: (set.editedAt as Date).toISOString() },
    });
    expect(mocks.publishCommentsChanged).toHaveBeenCalledWith({ postId: 1 });
  });
});

describe('deleteComment', () => {
  const args = { userId: AUTHOR, postId: 1, commentId: 10 };

  it('returns 404 for a missing comment', async () => {
    expect(await feed.deleteComment(args)).toMatchObject({ status: 404 });
  });

  it('lets the commenter soft-delete their own comment', async () => {
    respond('feed.getComment', [{ id: 10, userId: AUTHOR }]);

    expect(await feed.deleteComment(args)).toEqual({ ok: true, value: { success: true } });
    expect(queriesFor('feed.getPostOwner')).toHaveLength(0);
    expect(argOf('feed.softDeleteComment', 'set')).toEqual({ deletedAt: expect.any(Date) });
    expect(mocks.publishCommentsChanged).toHaveBeenCalledWith({ postId: 1 });
  });

  it("lets the post author delete anyone's comment on their post", async () => {
    respond('feed.getComment', [{ id: 10, userId: 'commenter' }]);
    respond('feed.getPostOwner', [{ userId: AUTHOR }]);

    expect(await feed.deleteComment(args)).toEqual({ ok: true, value: { success: true } });
    expect(queriesFor('feed.softDeleteComment')).toHaveLength(1);
  });

  it.each([
    ['a third party', [{ userId: 'post-owner' }]],
    ['anyone when the post is gone', []],
  ])('forbids %s', async (_case, ownerRows) => {
    respond('feed.getComment', [{ id: 10, userId: 'commenter' }]);
    respond('feed.getPostOwner', ownerRows);

    expect(await feed.deleteComment(args)).toEqual({ ok: false, status: 403, error: 'Forbidden' });
    expect(queriesFor('feed.softDeleteComment')).toHaveLength(0);
    expect(mocks.publishCommentsChanged).not.toHaveBeenCalled();
  });
});

describe('toggleCommentLike', () => {
  const args = { userId: VIEWER, postId: 1, commentId: 10 };

  it('returns 404 when the post is not visible', async () => {
    expect(await feed.toggleCommentLike(args)).toMatchObject({ error: 'Post not found' });
  });

  it('returns 404 when the comment is gone', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);

    expect(await feed.toggleCommentLike(args)).toMatchObject({ error: 'Comment not found' });
  });

  it('likes, then reports the new count', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);
    respond('feed.getComment', [{ id: 10, userId: AUTHOR }]);
    respond('feed.countCommentLikes', [{ cnt: 1 }]);

    expect(await feed.toggleCommentLike(args)).toEqual({
      ok: true,
      value: { liked: true, likeCount: 1 },
    });
    expect(argOf('feed.likeComment', 'values')).toEqual({ commentId: 10, userId: VIEWER });
    expect(mocks.publishCommentsChanged).toHaveBeenCalledWith({ postId: 1 });
  });

  it('unlikes a comment the viewer had liked', async () => {
    respond('feed.getVisiblePost', [{ id: 1 }]);
    respond('feed.getComment', [{ id: 10, userId: AUTHOR }]);
    respond('feed.unlikeComment', [{ commentId: 10 }]);

    expect(await feed.toggleCommentLike(args)).toEqual({
      ok: true,
      value: { liked: false, likeCount: 0 },
    });
    expect(queriesFor('feed.likeComment')).toHaveLength(0);
  });
});

describe('reportContent', () => {
  it('returns 404 for a missing post or comment', async () => {
    expect(
      await feed.reportContent({ userId: VIEWER, postId: 1, commentId: undefined, reason: 'spam' }),
    ).toMatchObject({ status: 404, error: 'Post not found' });
    expect(
      await feed.reportContent({ userId: VIEWER, postId: undefined, commentId: 2, reason: 'spam' }),
    ).toMatchObject({ status: 404, error: 'Comment not found' });
  });

  it('files a new report on a post', async () => {
    respond('feed.getReportedPost', [{ id: 1 }]);

    const result = await feed.reportContent({
      userId: VIEWER,
      postId: 1,
      commentId: undefined,
      reason: 'spam',
    });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(argOf('feed.createReport', 'values')).toEqual({
      reporterId: VIEWER,
      postId: 1,
      commentId: null,
      reason: 'spam',
    });
  });

  it('files a new report on a comment', async () => {
    respond('feed.getReportedComment', [{ id: 2 }]);

    await feed.reportContent({ userId: VIEWER, postId: undefined, commentId: 2, reason: 'spam' });

    expect(argOf('feed.createReport', 'values')).toMatchObject({ postId: null, commentId: 2 });
  });

  it('files a report with neither target as-is (the request schema requires one)', async () => {
    await feed.reportContent({
      userId: VIEWER,
      postId: undefined,
      commentId: undefined,
      reason: 'spam',
    });

    expect(argOf('feed.createReport', 'values')).toMatchObject({ postId: null, commentId: null });
  });

  it("dedupes a reporter's pending report on the same target", async () => {
    respond('feed.getReportedPost', [{ id: 1 }]);
    respond('feed.findOwnReport', [{ id: 77 }]);

    const result = await feed.reportContent({
      userId: VIEWER,
      postId: 1,
      commentId: undefined,
      reason: 'spam',
    });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(queriesFor('feed.createReport')).toHaveLength(0);
  });
});

describe('mentionSuggestions', () => {
  it('returns nothing for a blank query without hitting the database', async () => {
    expect(await feed.mentionSuggestions({ userId: VIEWER, query: '   ' })).toEqual([]);
    expect(mocks.queries).toHaveLength(0);
  });

  it('escapes LIKE wildcards in the search term', async () => {
    respond('feed.mentionSuggestions', [{ id: 'u-a', firstName: 'A', lastName: null }]);

    const result = await feed.mentionSuggestions({ userId: VIEWER, query: ' 50%_off\\ ' });

    expect(result).toEqual([{ id: 'u-a', firstName: 'A', lastName: null }]);
    expect(vi.mocked(drizzle.ilike)).toHaveBeenCalledWith(users.name, '%50\\%\\_off\\\\%');
    expect(argOf('feed.mentionSuggestions', 'limit')).toBe(8);
  });
});

describe('blocks', () => {
  it('lists the people the viewer blocked', async () => {
    respond('feed.listBlocked', [{ id: 'u-b', firstName: 'B', lastName: null, avatarUrl: null }]);

    expect(await feed.listBlocked({ userId: VIEWER })).toEqual([
      { id: 'u-b', firstName: 'B', lastName: null, avatarUrl: null },
    ]);
  });

  it('refuses to block yourself', async () => {
    expect(await feed.blockUser({ userId: VIEWER, blockedId: VIEWER })).toEqual({
      ok: false,
      status: 400,
      error: 'You cannot block yourself',
    });
  });

  it('returns 404 for an unknown user', async () => {
    expect(await feed.blockUser({ userId: VIEWER, blockedId: 'ghost' })).toMatchObject({
      status: 404,
    });
    expect(queriesFor('feed.blockUser')).toHaveLength(0);
  });

  it('blocks and removes tags between the two people', async () => {
    respond('feed.getBlockTarget', [{ id: 'u-b' }]);

    expect(await feed.blockUser({ userId: VIEWER, blockedId: 'u-b' })).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(argOf('feed.blockUser', 'values')).toEqual({ blockerId: VIEWER, blockedId: 'u-b' });
    expect(queriesFor('feed.removeTagsBetween')).toHaveLength(1);
  });

  it('unblocks', async () => {
    expect(await feed.unblockUser({ userId: VIEWER, blockedId: 'u-b' })).toEqual({
      ok: true,
      value: { success: true },
    });
    expect(queriesFor('feed.unblockUser')).toHaveLength(1);
  });
});

describe('settings', () => {
  it('defaults everything on when the user has no row', async () => {
    expect(await feed.getSettings({ userId: VIEWER })).toEqual({
      allowTagging: true,
      notifyTags: true,
      notifyComments: true,
      notifyReplies: true,
    });
  });

  it('merges changes over the stored row and upserts only the changes', async () => {
    const stored = {
      allowTagging: false,
      notifyTags: true,
      notifyComments: true,
      notifyReplies: true,
    };
    respond('feed.getSettings', [stored]);

    const result = await feed.updateSettings({ userId: VIEWER, changes: { notifyTags: false } });

    expect(result).toEqual({ ...stored, notifyTags: false });
    expect(argOf('feed.upsertSettings', 'values')).toEqual({
      userId: VIEWER,
      ...stored,
      notifyTags: false,
    });
    expect(argOf('feed.upsertSettings', 'onConflictDoUpdate')).toMatchObject({
      set: { notifyTags: false, updatedAt: expect.any(Date) },
    });
  });
});

describe('public share page', () => {
  it('resolves keys against R2_PUBLIC_URL and leaves absolute URLs alone', () => {
    expect(feed.resolveImageUrl('a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(feed.resolveImageUrl('http://x.test/a.jpg')).toBe('http://x.test/a.jpg');
  });

  it('returns 404 when the post is missing or hidden', async () => {
    expect(await feed.getPublicPost({ publicId: 'p' })).toEqual({
      ok: false,
      status: 404,
      error: 'Post not found',
    });
  });

  it('returns the post with resolved image and avatar URLs', async () => {
    respond('feed.getPublicPost', [
      {
        publicId: 'p',
        caption: 'Hi',
        images: ['k1.jpg', 'https://other.test/k2.jpg'],
        createdAt: T0,
        firstName: 'Ana',
        lastName: 'Lee',
        name: 'ana',
        avatarUrl: 'av.jpg',
      },
    ]);

    expect(await feed.getPublicPost({ publicId: 'p' })).toEqual({
      ok: true,
      value: {
        publicId: 'p',
        caption: 'Hi',
        images: ['https://cdn.example.com/k1.jpg', 'https://other.test/k2.jpg'],
        createdAt: T0.toISOString(),
        authorName: 'Ana Lee',
        authorAvatarUrl: 'https://cdn.example.com/av.jpg',
      },
    });
  });

  it('handles a post with no images and no avatar', async () => {
    respond('feed.getPublicPost', [
      {
        publicId: 'p',
        caption: 'Hi',
        images: null,
        createdAt: T0,
        firstName: null,
        lastName: null,
        name: 'ana',
        avatarUrl: null,
      },
    ]);

    expect(await feed.getPublicPost({ publicId: 'p' })).toMatchObject({
      ok: true,
      value: { images: [], authorName: 'ana', authorAvatarUrl: null },
    });
  });
});

describe('listPendingReports', () => {
  const reporter = (id: string) => ({
    reporterId: id,
    reporterFirstName: id.toUpperCase(),
    reporterLastName: null,
  });

  it('returns nothing when there are no pending reports', async () => {
    expect(await feed.listPendingReports()).toEqual([]);
    expect(queriesFor('feed.admin.getReportedPosts')).toHaveLength(0);
  });

  it('groups reports per target with counts, unique reasons and reporters, most-reported first', async () => {
    const at = (day: number) => new Date(`2026-09-0${day}T00:00:00.000Z`);
    respond('feed.admin.listPendingReports', [
      { postId: null, commentId: 30, reason: 'spam', createdAt: at(1), ...reporter('r1') },
      { postId: 1, commentId: null, reason: 'spam', createdAt: at(2), ...reporter('r1') },
      { postId: 1, commentId: null, reason: 'spam', createdAt: at(3), ...reporter('r2') },
      { postId: 1, commentId: null, reason: 'harassment', createdAt: at(4), ...reporter('r2') },
      { postId: 2, commentId: null, reason: 'spam', createdAt: at(5), ...reporter('r3') },
      // A post or comment whose row is gone (hard-deleted) is dropped.
      { postId: 99, commentId: null, reason: 'spam', createdAt: at(6), ...reporter('r3') },
      { postId: null, commentId: 98, reason: 'spam', createdAt: at(6), ...reporter('r3') },
      // A report with neither target is skipped.
      { postId: null, commentId: null, reason: 'spam', createdAt: at(7), ...reporter('r3') },
    ]);
    respond('feed.admin.getReportedPosts', [
      {
        id: 1,
        userId: 'bad',
        caption: 'c1',
        images: ['k.jpg'],
        firstName: 'Bad',
        lastName: null,
        avatarUrl: null,
      },
      {
        id: 2,
        userId: 'ok',
        caption: null,
        images: null,
        firstName: 'Ok',
        lastName: null,
        avatarUrl: null,
      },
    ]);
    respond('feed.admin.getReportedComments', [
      {
        id: 30,
        postId: 2,
        userId: 'ok',
        content: 'mean',
        firstName: 'Ok',
        lastName: null,
        avatarUrl: null,
      },
    ]);
    respond('feed.admin.getSuspended', [{ userId: 'bad' }]);

    const result = await feed.listPendingReports();

    expect(result.map((g) => [g.targetType, g.targetId, g.reportCount])).toEqual([
      ['post', 1, 3],
      ['comment', 30, 1], // ties broken oldest-first
      ['post', 2, 1],
    ]);
    expect(result[0]).toMatchObject({
      postId: 1,
      content: 'c1',
      images: ['https://cdn.example.com/k.jpg'],
      authorSuspended: true,
      reasons: ['spam', 'harassment'],
      reporters: [
        { id: 'r1', firstName: 'R1', lastName: null },
        { id: 'r2', firstName: 'R2', lastName: null },
      ],
      firstReportedAt: at(2).toISOString(),
      lastReportedAt: at(4).toISOString(),
    });
    expect(result[1]).toMatchObject({
      postId: 2,
      content: 'mean',
      images: [],
      authorSuspended: false,
    });
    expect(result[2]).toMatchObject({ images: [], content: null });
  });

  it('skips the suspension lookup when every reported item is gone', async () => {
    respond('feed.admin.listPendingReports', [
      {
        postId: null,
        commentId: 5,
        reason: 'spam',
        createdAt: T0,
        ...reporter('r1'),
      },
    ]);

    expect(await feed.listPendingReports()).toEqual([]);
    expect(queriesFor('feed.admin.getSuspended')).toHaveLength(0);
  });
});

describe('resolveReports', () => {
  it('dismisses: leaves the item up and marks its pending reports dismissed', async () => {
    const result = await feed.resolveReports({
      targetType: 'post',
      targetId: 1,
      action: 'dismiss',
    });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(queriesFor('feed.admin.removePost')).toHaveLength(0);
    expect(argOf('feed.admin.resolveReports', 'set')).toEqual({
      status: 'dismissed',
      reviewedAt: expect.any(Date),
    });
  });

  it.each([
    ['post', 'feed.admin.removePost'],
    ['comment', 'feed.admin.removeComment'],
  ] as const)('removes a %s for everyone and marks reports removed', async (targetType, label) => {
    respond(label, [{ id: 1 }]);

    const result = await feed.resolveReports({ targetType, targetId: 1, action: 'remove' });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(argOf(label, 'set')).toEqual({ removedAt: expect.any(Date) });
    expect(argOf('feed.admin.resolveReports', 'set')).toMatchObject({ status: 'removed' });
  });

  it('tells live viewers when a removed comment leaves their post', async () => {
    respond('feed.admin.removeComment', [{ id: 9, postId: 4 }]);

    await feed.resolveReports({ targetType: 'comment', targetId: 9, action: 'remove' });

    expect(mocks.publishCommentsChanged).toHaveBeenCalledWith({ postId: 4 });
  });

  it('sends no live signal for a removed post or a dismissal', async () => {
    respond('feed.admin.removePost', [{ id: 1 }]);

    await feed.resolveReports({ targetType: 'post', targetId: 1, action: 'remove' });
    await feed.resolveReports({ targetType: 'comment', targetId: 9, action: 'dismiss' });

    expect(mocks.publishCommentsChanged).not.toHaveBeenCalled();
  });

  it('returns 404 when removing an item that does not exist', async () => {
    const result = await feed.resolveReports({ targetType: 'post', targetId: 1, action: 'remove' });

    expect(result).toEqual({ ok: false, status: 404, error: 'Not found' });
    expect(queriesFor('feed.admin.resolveReports')).toHaveLength(0);
  });
});

describe('setUserSuspended', () => {
  it('returns 404 for an unknown user', async () => {
    expect(await feed.setUserSuspended({ userId: 'ghost', suspended: true })).toMatchObject({
      status: 404,
    });
    expect(queriesFor('feed.admin.setSuspended')).toHaveLength(0);
  });

  it('suspends by stamping suspendedAt', async () => {
    respond('feed.admin.getUser', [{ id: 'u' }]);

    expect(await feed.setUserSuspended({ userId: 'u', suspended: true })).toEqual({
      ok: true,
      value: { suspended: true },
    });
    expect(argOf('feed.admin.setSuspended', 'values')).toEqual({
      userId: 'u',
      suspendedAt: expect.any(Date),
    });
  });

  it('reinstates by clearing suspendedAt', async () => {
    respond('feed.admin.getUser', [{ id: 'u' }]);

    await feed.setUserSuspended({ userId: 'u', suspended: false });

    expect(argOf('feed.admin.setSuspended', 'values')).toEqual({ userId: 'u', suspendedAt: null });
    expect(argOf('feed.admin.setSuspended', 'onConflictDoUpdate')).toMatchObject({
      set: { suspendedAt: null },
    });
  });
});
