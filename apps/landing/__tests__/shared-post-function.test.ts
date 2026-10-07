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
