import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/p/[[path]]';

const ID = '036ebe2f-fac2-4615-b7fa-6cb26897df23';

class PassthroughRewriter {
  on() {
    return this;
  }
  transform(response: Response) {
    return response;
  }
}

describe('Pages Function for /p/*', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setup() {
    vi.stubGlobal('HTMLRewriter', PassthroughRewriter);
    const apiFetch = vi.fn<typeof fetch>();
    apiFetch.mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', apiFetch);
    const assets = {
      fetch: vi.fn(async (_r: Request) => new Response('<html><head></head><body></body></html>')),
    };
    return { apiFetch, assets };
  }

  it('calls the production API when no PACKRAT_API_URL is configured', async () => {
    const { apiFetch, assets } = setup();
    await onRequest({
      request: new Request(`https://packratai.com/p/${ID}`),
      env: { ASSETS: assets },
    });
    expect(apiFetch).toHaveBeenCalledWith(
      `https://packrat-api.orange-frost-d665.workers.dev/api/feed/public/${ID}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('uses PACKRAT_API_URL when the Pages project sets it', async () => {
    const { apiFetch, assets } = setup();
    const response = await onRequest({
      request: new Request(`https://packratai.com/p/${ID}`),
      env: { ASSETS: assets, PACKRAT_API_URL: 'http://localhost:8792' },
    });
    expect(apiFetch).toHaveBeenCalledWith(
      `http://localhost:8792/api/feed/public/${ID}`,
      expect.any(Object),
    );
    expect(response.status).toBe(404);
  });
});

describe('toSharedPost', () => {
  it('accepts a public post and rejects anything else', async () => {
    const { toSharedPost } = await import('../lib/shared-post');
    const good = {
      publicId: 'p1',
      caption: null,
      images: ['https://img/1.jpg'],
      createdAt: '2026-10-07T00:00:00.000Z',
      authorName: 'Maya Chen',
      authorAvatarUrl: null,
    };
    expect(toSharedPost(good)).toEqual(good);
    expect(toSharedPost({ ...good, images: [1] })).toBeUndefined();
    expect(toSharedPost({ ...good, authorName: undefined })).toBeUndefined();
    expect(toSharedPost('nope')).toBeUndefined();
  });
});

describe('postPhotoAspect', () => {
  it('follows the first photo within 4:5 and 1.91:1', async () => {
    const { postPhotoAspect, PLACEHOLDER_PHOTO_ASPECT } = await import('../lib/shared-post');
    expect(postPhotoAspect({ width: 1600, height: 1067 })).toBeCloseTo(1.4995, 3);
    expect(postPhotoAspect({ width: 1080, height: 1920 })).toBeCloseTo(0.8, 5);
    expect(postPhotoAspect({ width: 4000, height: 1000 })).toBeCloseTo(1.91, 5);
    expect(postPhotoAspect({ width: 0, height: 0 })).toBe(PLACEHOLDER_PHOTO_ASPECT);
  });
});
