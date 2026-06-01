import { describe, expect, it, vi } from 'vitest';
import {
  call,
  clampLimit,
  createMcpClients,
  errMessage,
  errResponse,
  nowIso,
  ok,
  PAGINATION_LIMIT_MAX,
  RESPONSE_SIZE_LIMIT_CHARS,
  shortId,
  withNextOffset,
} from '../client';

vi.mock('@packrat/api-client', () => ({
  createApiClient: vi.fn((opts: unknown) => ({ _opts: opts })),
}));

describe('ok()', () => {
  it('wraps data as pretty-printed JSON in MCP text content', () => {
    const result = ok({ data: { id: 'pack-1', name: 'My Pack' } });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toContain('"id": "pack-1"');
    expect(result.isError).toBeUndefined();
  });

  it('handles null data', () => {
    const result = ok({ data: null });
    expect(result.content[0]!.text).toBe('null');
  });

  it('handles array data', () => {
    const result = ok({ data: [1, 2, 3] });
    expect(result.content[0]!.text).toContain('1');
  });
});

describe('errMessage()', () => {
  it('returns an error result with isError: true', () => {
    const result = errMessage('something went wrong');
    expect(result.isError).toBe(true);
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toContain('Error: something went wrong');
  });

  it('prefixes the message with "Error:"', () => {
    const result = errMessage('not found');
    expect(result.content[0]!.text).toMatch(/^Error:/);
  });
});

describe('shortId()', () => {
  it('returns a string prefixed with the provided prefix', () => {
    const id = shortId('pack');
    expect(id.startsWith('pack_')).toBe(true);
  });

  it('returns a unique id on each call', () => {
    const id1 = shortId('item');
    const id2 = shortId('item');
    expect(id1).not.toBe(id2);
  });

  it('strips hyphens from the UUID portion', () => {
    const id = shortId('trip');
    // The suffix after the prefix should not contain hyphens
    const suffix = id.slice('trip_'.length);
    expect(suffix).not.toContain('-');
  });

  it('produces a 12-character suffix', () => {
    const id = shortId('x');
    const suffix = id.slice('x_'.length);
    expect(suffix).toHaveLength(12);
  });
});

describe('nowIso()', () => {
  it('returns a valid ISO 8601 timestamp', () => {
    const iso = nowIso();
    expect(() => new Date(iso)).not.toThrow();
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('returns a string ending in Z (UTC)', () => {
    expect(nowIso().endsWith('Z')).toBe(true);
  });
});

describe('call()', () => {
  it('returns ok result when promise resolves with data', async () => {
    const mockPromise = Promise.resolve({ data: { id: 'pack-1' }, error: null, status: 200 });
    const result = await call({ promise: mockPromise });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain('"id": "pack-1"');
  });

  it('returns error result when promise resolves with error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 404, value: 'Not Found' },
      status: 404,
    });
    const result = await call({ promise: mockPromise });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('404');
  });

  it('returns error result when data is null', async () => {
    const mockPromise = Promise.resolve({ data: null, error: null, status: 200 });
    const result = await call({ promise: mockPromise });
    expect(result.isError).toBe(true);
  });

  it('returns error result when promise rejects', async () => {
    const mockPromise = Promise.reject(new Error('network failure'));
    const result = await call({ promise: mockPromise });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('network failure');
  });

  it('uses action from options in error messages', async () => {
    const mockPromise = Promise.reject(new Error('timeout'));
    const result = await call({ promise: mockPromise, action: 'fetch pack' });
    expect(result.content[0]!.text).toContain('fetch pack');
  });

  it('formats 401 error with auth guidance', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 401, value: null },
      status: 401,
    });
    const result = await call({ promise: mockPromise, action: 'list packs' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('authentication');
  });

  it('formats 401 admin error with admin guidance when requiresAdmin is set', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 401, value: null },
      status: 401,
    });
    const result = await call({ promise: mockPromise, action: 'list packs', requiresAdmin: true });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('admin');
  });

  it('formats 403 error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 403, value: null },
      status: 403,
    });
    const result = await call({ promise: mockPromise, action: 'delete pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('forbidden');
  });

  it('formats 404 error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 404, value: null },
      status: 404,
    });
    const result = await call({
      promise: mockPromise,
      action: 'get pack',
      resourceHint: 'pack p_123',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('404');
  });

  it('formats 409 conflict error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 409, value: null },
      status: 409,
    });
    const result = await call({ promise: mockPromise, action: 'create pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('conflict');
  });

  it('formats 422 validation error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 422, value: null },
      status: 422,
    });
    const result = await call({ promise: mockPromise, action: 'update pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('validation');
  });

  it('formats 429 rate limit error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 429, value: null },
      status: 429,
    });
    const result = await call({ promise: mockPromise, action: 'search' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('rate limit');
  });

  it('formats generic HTTP error for unknown status codes', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 503, value: null },
      status: 503,
    });
    const result = await call({ promise: mockPromise, action: 'fetch data' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('503');
  });

  it('includes error body message when available', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 400, value: { message: 'invalid input' } },
      status: 400,
    });
    const result = await call({ promise: mockPromise });
    expect(result.content[0]!.text).toContain('invalid input');
  });

  it('handles non-Error thrown exceptions', async () => {
    const mockPromise = Promise.reject('string error');
    const result = await call({ promise: mockPromise });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('string error');
  });

  it('formats 403 admin error when requiresAdmin is set', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 403, value: null },
      status: 403,
    });
    const result = await call({ promise: mockPromise, action: 'delete user', requiresAdmin: true });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain('admin');
    expect(result.content[0]!.text.toLowerCase()).toContain('forbidden');
  });

  it('extracts error body from obj.error field when obj.message is absent', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 400, value: { error: 'bad request detail' } },
      status: 400,
    });
    const result = await call({ promise: mockPromise });
    expect(result.content[0]!.text).toContain('bad request detail');
  });

  it('JSON-stringifies error body object when no message/error field present', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 400, value: { code: 42, detail: 'some info' } },
      status: 400,
    });
    const result = await call({ promise: mockPromise });
    expect(result.content[0]!.text).toContain('42');
  });

  it('converts numeric error body to string', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 500, value: 12345 },
      status: 500,
    });
    const result = await call({ promise: mockPromise });
    expect(result.content[0]!.text).toContain('12345');
  });
});

describe('createMcpClients()', () => {
  it('returns user and admin clients', () => {
    const clients = createMcpClients({
      baseUrl: 'https://api.example.com',
      getUserToken: () => 'user-token',
    });
    expect(clients).toHaveProperty('user');
    expect(clients).toHaveProperty('admin');
  });

  it('passes the base URL to each client', async () => {
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => null,
    });
    expect(spy).toHaveBeenCalledTimes(2);
    for (const c of spy.mock.calls) {
      expect((c[0] as { baseUrl: string }).baseUrl).toBe('https://api.test.com');
    }
  });

  it('U5: user and admin clients share the same token provider', async () => {
    // After U5, the admin client uses the same Better Auth bearer as the
    // user client; the API enforces admin role on its side. This test
    // locks the wiring in so a future refactor that re-splits the
    // providers (e.g. accidentally re-introducing a `getAdminToken`
    // parameter) regresses visibly.
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => 'shared-bearer',
    });
    const userAuth = (spy.mock.calls[0]?.[0] as { auth: { getAccessToken: () => string | null } })
      .auth;
    const adminAuth = (spy.mock.calls[1]?.[0] as { auth: { getAccessToken: () => string | null } })
      .auth;
    expect(userAuth.getAccessToken()).toBe('shared-bearer');
    expect(adminAuth.getAccessToken()).toBe('shared-bearer');
  });

  it('noopHooks getAccessToken returns null when token provider returns null', async () => {
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => null,
    });
    const auth = (spy.mock.calls[0]?.[0] as { auth: { getAccessToken: () => string | null } }).auth;
    expect(auth.getAccessToken()).toBeNull();
  });

  it('noopHooks getAccessToken returns the token when provider returns one', async () => {
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => 'my-token',
    });
    const auth = (spy.mock.calls[0]?.[0] as { auth: { getAccessToken: () => string | null } }).auth;
    expect(auth.getAccessToken()).toBe('my-token');
  });

  it('noopHooks getRefreshToken always returns null', async () => {
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => 'tok',
    });
    const auth = (spy.mock.calls[0]?.[0] as { auth: { getRefreshToken: () => null } }).auth;
    expect(auth.getRefreshToken()).toBeNull();
  });

  it('noopHooks lifecycle callbacks are no-ops', async () => {
    const mod = await import('@packrat/api-client');
    const spy = vi.mocked(mod.createApiClient);
    spy.mockClear();
    createMcpClients({
      baseUrl: 'https://api.test.com',
      getUserToken: () => null,
    });
    const auth = (
      spy.mock.calls[0]?.[0] as unknown as {
        auth: { onAccessTokenRefreshed: () => void; onNeedsReauth: () => void };
      }
    ).auth;
    expect(() => auth.onAccessTokenRefreshed()).not.toThrow();
    expect(() => auth.onNeedsReauth()).not.toThrow();
  });
});

// ── U8: structured output + isError envelope + truncation + pagination ───────

describe('U8 ok() with structured: true', () => {
  it('emits both content (text JSON) and structuredContent on opt-in', () => {
    const data = { id: 'pack-1', name: 'My Pack' };
    const result = ok({ data, structured: true });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toContain('"id": "pack-1"');
    expect(result.structuredContent).toEqual(data);
  });

  it('omits structuredContent when structured is not requested', () => {
    const result = ok({ data: { foo: 1 } });
    expect(result.structuredContent).toBeUndefined();
  });

  it('omits structuredContent when structured: false explicitly', () => {
    const result = ok({ data: { foo: 1 }, structured: false });
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('U8 ok() truncation', () => {
  // Build a payload whose pretty-printed JSON is comfortably over the cap.
  // A 200k-element array of "x" strings yields > 200k chars after JSON.
  const buildLarge = () => Array.from({ length: 200_000 }, () => 'x');

  it('passes through a small payload unchanged', () => {
    const result = ok({ data: { small: true } });
    expect(result.content[0]!.text).toContain('"small": true');
  });

  it('truncates payloads exceeding RESPONSE_SIZE_LIMIT_CHARS with a marker', () => {
    const result = ok({ data: buildLarge() });
    expect(result.content[0]!.text.length).toBeLessThanOrEqual(RESPONSE_SIZE_LIMIT_CHARS);
    expect(result.content[0]!.text).toContain('[truncated: response exceeded 150k chars]');
  });

  it('drops structuredContent on truncation (would be unparseable)', () => {
    const result = ok({ data: buildLarge(), structured: true });
    expect(result.content[0]!.text).toContain('[truncated:');
    expect(result.structuredContent).toBeUndefined();
  });

  it('does NOT set isError on truncation (truncation is shape, not failure)', () => {
    const result = ok({ data: buildLarge(), structured: true });
    expect(result.isError).toBeUndefined();
  });
});

describe('U8 errResponse()', () => {
  it('returns the canonical envelope with code, message, retryable defaulting to false', () => {
    const result = errResponse({ code: 'api_error', message: 'boom' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toBe('boom');
    expect(result.structuredContent).toEqual({
      error: { code: 'api_error', message: 'boom', retryable: false },
    });
  });

  it('propagates the retryable flag when set to true', () => {
    const result = errResponse({ code: 'rate_limited', message: 'too many', retryable: true });
    expect(result.structuredContent).toEqual({
      error: { code: 'rate_limited', message: 'too many', retryable: true },
    });
  });

  it('emits the message verbatim in content[0].text (no Error: prefix)', () => {
    const result = errResponse({ code: 'forbidden', message: 'No access' });
    expect(result.content[0]!.text).toBe('No access');
  });
});

describe('U8 errMessage() carries structured error envelope', () => {
  it('returns structuredContent with the tool_error code (legacy callers)', () => {
    const result = errMessage('something went wrong');
    expect(result.structuredContent).toEqual({
      error: { code: 'tool_error', message: 'something went wrong', retryable: false },
    });
  });
});

describe('U8 call() maps errors to structured envelopes', () => {
  it('maps 500 to api_error with retryable: true', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 500, value: null }, status: 500 }),
      action: 'fetch x',
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: 'api_error', retryable: true },
    });
  });

  it('maps 401 to unauthorized with retryable: false', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 401, value: null }, status: 401 }),
    });
    expect(result.structuredContent).toMatchObject({
      error: { code: 'unauthorized', retryable: false },
    });
  });

  it('maps 403 to forbidden with retryable: false', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 403, value: null }, status: 403 }),
    });
    expect(result.structuredContent).toMatchObject({
      error: { code: 'forbidden', retryable: false },
    });
  });

  it('maps 404 to not_found', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 404, value: null }, status: 404 }),
    });
    expect(result.structuredContent).toMatchObject({
      error: { code: 'not_found', retryable: false },
    });
  });

  it('maps 429 to rate_limited with retryable: true', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 429, value: null }, status: 429 }),
    });
    expect(result.structuredContent).toMatchObject({
      error: { code: 'rate_limited', retryable: true },
    });
  });

  it('maps 422 to validation_error', async () => {
    const result = await call({
      promise: Promise.resolve({ data: null, error: { status: 422, value: null }, status: 422 }),
    });
    expect(result.structuredContent).toMatchObject({
      error: { code: 'validation_error', retryable: false },
    });
  });

  it('maps a thrown network error to network_error with retryable: true (no escape)', async () => {
    const result = await call({
      promise: Promise.reject(new Error('socket hang up')),
      action: 'fetch x',
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: 'network_error', retryable: true },
    });
    expect(result.content[0]!.text).toContain('socket hang up');
  });

  it('does not let thrown errors escape (protocol vs. recoverable separation)', async () => {
    // A handler that throws unexpectedly should never bubble past call() —
    // the SDK reserves thrown errors for protocol violations, so any
    // runtime fault inside the API client is recoverable from Claude's
    // perspective.
    await expect(
      call({ promise: Promise.reject('not even an Error instance'), action: 'fetch' }),
    ).resolves.toMatchObject({ isError: true });
  });

  it('emits structuredContent on success when structured: true is set', async () => {
    const result = await call({
      promise: Promise.resolve({ data: { ok: 'yes' }, error: null, status: 200 }),
      structured: true,
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ ok: 'yes' });
  });

  it('omits structuredContent on success when structured is not set', async () => {
    const result = await call({
      promise: Promise.resolve({ data: { ok: 'yes' }, error: null, status: 200 }),
    });
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('U8 pagination helpers', () => {
  it('clampLimit returns the fallback when limit is undefined', () => {
    expect(clampLimit({ value: undefined })).toBe(PAGINATION_LIMIT_MAX);
  });

  it('clampLimit respects an alternate fallback', () => {
    expect(clampLimit({ value: undefined, max: 20 })).toBe(20);
  });

  it('clampLimit clamps values above PAGINATION_LIMIT_MAX', () => {
    expect(clampLimit({ value: 500 })).toBe(PAGINATION_LIMIT_MAX);
    expect(clampLimit({ value: PAGINATION_LIMIT_MAX + 1 })).toBe(PAGINATION_LIMIT_MAX);
  });

  it('clampLimit passes through valid in-range values', () => {
    expect(clampLimit({ value: 10 })).toBe(10);
    expect(clampLimit({ value: PAGINATION_LIMIT_MAX })).toBe(PAGINATION_LIMIT_MAX);
  });

  it('clampLimit floors fractional limits', () => {
    expect(clampLimit({ value: 10.7 })).toBe(10);
  });

  it('clampLimit rejects non-positive / non-finite inputs', () => {
    expect(clampLimit({ value: 0 })).toBe(PAGINATION_LIMIT_MAX);
    expect(clampLimit({ value: -5 })).toBe(PAGINATION_LIMIT_MAX);
    expect(clampLimit({ value: Number.NaN })).toBe(PAGINATION_LIMIT_MAX);
    expect(clampLimit({ value: Number.POSITIVE_INFINITY })).toBe(PAGINATION_LIMIT_MAX);
  });

  it('withNextOffset advertises a next offset when page is full', () => {
    expect(withNextOffset({ items: [1, 2, 3, 4, 5], offset: 0, limit: 5 })).toEqual({
      data: [1, 2, 3, 4, 5],
      nextOffset: 5,
    });
  });

  it('withNextOffset returns null nextOffset on a short page (end of list)', () => {
    expect(withNextOffset({ items: [1, 2], offset: 10, limit: 5 })).toEqual({
      data: [1, 2],
      nextOffset: null,
    });
  });

  it('withNextOffset returns null nextOffset on an empty page', () => {
    expect(withNextOffset({ items: [], offset: 50, limit: 25 })).toEqual({
      data: [],
      nextOffset: null,
    });
  });
});
