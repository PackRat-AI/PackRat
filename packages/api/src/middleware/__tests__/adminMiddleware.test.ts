import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMiddleware } from '../adminMiddleware';

// Mock context
function makeMockContext(user: { role: string } | null = null) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'user') return user;
      return undefined;
    }),
    json: vi.fn((body: unknown, status?: number) => ({
      body,
      status: status || 200,
    })),
  } as unknown as Parameters<typeof adminMiddleware>[0];
}

const mockNext = vi.fn(() => Promise.resolve());

describe('adminMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Authorization success
  // -------------------------------------------------------------------------
  describe('authorization success', () => {
    it('allows request when user is admin', async () => {
      const adminUser = { role: 'ADMIN', userId: 1 };
      const c = makeMockContext(adminUser);

      await adminMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.json).not.toHaveBeenCalled();
    });

    it('calls next() for admin users', async () => {
      const adminUser = { role: 'ADMIN', userId: 123, email: 'admin@example.com' };
      const c = makeMockContext(adminUser);

      const result = await adminMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(result).toBeUndefined(); // next() returns undefined in mock
    });
  });

  // -------------------------------------------------------------------------
  // Authorization failures
  // -------------------------------------------------------------------------
  describe('authorization failures', () => {
    it('returns 401 when user is not set', async () => {
      const c = makeMockContext(null);

      const result = await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'Unauthorized' },
        status: 401,
      });
    });

    it('returns 403 when user role is not ADMIN', async () => {
      const regularUser = { role: 'USER', userId: 1 };
      const c = makeMockContext(regularUser);

      const result = await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
      expect(mockNext).not.toHaveBeenCalled();
      expect(result).toEqual({
        body: { error: 'Forbidden' },
        status: 403,
      });
    });

    it('returns 403 for MODERATOR role', async () => {
      const moderator = { role: 'MODERATOR', userId: 2 };
      const c = makeMockContext(moderator);

      await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 403 for empty role', async () => {
      const userWithoutRole = { role: '', userId: 3 };
      const c = makeMockContext(userWithoutRole as any);

      await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles user object without role property', async () => {
      const userWithoutRole = { userId: 1 } as any;
      const c = makeMockContext(userWithoutRole);

      await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('is case-sensitive for ADMIN role', async () => {
      const lowercaseAdmin = { role: 'admin', userId: 1 };
      const c = makeMockContext(lowercaseAdmin as any);

      await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('handles user object with additional properties', async () => {
      const adminWithExtras = {
        role: 'ADMIN',
        userId: 1,
        email: 'admin@test.com',
        name: 'Admin User',
        permissions: ['all'],
      };
      const c = makeMockContext(adminWithExtras);

      await adminMiddleware(c, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(c.json).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Context.get behavior
  // -------------------------------------------------------------------------
  describe('context.get behavior', () => {
    it('retrieves user from context with get("user")', async () => {
      const adminUser = { role: 'ADMIN', userId: 1 };
      const c = makeMockContext(adminUser);

      await adminMiddleware(c, mockNext);

      expect(c.get).toHaveBeenCalledWith('user');
    });

    it('handles undefined user from context', async () => {
      const c = makeMockContext();
      // Explicitly set get to return undefined for 'user'
      vi.mocked(c.get).mockReturnValue(undefined);

      await adminMiddleware(c, mockNext);

      expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
    });
  });
});
