import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as { POST_LIVE_ROOM?: unknown },
  captureApiException: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: () => mocks.env }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));

const { COMMENTS_CHANGED_MESSAGE, connectToPostLive, publishCommentsChanged, takePendingUpgrade } =
  await import('@packrat/api/services/feedLive');

/** A fake namespace whose single room records what it was asked to do. */
function fakeNamespace(room: { fetch?: unknown; broadcast?: unknown }) {
  const namespace = {
    idFromName: vi.fn((name: string) => `id:${name}`),
    get: vi.fn(() => room),
  };
  mocks.env = { POST_LIVE_ROOM: namespace };
  return namespace;
}

/** Stand-in for a 101: Node refuses to construct one, and only `status` is read. */
const upgradeResponse = { status: 101 } as Response;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env = {};
});

describe('connectToPostLive', () => {
  it('reports 503 when the live room binding is absent', async () => {
    const request = new Request('http://localhost/api/feed/1/live');

    expect(await connectToPostLive({ postId: 1, request })).toEqual({
      ok: false,
      status: 503,
      error: 'Live updates unavailable',
    });
    expect(takePendingUpgrade(request)).toBeUndefined();
  });

  it("opens the socket on that post's room and parks the upgrade for the Worker entry", async () => {
    const fetch = vi.fn(async () => upgradeResponse);
    const namespace = fakeNamespace({ fetch });
    const request = new Request('http://localhost/api/feed/7/live');

    expect(await connectToPostLive({ postId: 7, request })).toEqual({ ok: true });
    expect(namespace.idFromName).toHaveBeenCalledWith('7');
    expect(fetch).toHaveBeenCalledWith(request);
    expect(takePendingUpgrade(request)).toBe(upgradeResponse);
    // Taken once: a second read finds nothing.
    expect(takePendingUpgrade(request)).toBeUndefined();
  });

  it('passes a refused upgrade through as a failure and parks nothing', async () => {
    fakeNamespace({ fetch: vi.fn(async () => new Response('no', { status: 426 })) });
    const request = new Request('http://localhost/api/feed/7/live');

    expect(await connectToPostLive({ postId: 7, request })).toEqual({
      ok: false,
      status: 426,
      error: 'Live updates unavailable',
    });
    expect(takePendingUpgrade(request)).toBeUndefined();
  });
});

describe('publishCommentsChanged', () => {
  it('does nothing when the live room binding is absent', async () => {
    await expect(publishCommentsChanged({ postId: 1 })).resolves.toBeUndefined();
    expect(mocks.captureApiException).not.toHaveBeenCalled();
  });

  it("broadcasts the refetch signal to that post's room", async () => {
    const broadcast = vi.fn(async () => 2);
    const namespace = fakeNamespace({ broadcast });

    await publishCommentsChanged({ postId: 3 });

    expect(namespace.idFromName).toHaveBeenCalledWith('3');
    expect(broadcast).toHaveBeenCalledWith(COMMENTS_CHANGED_MESSAGE);
    expect(JSON.parse(COMMENTS_CHANGED_MESSAGE)).toEqual({ type: 'comments.changed' });
  });

  it('reports a failed broadcast without failing the write that triggered it', async () => {
    const error = new Error('room unreachable');
    fakeNamespace({ broadcast: vi.fn(async () => Promise.reject(error)) });

    await expect(publishCommentsChanged({ postId: 3 })).resolves.toBeUndefined();
    expect(mocks.captureApiException).toHaveBeenCalledWith({
      error,
      operation: 'feed.publishCommentsChanged',
      extra: { postId: 3 },
    });
  });
});
