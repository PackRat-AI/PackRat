import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyAuthMiddleware } from '../apiKeyAuth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@packrat/api/utils/auth', () => ({
  isValidApiKey: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {
    json: vi.fn((data, status) => ({ data, status })),
  } as any;
}

const mockNext = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('apiKeyAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next when API key is valid', async () => {
    const { isValidApiKey } = await import('@packrat/api/utils/auth');
    const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
    mockIsValidApiKey.mockReturnValue(true);

    const c = makeMockContext();
    await apiKeyAuthMiddleware(c, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(c.json).not.toHaveBeenCalled();
  });

  it('should return 401 when API key is invalid', async () => {
    const { isValidApiKey } = await import('@packrat/api/utils/auth');
    const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
    mockIsValidApiKey.mockReturnValue(false);

    const c = makeMockContext();
    const result = await apiKeyAuthMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
  });

  it('should return 401 when API key is missing', async () => {
    const { isValidApiKey } = await import('@packrat/api/utils/auth');
    const mockIsValidApiKey = isValidApiKey as ReturnType<typeof vi.fn>;
    mockIsValidApiKey.mockReturnValue(false);

    const c = makeMockContext();
    const result = await apiKeyAuthMiddleware(c, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
  });
});
