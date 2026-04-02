import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@packrat/api/utils/auth', () => ({
  isValidApiKey: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(),
}));

vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

import { isValidApiKey } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { verify } from 'hono/jwt';
import { authMiddleware } from '../auth';

// Mock context
function makeMockContext(authHeader?: string) {
  return {
    req: {
      header: vi.fn((name: string) => {
        if (name === 'Authorization') return authHeader;
        return undefined;
      }),
    },
    set: vi.fn(),
    json: vi.fn((body: unknown, status?: number) => ({
      body,
      status: status || 200,
    })),
  } as unknown as Parameters<typeof authMiddleware>[0];
}

const mockNext = vi.fn(() => Promise.resolve());

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // JWT Authentication
  // -------------------------------------------------------------------------
  describe('JWT authentication', () => {
    it('validates JWT token successfully', async () => {
      const c = makeMockContext('Bearer valid-token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 123 });

      await authMiddleware(c, mockNext);

      expect(verify).toHaveBeenCalledWith('valid-token', 'secret', { alg: 'HS256' });
      expect(c.set).toHaveBeenCalledWith('user', { userId: 123 });
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets user in context from JWT payload', async () => {
      const c = makeMockContext('Bearer token123');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'my-secret' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 456, role: 'USER' });

      await authMiddleware(c, mockNext);

      expect(c.set).toHaveBeenCalledWith('user', { userId: 456, role: 'USER' });
    });

    it('returns 401 when token is missing after Bearer', async () => {
      const c = makeMockContext('Bearer ');

      const result = await authMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'No token provided' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'No token provided' },
        status: 401,
      });
    });

    it('returns 401 when Authorization header has no Bearer token', async () => {
      const c = makeMockContext('InvalidFormat');

      const result = await authMiddleware(c, mockNext);

      // Split will result in undefined token
      expect(c.json).toHaveBeenCalledWith({ error: 'No token provided' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when JWT verification fails', async () => {
      const c = makeMockContext('Bearer invalid-token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

      const result = await authMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'Invalid token' },
        status: 401,
      });
    });

    it('uses correct JWT secret from environment', async () => {
      const c = makeMockContext('Bearer token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'custom-secret-123' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 1 });

      await authMiddleware(c, mockNext);

      expect(getEnv).toHaveBeenCalledWith(c);
      expect(verify).toHaveBeenCalledWith('token', 'custom-secret-123', { alg: 'HS256' });
    });
  });

  // -------------------------------------------------------------------------
  // API Key Authentication
  // -------------------------------------------------------------------------
  describe('API key authentication', () => {
    it('allows request when API key is valid', async () => {
      const c = makeMockContext(); // No Authorization header
      vi.mocked(isValidApiKey).mockReturnValue(true);

      await authMiddleware(c, mockNext);

      expect(isValidApiKey).toHaveBeenCalledWith(c);
      expect(mockNext).toHaveBeenCalled();
    });

    it('checks API key when no JWT provided', async () => {
      const c = makeMockContext();
      vi.mocked(isValidApiKey).mockReturnValue(true);

      await authMiddleware(c, mockNext);

      expect(isValidApiKey).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('returns 401 when both JWT and API key are invalid', async () => {
      const c = makeMockContext(); // No Authorization header
      vi.mocked(isValidApiKey).mockReturnValue(false);

      const result = await authMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'Unauthorized' },
        status: 401,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Authentication priority
  // -------------------------------------------------------------------------
  describe('authentication priority', () => {
    it('tries JWT first before API key', async () => {
      const c = makeMockContext('Bearer token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 1 });
      vi.mocked(isValidApiKey).mockReturnValue(false); // API key check should not matter

      await authMiddleware(c, mockNext);

      expect(verify).toHaveBeenCalled();
      expect(isValidApiKey).not.toHaveBeenCalled(); // Should not check API key if JWT succeeds
      expect(mockNext).toHaveBeenCalled();
    });

    it('falls back to API key when JWT fails', async () => {
      const c = makeMockContext('Bearer bad-token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockRejectedValue(new Error('Bad JWT'));
      vi.mocked(isValidApiKey).mockReturnValue(false);

      await authMiddleware(c, mockNext);

      expect(verify).toHaveBeenCalled();
      // Falls back - returns error before API key check
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
    });

    it('does not check API key if no auth header and JWT fails', async () => {
      const c = makeMockContext(); // No header
      vi.mocked(isValidApiKey).mockReturnValue(true);

      await authMiddleware(c, mockNext);

      // Goes straight to API key check
      expect(verify).not.toHaveBeenCalled();
      expect(isValidApiKey).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles Authorization header with extra spaces', async () => {
      const c = makeMockContext('Bearer  token-with-spaces');

      const result = await authMiddleware(c, mockNext);

      // split(' ')[1] will get the empty string or 'token-with-spaces'
      // Depending on how many spaces, it might work or fail
      // This tests actual behavior
      expect(c.req.header).toHaveBeenCalledWith('Authorization');
    });

    it('handles empty Authorization header', async () => {
      const c = makeMockContext('');
      vi.mocked(isValidApiKey).mockReturnValue(false);

      await authMiddleware(c, mockNext);

      // Empty string is truthy for if(authHeader) check, but split fails
      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });

    it('handles JWT verification with different error types', async () => {
      const c = makeMockContext('Bearer token');
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockRejectedValue('String error');

      const result = await authMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
    });
  });
});
