import { describe, expect, it, vi } from 'vitest';
import { call, errMessage, nowIso, ok, shortId } from '../client';

describe('ok()', () => {
  it('wraps data as pretty-printed JSON in MCP text content', () => {
    const result = ok({ id: 'pack-1', name: 'My Pack' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('"id": "pack-1"');
    expect(result.isError).toBeUndefined();
  });

  it('handles null data', () => {
    const result = ok(null);
    expect(result.content[0].text).toBe('null');
  });

  it('handles array data', () => {
    const result = ok([1, 2, 3]);
    expect(result.content[0].text).toContain('1');
  });
});

describe('errMessage()', () => {
  it('returns an error result with isError: true', () => {
    const result = errMessage('something went wrong');
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Error: something went wrong');
  });

  it('prefixes the message with "Error:"', () => {
    const result = errMessage('not found');
    expect(result.content[0].text).toMatch(/^Error:/);
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
    const result = await call(mockPromise);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"id": "pack-1"');
  });

  it('returns error result when promise resolves with error', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 404, value: 'Not Found' },
      status: 404,
    });
    const result = await call(mockPromise);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('404');
  });

  it('returns error result when data is null', async () => {
    const mockPromise = Promise.resolve({ data: null, error: null, status: 200 });
    const result = await call(mockPromise);
    expect(result.isError).toBe(true);
  });

  it('returns error result when promise rejects', async () => {
    const mockPromise = Promise.reject(new Error('network failure'));
    const result = await call(mockPromise);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('network failure');
  });

  it('uses action from options in error messages', async () => {
    const mockPromise = Promise.reject(new Error('timeout'));
    const result = await call(mockPromise, { action: 'fetch pack' });
    expect(result.content[0].text).toContain('fetch pack');
  });

  it('formats 401 error with auth guidance', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 401, value: null }, status: 401 });
    const result = await call(mockPromise, { action: 'list packs' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('authentication');
  });

  it('formats 401 admin error with admin guidance when requiresAdmin is set', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 401, value: null }, status: 401 });
    const result = await call(mockPromise, { action: 'list packs', requiresAdmin: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('admin');
  });

  it('formats 403 error', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 403, value: null }, status: 403 });
    const result = await call(mockPromise, { action: 'delete pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('forbidden');
  });

  it('formats 404 error', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 404, value: null }, status: 404 });
    const result = await call(mockPromise, { action: 'get pack', resourceHint: 'pack p_123' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('404');
  });

  it('formats 409 conflict error', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 409, value: null }, status: 409 });
    const result = await call(mockPromise, { action: 'create pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('conflict');
  });

  it('formats 422 validation error', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 422, value: null }, status: 422 });
    const result = await call(mockPromise, { action: 'update pack' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('validation');
  });

  it('formats 429 rate limit error', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 429, value: null }, status: 429 });
    const result = await call(mockPromise, { action: 'search' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('rate limit');
  });

  it('formats generic HTTP error for unknown status codes', async () => {
    const mockPromise = Promise.resolve({ data: null, error: { status: 503, value: null }, status: 503 });
    const result = await call(mockPromise, { action: 'fetch data' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('503');
  });

  it('includes error body message when available', async () => {
    const mockPromise = Promise.resolve({
      data: null,
      error: { status: 400, value: { message: 'invalid input' } },
      status: 400,
    });
    const result = await call(mockPromise);
    expect(result.content[0].text).toContain('invalid input');
  });

  it('handles non-Error thrown exceptions', async () => {
    const mockPromise = Promise.reject('string error');
    const result = await call(mockPromise);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('string error');
  });
});
