import { describe, expect, it } from 'vitest';
import { extractBearer, MAX_BEARER_HEADER_LEN, withCorrelationHeader } from '../request-helpers';

describe('extractBearer', () => {
  it('returns the token from a well-formed Bearer header', () => {
    expect(extractBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is scheme-case-insensitive', () => {
    expect(extractBearer('bearer TOKEN123')).toBe('TOKEN123');
  });

  it('trims surrounding whitespace around the token', () => {
    expect(extractBearer('Bearer   spaced-token  ')).toBe('spaced-token');
  });

  it('returns null for a missing header', () => {
    expect(extractBearer(null)).toBeNull();
  });

  it('returns null for a non-Bearer scheme', () => {
    expect(extractBearer('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null when the token slot is empty', () => {
    expect(extractBearer('Bearer ')).toBeNull();
  });

  it('returns null when the header exceeds the length cap', () => {
    const huge = `Bearer ${'x'.repeat(MAX_BEARER_HEADER_LEN)}`;
    expect(huge.length).toBeGreaterThan(MAX_BEARER_HEADER_LEN);
    expect(extractBearer(huge)).toBeNull();
  });
});

describe('withCorrelationHeader', () => {
  it('adds X-Correlation-Id and preserves status + body', async () => {
    const response = new Response('payload', { status: 201 });
    const annotated = withCorrelationHeader({ response, correlationId: 'ray-123' });
    expect(annotated.headers.get('X-Correlation-Id')).toBe('ray-123');
    expect(annotated.status).toBe(201);
    expect(await annotated.text()).toBe('payload');
  });

  it('is idempotent — returns the original response when the header is already set', () => {
    const response = new Response(null, { headers: { 'X-Correlation-Id': 'existing' } });
    const result = withCorrelationHeader({ response, correlationId: 'new-id' });
    expect(result).toBe(response);
    expect(result.headers.get('X-Correlation-Id')).toBe('existing');
  });
});
