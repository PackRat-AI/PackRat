import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parsePublicId,
  renderMetaTags,
  renderPayloadScript,
  type SharedPost,
  sharedPostAppUrl,
  sharedPostDescription,
  sharedPostMetaTags,
} from '../lib/shared-post';
import worker, { type Env } from '../worker/index';

const ID = '3f2b8c1e-9a4d-4e7f-b2c6-1d5e8f9a0b3c';

const post: SharedPost = {
  publicId: ID,
  caption: 'Sunrise over the ridge',
  images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
  createdAt: '2026-10-01T12:00:00.000Z',
  authorName: 'Sam',
  authorAvatarUrl: null,
};

function metaContent(tags: ReturnType<typeof sharedPostMetaTags>, key: string): string | undefined {
  return tags.find((tag) => ('property' in tag ? tag.property : tag.name) === key)?.content;
}

describe('parsePublicId', () => {
  it('reads the id from a share path', () => {
    expect(parsePublicId(`/p/${ID}`)).toBe(ID);
    expect(parsePublicId(`/p/${ID}/`)).toBe(ID);
  });

  it('lowercases the id', () => {
    expect(parsePublicId(`/p/${ID.toUpperCase()}`)).toBe(ID);
  });

  it('rejects paths that are not a well-formed share link', () => {
    expect(parsePublicId('/p')).toBeNull();
    expect(parsePublicId('/p/')).toBeNull();
    expect(parsePublicId('/p/not-a-uuid')).toBeNull();
    expect(parsePublicId(`/p/${ID}/extra`)).toBeNull();
    expect(parsePublicId(`/x/${ID}`)).toBeNull();
  });
});

describe('share links', () => {
  it('opens the app on the scheme path the apps parse', () => {
    expect(sharedPostAppUrl(ID)).toBe(`packrat://p/${ID}`);
  });
});

describe('sharedPostMetaTags', () => {
  it('describes the post with its author, caption and cover photo', () => {
    const tags = sharedPostMetaTags(post);
    expect(metaContent(tags, 'og:title')).toBe('Sam on PackRat');
    expect(metaContent(tags, 'og:description')).toBe('Sunrise over the ridge');
    expect(metaContent(tags, 'og:image')).toBe('https://cdn.example.com/a.jpg');
    expect(metaContent(tags, 'og:url')).toBe(`https://packratai.com/p/${ID}`);
    expect(metaContent(tags, 'twitter:card')).toBe('summary_large_image');
    expect(metaContent(tags, 'twitter:image')).toBe('https://cdn.example.com/a.jpg');
  });

  it('falls back to a generic description without a caption', () => {
    expect(sharedPostDescription({ caption: '   ', authorName: 'Sam' })).toBe(
      "Photos from Sam's adventure, shared on PackRat.",
    );
  });

  it('uses a small card and no image tags for a post without photos', () => {
    const tags = sharedPostMetaTags({ ...post, images: [] });
    expect(metaContent(tags, 'twitter:card')).toBe('summary');
    expect(metaContent(tags, 'og:image')).toBeUndefined();
    expect(metaContent(tags, 'twitter:image')).toBeUndefined();
  });
});

describe('renderMetaTags', () => {
  it('escapes captions so they cannot break out of the attribute', () => {
    const html = renderMetaTags([{ property: 'og:description', content: '"><script>x</script>&' }]);
    expect(html).toBe(
      '<meta property="og:description" content="&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;">',
    );
  });
});

describe('renderPayloadScript', () => {
  it('embeds the payload as JSON that cannot close the script tag', () => {
    const html = renderPayloadScript({
      status: 'ok',
      post: { ...post, caption: '</script><b>' },
    });
    expect(html).not.toContain('</script><b>');
    const json = html.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/, '');
    expect(JSON.parse(json).post.caption).toBe('</script><b>');
  });
});

describe('worker', () => {
  type Handler = { element: (el: unknown) => void };
  const selectors: string[] = [];

  class FakeRewriter {
    on(selector: string, _handler: Handler) {
      selectors.push(selector);
      return this;
    }
    transform(response: Response) {
      return response;
    }
  }

  const shell = () =>
    new Response('<html><head><title>Shared post | PackRat</title></head><body></body></html>', {
      headers: { 'Content-Type': 'text/html', ETag: '"abc"' },
    });

  let assetsFetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;
  let apiFetch: ReturnType<typeof vi.fn<typeof fetch>>;
  let env: Env;

  beforeEach(() => {
    selectors.length = 0;
    vi.stubGlobal('HTMLRewriter', FakeRewriter);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    assetsFetch = vi.fn(async (_request: Request) => shell());
    apiFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', apiFetch);
    env = { ASSETS: { fetch: assetsFetch }, PACKRAT_API_URL: 'https://api.example.com' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('serves the /p shell with the post tags for a live post', async () => {
    apiFetch.mockResolvedValue(Response.json(post));
    const response = await worker.fetch(new Request(`https://packratai.com/p/${ID}`), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBeNull();
    expect(new URL(assetsFetch.mock.calls[0]?.[0].url ?? '').pathname).toBe('/p');
    expect(apiFetch.mock.calls[0]?.[0]).toBe(`https://api.example.com/api/feed/public/${ID}`);
    expect(selectors).toEqual(
      expect.arrayContaining(['meta[property^="og:"]', 'meta[name^="twitter:"]', 'title', 'head']),
    );
  });

  it('returns 404 for a removed post', async () => {
    apiFetch.mockResolvedValue(Response.json({ error: 'Not found' }, { status: 404 }));
    const response = await worker.fetch(new Request(`https://packratai.com/p/${ID}`), env);
    expect(response.status).toBe(404);
    expect(selectors).not.toContain('meta[property^="og:"]');
  });

  it('returns 404 without calling the API for a malformed id', async () => {
    const response = await worker.fetch(new Request('https://packratai.com/p/nope'), env);
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the API fails', async () => {
    apiFetch.mockRejectedValue(new Error('network down'));
    const response = await worker.fetch(new Request(`https://packratai.com/p/${ID}`), env);
    expect(response.status).toBe(503);
  });

  it('passes every other path straight to the assets', async () => {
    const request = new Request('https://packratai.com/about');
    await worker.fetch(request, env);
    expect(assetsFetch).toHaveBeenCalledWith(request);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
