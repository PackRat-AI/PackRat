import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryOverpass } from './client';

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function makeResponse(body: unknown, status = 200) {
  const ok = status < 400;
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Service Unavailable',
    json: vi.fn().mockResolvedValue(body),
  };
}

const validResponse = {
  version: 0.6,
  generator: 'Overpass API 0.7.61.8 (244012)',
  osm3s: {
    timestamp_osm_base: '2024-01-01T00:00:00Z',
    copyright: 'The data included in this document is from www.openstreetmap.org.',
  },
  elements: [
    {
      type: 'relation',
      id: 12345,
      tags: { name: 'Pacific Crest Trail', route: 'hiking' },
      bounds: { minlat: 32.5, minlon: -120.8, maxlat: 49.0, maxlon: -117.1 },
      members: [],
    },
  ],
};

describe('queryOverpass', () => {
  describe('HTTP request construction', () => {
    it('sends a POST to the default Overpass endpoint', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      await queryOverpass('[out:json];relation(12345);out geom;');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://overpass-api.de/api/interpreter',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses a custom endpoint when provided', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      await queryOverpass('ql', { endpoint: 'https://custom.example.com/api' });
      expect(mockFetch).toHaveBeenCalledWith('https://custom.example.com/api', expect.any(Object));
    });

    it('encodes the QL query as form-urlencoded body', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      const ql = '[out:json];relation(42);out geom;';
      await queryOverpass(ql);
      const firstCall = mockFetch.mock.calls.at(0) as [string, RequestInit] | undefined;
      const init = firstCall?.[1];
      expect(init?.body).toBe(`data=${encodeURIComponent(ql)}`);
    });

    it('sets Content-Type to application/x-www-form-urlencoded', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      await queryOverpass('ql');
      const firstCall = mockFetch.mock.calls.at(0) as [string, RequestInit] | undefined;
      const headers = firstCall?.[1]?.headers as Record<string, string> | undefined;
      expect(headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('sets a User-Agent header', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      await queryOverpass('ql');
      const firstCall = mockFetch.mock.calls.at(0) as [string, RequestInit] | undefined;
      const headers = firstCall?.[1]?.headers as Record<string, string> | undefined;
      expect(headers?.['User-Agent']).toBeDefined();
      expect(typeof headers?.['User-Agent']).toBe('string');
    });
  });

  describe('error handling', () => {
    it('throws when response status is not ok (429)', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 429));
      await expect(queryOverpass('ql')).rejects.toThrow(
        'Overpass request failed: 429 Service Unavailable',
      );
    });

    it('throws when response status is not ok (500)', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));
      await expect(queryOverpass('ql')).rejects.toThrow(
        'Overpass request failed: 500 Service Unavailable',
      );
    });

    it('throws when response JSON does not match expected schema', async () => {
      mockFetch.mockResolvedValue(makeResponse({ unexpected: 'data' }));
      await expect(queryOverpass('ql')).rejects.toThrow(
        'Overpass response did not match expected schema',
      );
    });

    it('throws when response is missing elements field', async () => {
      mockFetch.mockResolvedValue(makeResponse({ version: 0.6 }));
      await expect(queryOverpass('ql')).rejects.toThrow(
        'Overpass response did not match expected schema',
      );
    });
  });

  describe('successful response', () => {
    it('returns the parsed response data', async () => {
      mockFetch.mockResolvedValue(makeResponse(validResponse));
      const result = await queryOverpass('[out:json];relation(12345);out geom;');
      expect(result.elements).toHaveLength(1);
      const [firstElement] = result.elements;
      expect(firstElement?.id).toBe(12345);
    });

    it('returns empty elements array for no results', async () => {
      mockFetch.mockResolvedValue(makeResponse({ ...validResponse, elements: [] }));
      const result = await queryOverpass('ql');
      expect(result.elements).toHaveLength(0);
    });
  });
});
