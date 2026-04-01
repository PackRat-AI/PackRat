import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authUtils from '../../utils/auth';

// Mock the auth utilities
vi.mock('../../utils/auth', () => ({
  isValidApiKey: vi.fn(),
}));

import { apiKeyAuthMiddleware } from '../apiKeyAuth';

// Mock context
function makeMockContext() {
  return {
    req: {
      header: vi.fn(),
    },
    json: vi.fn((body: unknown, status?: number) => ({
      body,
      status: status || 200,
    })),
  } as unknown as Parameters<typeof apiKeyAuthMiddleware>[0];
}

const mockNext = vi.fn(() => Promise.resolve());

describe('apiKeyAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Authorization success
  // -------------------------------------------------------------------------
  describe('authorization success', () => {
    it('allows request when API key is valid', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(true);

      await apiKeyAuthMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.json).not.toHaveBeenCalled();
    });

    it('calls next() for valid API keys', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(true);

      const result = await apiKeyAuthMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(result).toBeUndefined();
    });

    it('checks API key validity', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(true);

      await apiKeyAuthMiddleware(c, mockNext);

      expect(authUtils.isValidApiKey).toHaveBeenCalledWith(c);
    });
  });

  // -------------------------------------------------------------------------
  // Authorization failures
  // -------------------------------------------------------------------------
  describe('authorization failures', () => {
    it('returns 401 when API key is invalid', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(false);

      const result = await apiKeyAuthMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'Unauthorized' },
        status: 401,
      });
    });

    it('does not call next() when API key is invalid', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(false);

      await apiKeyAuthMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when API key is missing', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(false);

      await apiKeyAuthMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles isValidApiKey throwing an error', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockImplementation(() => {
        throw new Error('Validation error');
      });

      await expect(apiKeyAuthMiddleware(c, mockNext)).rejects.toThrow('Validation error');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('calls isValidApiKey exactly once', async () => {
      const c = makeMockContext();
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(true);

      await apiKeyAuthMiddleware(c, mockNext);

      expect(authUtils.isValidApiKey).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple calls
  // -------------------------------------------------------------------------
  describe('multiple calls', () => {
    it('handles multiple valid requests', async () => {
      vi.mocked(authUtils.isValidApiKey).mockReturnValue(true);

      const c1 = makeMockContext();
      const c2 = makeMockContext();
      const c3 = makeMockContext();

      await apiKeyAuthMiddleware(c1, mockNext);
      await apiKeyAuthMiddleware(c2, mockNext);
      await apiKeyAuthMiddleware(c3, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('handles mixed valid/invalid requests', async () => {
      const c1 = makeMockContext();
      const c2 = makeMockContext();
      const c3 = makeMockContext();

      vi.mocked(authUtils.isValidApiKey)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      await apiKeyAuthMiddleware(c1, mockNext);
      await apiKeyAuthMiddleware(c2, mockNext);
      await apiKeyAuthMiddleware(c3, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2); // Only for valid keys
      expect(c2.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });
  });
});
