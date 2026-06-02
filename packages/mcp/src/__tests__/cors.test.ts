import { describe, expect, it } from 'vitest';
import { applyCorsHeaders, WELL_KNOWN_ALLOWED_ORIGINS } from '../cors';

const ALLOWED = 'https://claude.ai';
const WELL_KNOWN = 'https://mcp.test/.well-known/oauth-protected-resource';

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('applyCorsHeaders', () => {
  it('exposes the two Claude origins on the allowlist', () => {
    expect([...WELL_KNOWN_ALLOWED_ORIGINS].sort()).toEqual([
      'https://claude.ai',
      'https://claude.com',
    ]);
  });

  it('returns null for non-well-known paths', () => {
    const result = applyCorsHeaders({
      request: req('https://mcp.test/mcp', { headers: { Origin: ALLOWED } }),
      existing: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when there is no Origin header', () => {
    expect(applyCorsHeaders({ request: req(WELL_KNOWN), existing: null })).toBeNull();
  });

  it('returns null for a well-known path from a non-allowlisted origin', () => {
    const result = applyCorsHeaders({
      request: req(WELL_KNOWN, { headers: { Origin: 'https://evil.example' } }),
      existing: null,
    });
    expect(result).toBeNull();
  });

  it('answers an OPTIONS preflight from an allowlisted origin with a 204 + CORS headers', () => {
    const result = applyCorsHeaders({
      request: req(WELL_KNOWN, { method: 'OPTIONS', headers: { Origin: ALLOWED } }),
      existing: null,
    });
    expect(result).not.toBeNull();
    expect(result?.status).toBe(204);
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(result?.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(result?.headers.get('Vary')).toBe('Origin');
  });

  it('annotates a GET response from an allowlisted origin', () => {
    const existing = new Response('{"ok":true}', {
      headers: { 'Content-Type': 'application/json' },
    });
    const result = applyCorsHeaders({
      request: req(WELL_KNOWN, { method: 'GET', headers: { Origin: ALLOWED } }),
      existing,
    });
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(result?.headers.get('Vary')).toBe('Origin');
    expect(result?.headers.get('Content-Type')).toBe('application/json');
  });

  it('appends to a pre-existing Vary header rather than overwriting it', () => {
    const existing = new Response(null, { headers: { Vary: 'Accept-Encoding' } });
    const result = applyCorsHeaders({
      request: req(WELL_KNOWN, { method: 'GET', headers: { Origin: ALLOWED } }),
      existing,
    });
    expect(result?.headers.get('Vary')).toBe('Accept-Encoding, Origin');
  });

  it('returns null for a GET from an allowlisted origin when there is no upstream response', () => {
    const result = applyCorsHeaders({
      request: req(WELL_KNOWN, { method: 'GET', headers: { Origin: ALLOWED } }),
      existing: null,
    });
    expect(result).toBeNull();
  });
});
