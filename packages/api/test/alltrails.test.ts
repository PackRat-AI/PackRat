import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './utils/test-helpers';

const PREVIEW_PATH = '/alltrails/preview';

function post(body: unknown) {
  return api(PREVIEW_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// CF Workers treats Response.url as read-only, so we return a plain object
// that satisfies the duck-typed interface used by the alltrails route handler.
function mockFetchResponse(
  html: string,
  opts: { status?: number; responseUrl?: string } = {},
): Response {
  const { status = 200, responseUrl = 'https://www.alltrails.com/trail/us/california/test' } = opts;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: responseUrl,
    text: () => Promise.resolve(html),
    json: () => Promise.resolve({}),
    headers: new Headers(),
  } as unknown as Response;
}

function mockFetch(html: string, opts: { status?: number; responseUrl?: string } = {}) {
  return vi.fn().mockResolvedValue(mockFetchResponse(html, opts));
}

const SAMPLE_HTML = `
<html>
<head>
  <meta property="og:title" content="Test Trail" />
  <meta property="og:description" content="A beautiful trail" />
  <meta property="og:image" content="https://cdn.alltrails.com/image.jpg" />
</head>
</html>`;

describe('POST /alltrails/preview', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('request validation', () => {
    it('rejects missing url field', async () => {
      const res = await post({});
      expect(res.status).toBe(400);
    });

    it('rejects non-url string', async () => {
      const res = await post({ url: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('rejects http (non-https) alltrails URL', async () => {
      const res = await post({ url: 'http://www.alltrails.com/trail/test' });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('https');
    });

    it('rejects non-alltrails domain', async () => {
      const res = await post({ url: 'https://evil.com/trail/test' });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('alltrails.com');
    });

    it('rejects alltrails.com.evil.com lookalike', async () => {
      const res = await post({ url: 'https://alltrails.com.evil.com/trail' });
      expect(res.status).toBe(400);
    });
  });

  describe('successful response', () => {
    it('returns OG metadata from a valid AllTrails page', async () => {
      globalThis.fetch = mockFetch(SAMPLE_HTML) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/us/california/test' });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.title).toBe('Test Trail');
      expect(body.description).toBe('A beautiful trail');
      expect(body.image).toBe('https://cdn.alltrails.com/image.jpg');
      expect(body.url).toContain('alltrails.com');
    });

    it('returns null for missing optional og tags', async () => {
      const htmlNoOg = `<html><head><meta property="og:title" content="Just a Title"/></head></html>`;
      globalThis.fetch = mockFetch(htmlNoOg) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/us/test' });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.title).toBe('Just a Title');
      expect(body.description).toBeNull();
      expect(body.image).toBeNull();
    });

    it('accepts subdomain alltrails URLs', async () => {
      globalThis.fetch = mockFetch(SAMPLE_HTML, {
        responseUrl: 'https://es.alltrails.com/senderos/test',
      }) as unknown as typeof fetch;

      const res = await post({ url: 'https://es.alltrails.com/senderos/test' });
      expect(res.status).toBe(200);
    });
  });

  describe('upstream error handling', () => {
    it('returns 504 on timeout', async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(
          new DOMException('The operation was aborted', 'TimeoutError'),
        ) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/test' });
      expect(res.status).toBe(504);
      const body = await res.json();
      expect(body.error).toContain('timed out');
    });

    it('returns 502 on network error', async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/test' });
      expect(res.status).toBe(502);
    });

    it('returns 502 when AllTrails returns a 4xx', async () => {
      globalThis.fetch = mockFetch('Not Found', { status: 404 }) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/test' });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toContain('404');
    });

    it('returns 422 when og:title is missing', async () => {
      const noTitleHtml = `<html><head><meta property="og:description" content="desc"/></head></html>`;
      globalThis.fetch = mockFetch(noTitleHtml) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/test' });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toContain('og:title');
    });

    it('returns 400 when redirect lands outside alltrails.com', async () => {
      globalThis.fetch = mockFetch(SAMPLE_HTML, {
        responseUrl: 'https://malicious.com/page',
      }) as unknown as typeof fetch;

      const res = await post({ url: 'https://www.alltrails.com/trail/test' });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('redirected outside');
    });
  });
});
