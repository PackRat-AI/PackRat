import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware } from '../auth';

// ---------------------------------------------------------------------------
// Mocks – verifyJWT is now backed by `jose` via `@packrat/api/utils/auth`, so
// we mock the utility module directly.
// ---------------------------------------------------------------------------
vi.mock('@packrat/api/utils/auth', () => ({
  isValidApiKey: vi.fn(),
  verifyJWT: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({ JWT_SECRET: 'test-secret' })),
}));

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
  } as never;
}

const mockNext = vi.fn();

describe('authMiddleware (legacy Hono wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const { verifyJWT } = await import('@packrat/api/utils/auth');
      const mockVerify = verifyJWT as unknown as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({ userId: 1, role: 'USER' });

      const c = makeMockContext('Bearer valid-token') as unknown as {
        set: ReturnType<typeof vi.fn>;
      };
      // biome-ignore lint/suspicious/noExplicitAny: test indirection
      await (authMiddleware as any)(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.set).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ userId: 1, role: 'USER' }),
      );
    });

    it('should reject when token is missing in Authorization header', async () => {
      const c = makeMockContext('Bearer ') as unknown as {
        json: ReturnType<typeof vi.fn>;
      };
      // biome-ignore lint/suspicious/noExplicitAny: test indirection
      await (authMiddleware as any)(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'No token provided' }, 401);
    });

    it('should reject when JWT token is invalid', async () => {
      const { verifyJWT } = await import('@packrat/api/utils/auth');
      const mockVerify = verifyJWT as unknown as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue(null);

      const c = makeMockContext('Bearer invalid-token') as unknown as {
        json: ReturnType<typeof vi.fn>;
      };
      // biome-ignore lint/suspicious/noExplicitAny: test indirection
      await (authMiddleware as any)(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401);
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key when no JWT is provided', async () => {
      const { isValidApiKey } = await import('@packrat/api/utils/auth');
      const mockIsValidApiKey = isValidApiKey as unknown as ReturnType<typeof vi.fn>;
      mockIsValidApiKey.mockReturnValue(true);

      const c = makeMockContext();
      // biome-ignore lint/suspicious/noExplicitAny: test indirection
      await (authMiddleware as any)(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when no auth method is provided', async () => {
      const { isValidApiKey } = await import('@packrat/api/utils/auth');
      const mockIsValidApiKey = isValidApiKey as unknown as ReturnType<typeof vi.fn>;
      mockIsValidApiKey.mockReturnValue(false);

      const c = makeMockContext() as unknown as { json: ReturnType<typeof vi.fn> };
      // biome-ignore lint/suspicious/noExplicitAny: test indirection
      await (authMiddleware as any)(c, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });
  });
});
