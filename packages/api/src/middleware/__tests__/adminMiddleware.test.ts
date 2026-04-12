import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMiddleware } from '../adminMiddleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext(user?: any) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'user') return user;
      return undefined;
    }),
    json: vi.fn((data, status) => ({ data, status })),
  } as any;
}

const mockNext = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('adminMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next when user is an admin', async () => {
    const c = makeMockContext({ userId: 1, role: 'ADMIN' });
    await adminMiddleware(c, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(c.json).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', async () => {
    const c = makeMockContext(undefined);
    const _result = await adminMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
  });

  it('should return 403 when user is not an admin', async () => {
    const c = makeMockContext({ userId: 1, role: 'USER' });
    const _result = await adminMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
  });

  it('should return 401 when user is null', async () => {
    const c = makeMockContext(null);
    const _result = await adminMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
  });

  it('should return 403 when user has different role', async () => {
    const c = makeMockContext({ userId: 2, role: 'MODERATOR' });
    const _result = await adminMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Forbidden' }, 403);
  });
});
