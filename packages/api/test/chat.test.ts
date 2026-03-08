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
      const res = await api('/chat', httpMethods.post('', {}));
      expectUnauthorized(res);
    });
  });

  // The following tests are skipped because they require full AI stack including:
  // - Cloudflare AI binding (env.AI.autorag())
  // - OpenAI API integration
  // - Complex service dependencies
  // These would be better suited for integration tests with actual services
  describe.skip('POST /chat (requires AI services)', () => {
    it('accepts chat message', async () => {
      const chatMessage = {
        message: 'What gear do I need for a day hike?',
        context: {
          activity: 'hiking',
          duration: 'day',
          experience: 'beginner',
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', chatMessage));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['response']);
      expect(data.response).toBeDefined();
      expect(typeof data.response).toBe('string');
    });

    it('requires message field', async () => {
      const res = await apiWithAuth('/chat', httpMethods.post('', {}));
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('message');
    });

    it('accepts context information', async () => {
      const chatWithContext = {
        message: 'Recommend a sleeping bag',
        context: {
          temperature: 20,
          season: 'winter',
          budget: 300,
          activity: 'backpacking',
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', chatWithContext));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['response']);
      expect(data.response).toBeDefined();
    });

    it('handles gear recommendation requests', async () => {
      const gearRequest = {
        message: 'I need a tent for 2 people under $200',
        context: {
          category: 'shelter',
          capacity: 2,
          maxPrice: 200,
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', gearRequest));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.response).toBeDefined();
      // May also return recommended items
      if (data.recommendations) {
        expect(Array.isArray(data.recommendations)).toBe(true);
      }
    });

    it('handles packing list requests', async () => {
      const packingRequest = {
        message: 'Create a packing list for a 3-day backpacking trip',
        context: {
          activity: 'backpacking',
          duration: 3,
          season: 'summer',
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', packingRequest));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.response).toBeDefined();
      // May return structured packing list
      if (data.packingList) {
        expect(Array.isArray(data.packingList)).toBe(true);
      }
    });

    it('handles trip planning questions', async () => {
      const tripRequest = {
        message: 'Plan a weekend camping trip in the mountains',
        context: {
          activity: 'camping',
          duration: 'weekend',
          location: 'mountains',
          groupSize: 4,
        },
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', tripRequest));

      expect(res.status).toBe(200);
      await expectJsonResponse(res, ['response']);
    });

    it('maintains conversation context', async () => {
      // First message
      const firstMessage = {
        message: 'I am planning a hiking trip',
        conversationId: 'test-conversation-1',
      };

      const res1 = await apiWithAuth('/chat', httpMethods.post('', firstMessage));

      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      // Follow-up message
      const followupMessage = {
        message: 'What shoes should I wear?',
        conversationId: data1.conversationId || 'test-conversation-1',
      };

      const res2 = await apiWithAuth('/chat', httpMethods.post('', followupMessage));

      expect(res2.status).toBe(200);
      await expectJsonResponse(res2, ['response']);
    });
  });

  describe.skip('Error Handling (requires AI services)', () => {
    it('handles AI service errors gracefully', async () => {
      // Mock AI service failure
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post('', {
          message: 'This might cause an AI error',
        }),
      );

      // Should not crash, should return error message
      if (res.status === 500) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles malformed requests', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post('', {
          invalidField: 'invalid',
        }),
      );

      expectBadRequest(res);
    });

    it('handles empty messages', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post('', {
          message: '',
        }),
      );

      expectBadRequest(res);
    });

    it('handles special characters in messages', async () => {
      const specialMessage = {
        message: 'Test with special chars: @#$%^&*()[]{}|\\:";\'<>?,./',
      };

      const res = await apiWithAuth('/chat', httpMethods.post('', specialMessage));

      // Should handle gracefully
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        await expectJsonResponse(res);
      } else {
        expectBadRequest(res);
      }
    });
  });

  describe.skip('Rate Limiting (requires AI services)', () => {
    it('handles multiple rapid requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map((_, i) =>
          apiWithAuth(
            '/chat',
            httpMethods.post('', {
              message: `Test message ${i + 1}`,
            }),
          ),
        );

      const responses = await Promise.all(requests);

      // Some may succeed, some may be rate limited
      responses.forEach((res) => {
        expect([200, 429]).toContain(res.status);
      });
    });
  });
});
