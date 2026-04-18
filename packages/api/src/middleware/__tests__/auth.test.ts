import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware } from '../auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@packrat/api/utils/auth', () => ({
  isValidApiKey: vi.fn(),
}));

vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    JWT_SECRET: 'test-secret',
    NEON_DATABASE_URL: 'postgres://user:pass@localhost/db',
  })),
}));

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
}));

vi.mock('@packrat/api/services/oauthService', () => ({
  validateAccessToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext(authHeader?: string) {
  return {
    req: {
      header: vi.fn((key: string) => {
        if (key === 'Authorization') return authHeader;
        return undefined;
      }),
    },
    json: vi.fn((data, status) => ({ data, status })),
    set: vi.fn(),
  } as any;
}

const mockNext = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const { verify } = await import('hono/jwt');
      const mockVerify = verify as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({ userId: 1, role: 'USER' });

      const c = makeMockContext('Bearer valid-token');
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.set).toHaveBeenCalledWith('user', { userId: 1, role: 'USER' });
    });

    it('should reject when token is missing in Authorization header', async () => {
      const c = makeMockContext('Bearer ');
      const _result = await authMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'No token provided' }, 401);
    });

    it('should reject when JWT token is invalid', async () => {
      const { verify } = await import('hono/jwt');
      const mockVerify = verify as ReturnType<typeof vi.fn>;
      mockVerify.mockRejectedValue(new Error('Invalid token'));

      const c = makeMockContext('Bearer invalid-token');
      const _result = await authMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
    });

    it('should reject when JWT verification throws error', async () => {
      const { verify } = await import('hono/jwt');
      const mockVerify = verify as ReturnType<typeof vi.fn>;
      mockVerify.mockRejectedValue(new Error('Token expired'));

      const c = makeMockContext('Bearer expired-token');
      await authMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
    });
  });

  describe('OAuth Token Authentication', () => {
    it('should authenticate with a valid oa_ prefixed token', async () => {
      const { createDb } = await import('@packrat/api/db');
      const { validateAccessToken } = await import('@packrat/api/services/oauthService');
      (createDb as ReturnType<typeof vi.fn>).mockReturnValue({});
      (validateAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 5,
        role: 'USER',
        scope: 'read:packs',
        clientId: 'packrat-cli',
      });

      const c = makeMockContext('Bearer oa_abc123def456');
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.set).toHaveBeenCalledWith('user', {
        userId: 5,
        role: 'USER',
        scope: 'read:packs',
      });
    });

    it('should reject when oa_ token is invalid or expired', async () => {
      const { createDb } = await import('@packrat/api/db');
      const { validateAccessToken } = await import('@packrat/api/services/oauthService');
      (createDb as ReturnType<typeof vi.fn>).mockReturnValue({});
      (validateAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const c = makeMockContext('Bearer oa_invalid_token');
      await authMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' }, 401);
    });

    it('should map ADMIN role from OAuth token correctly', async () => {
      const { createDb } = await import('@packrat/api/db');
      const { validateAccessToken } = await import('@packrat/api/services/oauthService');
      (createDb as ReturnType<typeof vi.fn>).mockReturnValue({});
      (validateAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 1,
        role: 'ADMIN',
        scope: '*',
        clientId: 'packrat-web',
      });

      const c = makeMockContext('Bearer oa_admin_token');
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.set).toHaveBeenCalledWith('user', {
        userId: 1,
        role: 'ADMIN',
        scope: '*',
      });
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key when no JWT is provided', async () => {
      const { isValidApiKey } = await import('@packrat/api/utils/auth');
      const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
      mockIsValidApiKey.mockReturnValue(true);

      const c = makeMockContext();
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when no auth method is provided', async () => {
      const { isValidApiKey } = await import('@packrat/api/utils/auth');
      const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
      mockIsValidApiKey.mockReturnValue(false);

      const c = makeMockContext();
      const _result = await authMiddleware(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });
  });

  describe('Authentication Priority', () => {
    it('should prefer JWT over API key when both are present', async () => {
      const { verify } = await import('hono/jwt');
      const mockVerify = verify as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({ userId: 1, role: 'USER' });

      const { isValidApiKey } = await import('@packrat/api/utils/auth');
      const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
      mockIsValidApiKey.mockReturnValue(true);

      const c = makeMockContext('Bearer valid-token');
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.set).toHaveBeenCalledWith('user', { userId: 1, role: 'USER' });
      // API key check should not be reached
      expect(mockIsValidApiKey).not.toHaveBeenCalled();
    });

    it('should use OAuth token path when oa_ prefix is present (not JWT path)', async () => {
      const { createDb } = await import('@packrat/api/db');
      const { validateAccessToken } = await import('@packrat/api/services/oauthService');
      const { verify } = await import('hono/jwt');
      (createDb as ReturnType<typeof vi.fn>).mockReturnValue({});
      (validateAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 7,
        role: 'USER',
        scope: '*',
        clientId: 'packrat-cli',
      });

      const c = makeMockContext('Bearer oa_my_token');
      await authMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // JWT verify should NOT have been called for oa_ tokens
      expect(verify).not.toHaveBeenCalled();
    });
  });
});
