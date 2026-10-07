/**
 * The feed routes are thin: each one calls a service and translates its
 * `ServiceResult` into an HTTP status. These drive representative routes through
 * Elysia with the service mocked, to pin that translation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPost: vi.fn(),
  getPost: vi.fn(),
  deleteComment: vi.fn(),
  getPublicPost: vi.fn(),
  resolveReports: vi.fn(),
  setUserSuspended: vi.fn(),
  listPendingReports: vi.fn(),
}));

vi.mock('@packrat/api/services/feedService', () => mocks);

// Authenticate every request as `viewer-1` without standing up Better Auth.
vi.mock('@packrat/api/middleware/auth', async () => {
  const { Elysia } = await import('elysia');
  const plugin = new Elysia({ name: 'authPlugin' })
    .derive(() => ({ user: { userId: 'viewer-1', role: 'USER', email: 't@test.com' } }))
    .macro({ isAuthenticated: () => ({}), isAdmin: () => ({}) })
    .as('scoped');
  return { authPlugin: plugin, adminAuthPlugin: plugin };
});

const { feedRoutes } = await import('@packrat/api/routes/feed');
const { adminFeedModerationRoutes } = await import('@packrat/api/routes/admin/feedModeration');

const PUBLIC_ID = '00000000-0000-4000-8000-000000000001';

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('feed routes', () => {
  it('returns 201 with the created post', async () => {
    mocks.createPost.mockResolvedValue({ ok: true, value: { id: 11 } });

    const res = await feedRoutes.handle(
      request('/feed', { method: 'POST', body: { caption: 'hi', images: [] } }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 11 });
    expect(mocks.createPost).toHaveBeenCalledWith({
      userId: 'viewer-1',
      caption: 'hi',
      images: [],
      taggedUserIds: undefined,
    });
  });

  it('passes a service rejection through as its status', async () => {
    mocks.createPost.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Posting is suspended for this account',
    });

    const res = await feedRoutes.handle(
      request('/feed', { method: 'POST', body: { caption: 'hi' } }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Posting is suspended for this account' });
  });

  it('coerces the post id and maps a missing post to 404', async () => {
    mocks.getPost.mockResolvedValue({ ok: false, status: 404, error: 'Post not found' });

    const res = await feedRoutes.handle(request('/feed/42'));

    expect(res.status).toBe(404);
    expect(mocks.getPost).toHaveBeenCalledWith({ viewerId: 'viewer-1', postId: 42 });
  });

  it('maps a forbidden comment delete to 403 and a permitted one to 200', async () => {
    mocks.deleteComment
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' })
      .mockResolvedValueOnce({ ok: true, value: { success: true } });

    const denied = await feedRoutes.handle(request('/feed/1/comments/2', { method: 'DELETE' }));
    const allowed = await feedRoutes.handle(request('/feed/1/comments/2', { method: 'DELETE' }));

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ success: true });
    expect(mocks.deleteComment).toHaveBeenCalledWith({
      userId: 'viewer-1',
      postId: 1,
      commentId: 2,
    });
  });

  it('serves the public share page and 404s a hidden post', async () => {
    const post = {
      publicId: PUBLIC_ID,
      caption: null,
      images: [],
      createdAt: '2026-09-01T00:00:00.000Z',
      authorName: 'Ana',
      authorAvatarUrl: null,
    };
    mocks.getPublicPost
      .mockResolvedValueOnce({ ok: true, value: post })
      .mockResolvedValueOnce({ ok: false, status: 404, error: 'Post not found' });

    const found = await feedRoutes.handle(request(`/feed/public/${PUBLIC_ID}`));
    const missing = await feedRoutes.handle(request(`/feed/public/${PUBLIC_ID}`));

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(post);
    expect(missing.status).toBe(404);
  });
});

describe('admin feed moderation routes', () => {
  it('maps removing a missing item to 404', async () => {
    mocks.resolveReports.mockResolvedValue({ ok: false, status: 404, error: 'Not found' });

    const res = await adminFeedModerationRoutes.handle(
      request('/feed/reports/post/5/remove', { method: 'POST' }),
    );

    expect(res.status).toBe(404);
    expect(mocks.resolveReports).toHaveBeenCalledWith({
      targetType: 'post',
      targetId: 5,
      action: 'remove',
    });
  });

  it('suspends a user', async () => {
    mocks.setUserSuspended.mockResolvedValue({ ok: true, value: { suspended: true } });

    const res = await adminFeedModerationRoutes.handle(
      request('/feed/users/u-1/suspension', { method: 'PUT', body: { suspended: true } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suspended: true });
    expect(mocks.setUserSuspended).toHaveBeenCalledWith({ userId: 'u-1', suspended: true });
  });
});
