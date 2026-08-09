import { getAuth } from '@packrat/api/auth';
import { chatRoutes } from '@packrat/api/routes/chat';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv } from '@packrat/api/utils/env-validation';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@packrat/api/auth', () => ({
  getAuth: vi.fn(),
}));

vi.mock('@packrat/api/auth/local-e2e', () => ({
  getLocalE2EUserFromRequest: vi.fn(async () => null),
}));

vi.mock('@packrat/api/auth/mcp-token', () => ({
  resolveMcpBearerUser: vi.fn(async () => null),
}));

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
}));

vi.mock('@packrat/api/utils/ai/provider', () => ({
  createAIProvider: vi.fn(),
}));

vi.mock('@packrat/api/utils/ai/tools', () => ({
  createTools: vi.fn(() => ({})),
}));

vi.mock('@packrat/api/utils/DbUtils', () => ({
  getSchemaInfo: vi.fn(async () => 'e2e schema'),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(),
}));

vi.mock('@packrat/api/utils/queryMetrics', () => ({
  setQueryMetricsUser: vi.fn(),
}));

vi.mock('@packrat/api/utils/sentry', () => ({
  apiAddBreadcrumb: vi.fn(),
  captureApiException: vi.fn(),
  setApiUser: vi.fn(),
}));

const mockGetAuth = getAuth as unknown as ReturnType<typeof vi.fn>;
const mockGetEnv = getEnv as unknown as ReturnType<typeof vi.fn>;
const mockCreateAIProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;

const app = new Elysia().use(chatRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEnv.mockReturnValue({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-test',
  } as never);
  mockGetAuth.mockResolvedValue({
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: 'test-user-id',
          email: 'swift-e2e@example.com',
          name: 'Swift E2E',
          role: 'USER',
        },
      })),
    },
  } as never);
});

describe('chat E2E stub route', () => {
  it('serves deterministic chat stream content for local stub keys', async () => {
    const response = await app.handle(
      new Request('http://localhost/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date: '2026-07-17',
          messages: [
            {
              id: 'test-message',
              role: 'user',
              parts: [{ type: 'text', text: 'Hi' }],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('three essential items');
    expect(mockCreateAIProvider).not.toHaveBeenCalled();
  });
});
