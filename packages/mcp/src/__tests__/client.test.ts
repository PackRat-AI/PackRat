import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, err, ok, PackRatApiClient } from '../client';

// ── ok() / err() helpers ──────────────────────────────────────────────────────

describe('ok()', () => {
  it('wraps data as JSON text content', () => {
    const result = ok({ id: 1, name: 'My Pack' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, name: 'My Pack' });
  });

  it('handles arrays', () => {
    const result = ok([1, 2, 3]);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });

  it('handles null', () => {
    const result = ok(null);
    expect(result.content[0].text).toBe('null');
  });
});

describe('err()', () => {
  it('formats an ApiError with status code', () => {
    const result = err(new ApiError('Not Found', { status: 404, body: { error: 'Not Found' } }));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: API Error (404): Not Found');
  });

  it('formats a generic Error', () => {
    const result = err(new Error('Something broke'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: Something broke');
  });

  it('formats a string error', () => {
    const result = err('raw string error');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: raw string error');
  });
});

// ── ApiError ──────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('sets name, status, and body', () => {
    const body = { error: 'Unauthorized' };
    const e = new ApiError('Unauthorized', { status: 401, body });
    expect(e.name).toBe('ApiError');
    expect(e.message).toBe('Unauthorized');
    expect(e.status).toBe(401);
    expect(e.body).toBe(body);
    expect(e instanceof Error).toBe(true);
  });
});

// ── PackRatApiClient ──────────────────────────────────────────────────────────

describe('PackRatApiClient', () => {
  const BASE = 'https://api.example.com';
  let token = 'test-jwt-token';
  let client: PackRatApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    token = 'test-jwt-token'; // reset between tests to avoid mutation leaking
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new PackRatApiClient(BASE, () => token);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  describe('GET', () => {
    it('sends a GET request with auth header', async () => {
      fetchMock.mockResolvedValue(mockResponse({ items: [] }));

      await client.get('/packs');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/packs`);
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    });

    it('appends query params', async () => {
      fetchMock.mockResolvedValue(mockResponse([]));

      await client.get('/packs', { limit: 10, offset: 0, category: 'backpacking' });

      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get('limit')).toBe('10');
      expect(parsed.searchParams.get('offset')).toBe('0');
      expect(parsed.searchParams.get('category')).toBe('backpacking');
    });

    it('skips undefined params', async () => {
      fetchMock.mockResolvedValue(mockResponse([]));

      await client.get('/packs', { limit: 10, category: undefined });

      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.has('category')).toBe(false);
      expect(parsed.searchParams.get('limit')).toBe('10');
    });

    it('omits Authorization header when token is empty', async () => {
      token = '';
      fetchMock.mockResolvedValue(mockResponse({}));

      await client.get('/public');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it('throws ApiError on non-ok response with JSON error body', async () => {
      fetchMock.mockResolvedValue(mockResponse({ error: 'Not found' }, 404));

      await expect(client.get('/packs/nope')).rejects.toThrow(ApiError);

      try {
        await client.get('/packs/nope');
      } catch (e) {
        expect(e instanceof ApiError).toBe(true);
        expect((e as ApiError).status).toBe(404);
        expect((e as ApiError).message).toBe('Not found');
      }
    });

    it('throws ApiError with HTTP status message when body has no error field', async () => {
      fetchMock.mockResolvedValue(mockResponse({ message: 'gone' }, 410));

      await expect(client.get('/gone')).rejects.toThrow('HTTP 410:');
    });

    it('returns parsed JSON on success', async () => {
      const pack = { id: 'p_1', name: 'Test Pack' };
      fetchMock.mockResolvedValue(mockResponse(pack));

      const result = await client.get('/packs/p_1');
      expect(result).toEqual(pack);
    });
  });

  describe('POST', () => {
    it('sends POST with JSON body', async () => {
      fetchMock.mockResolvedValue(mockResponse({ id: 'p_new' }));

      await client.post('/packs', { name: 'New Pack', category: 'backpacking' });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/packs`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'New Pack',
        category: 'backpacking',
      });
    });

    it('sends POST with no body when omitted', async () => {
      fetchMock.mockResolvedValue(mockResponse({ ok: true }));

      await client.post('/action');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBeUndefined();
    });
  });

  describe('PATCH', () => {
    it('sends PATCH with JSON body', async () => {
      fetchMock.mockResolvedValue(mockResponse({ id: 'p_1' }));

      await client.patch('/packs/p_1', { name: 'Updated' });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/packs/p_1`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'Updated' });
    });
  });

  describe('DELETE', () => {
    it('sends DELETE request', async () => {
      fetchMock.mockResolvedValue(mockResponse({ deleted: true }));

      await client.delete('/packs/p_1');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE}/packs/p_1`);
      expect(init.method).toBe('DELETE');
    });
  });

  describe('non-JSON response', () => {
    it('returns raw string when response is not JSON', async () => {
      const raw = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'plain text response',
      } as unknown as Response;
      fetchMock.mockResolvedValue(raw);

      const result = await client.get('/text-endpoint');
      expect(result).toBe('plain text response');
    });
  });
});
