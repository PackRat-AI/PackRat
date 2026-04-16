import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

// Chat routes tests
// Note: Most chat functionality requires Cloudflare AI binding (env.AI.autorag) which is
// complex to mock properly in test environment. Focus on authentication and validation.
describe('Chat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('requires auth for chat endpoint', async () => {
      const res = await api('/chat', httpMethods.post({}));
      expectUnauthorized(res);
    });
  });

  // /chat streams its response via Server-Sent Events — asserting on a JSON
  // body would always fail. We verify the contract the route promises: 200 +
  // event-stream content-type. Streaming payload shape is covered by the
  // vercel-ai mock in setup.ts.
  describe('POST /chat', () => {
    it('returns a streaming response for an authed request', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post({
          messages: [{ role: 'user', content: 'What gear do I need for a day hike?' }],
        }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });

    it('accepts an empty messages array', async () => {
      const res = await apiWithAuth('/chat', httpMethods.post({ messages: [] }));
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('handles an empty body without crashing', async () => {
      const res = await apiWithAuth('/chat', httpMethods.post({}));
      // Route defaults to an empty messages array; returns 200 stream.
      expect([200, 400]).toContain(res.status);
    });

    it('handles empty messages', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post({
          message: '',
        }),
      );

      expectBadRequest(res);
    });

    it('handles special characters in messages', async () => {
      const specialMessage = {
        message: 'Test with special chars: @#$%^&*()[]{}|\\:";\'<>?,./',
      };

      const res = await apiWithAuth('/chat', httpMethods.post(specialMessage));

      // Should handle gracefully
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        await expectJsonResponse(res);
      } else {
        expectBadRequest(res);
      }
    });
  });

  // Rate limiting is not implemented on /chat yet — keeping a placeholder for
  // when it is so we don't forget to cover it. Skip for now to avoid noise.
  describe.skip('Rate Limiting (TODO: once implemented)', () => {
    it('caps concurrent requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => apiWithAuth('/chat', httpMethods.post({ messages: [] })));
      const responses = await Promise.all(requests);
      for (const res of responses) expect([200, 429]).toContain(res.status);
    });
  });
});
