import { createOpenAI } from '@ai-sdk/openai';
import { getAuth } from '@packrat/api/auth';
import { chatRoutes } from '@packrat/api/routes/chat';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
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

vi.mock('@packrat/api/utils/auth', () => ({ isValidApiKey: vi.fn(() => false) }));
vi.mock('@packrat/db/schema', () => ({ reportedContent: {} }));

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

const mockGetAuth = vi.mocked(getAuth);
const mockGetEnv = vi.mocked(getEnv);
const mockCreateAIProvider = vi.mocked(createAIProvider);

const app = new Elysia({ prefix: '/api' }).use(chatRoutes);

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
      new Request('http://localhost/api/chat', {
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

// Real AI SDK + OpenAI adapter, with only the upstream HTTP boundary replaced.
// These credentials and responses are synthetic; no network/provider is contacted.
describe('iPhone chat wire contract', () => {
  const request = () =>
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer synthetic-session',
        origin: 'packrat://',
      },
      body: JSON.stringify({
        date: '2026-10-24T12:00:00Z',
        contextType: 'general',
        messages: [
          {
            id: 'synthetic-message',
            role: 'user',
            content: 'Hello',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        ],
      }),
    });

  it('upstream 401 is an HTTP 200 SSE error, not a client session 401', async () => {
    mockGetEnv.mockReturnValue({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic-provider-key',
    } as never);
    const upstream = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: 'Synthetic upstream authentication failure',
              type: 'invalid_request_error',
              code: 'invalid_api_key',
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    );
    mockCreateAIProvider.mockReturnValue(
      createOpenAI({ apiKey: 'synthetic-provider-key', fetch: upstream }),
    );
    const response = await app.handle(request());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('"type":"error"');
    expect(body).toContain('"errorText":"Chat is temporarily unavailable. Please try again."');
    expect(body).toContain('data: [DONE]');
    expect(body).not.toContain('Synthetic upstream authentication failure');
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'chat.stream.onError' }),
    );
  });

  it('real SDK success ends with text, finish and DONE', async () => {
    mockGetEnv.mockReturnValue({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic-provider-key',
    } as never);
    const events = [
      { type: 'response.created', response: { id: 'resp_1', created_at: 0, model: 'synthetic' } },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'message', id: 'msg_1' },
      },
      { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Bring water.' },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: { type: 'message', id: 'msg_1' },
      },
      { type: 'response.completed', response: { usage: { input_tokens: 1, output_tokens: 3 } } },
    ];
    const upstream = vi.fn(
      async () =>
        new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    );
    mockCreateAIProvider.mockReturnValue(
      createOpenAI({ apiKey: 'synthetic-provider-key', fetch: upstream }),
    );
    const response = await app.handle(request());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('"type":"text-delta","id":"msg_1","delta":"Bring water."');
    expect(body).toContain('"type":"finish","finishReason":"stop"');
    expect(body).toContain('data: [DONE]');
    expect(body).not.toContain('"type":"error"');
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('request cancellation reaches the upstream provider', async () => {
    mockGetEnv.mockReturnValue({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic-provider-key',
    } as never);
    let upstreamAborted = false;
    const upstream: typeof fetch = vi.fn(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => {
            upstreamAborted = true;
            reject(new DOMException('Cancelled', 'AbortError'));
          };
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        }),
    );
    mockCreateAIProvider.mockReturnValue(
      createOpenAI({ apiKey: 'synthetic-provider-key', fetch: upstream }),
    );
    const controller = new AbortController();
    const response = await app.handle(new Request(request(), { signal: controller.signal }));
    const body = response.text();
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    controller.abort();
    await body;
    expect(upstreamAborted).toBe(true);
  });

  it('missing session stays HTTP 401 and never starts the AI provider', async () => {
    mockGetAuth.mockResolvedValue({ api: { getSession: vi.fn(async () => null) } } as never);
    const response = await app.handle(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockCreateAIProvider).not.toHaveBeenCalled();
  });

  it('rate limiting stays HTTP 429 and never starts the AI provider', async () => {
    mockGetEnv.mockReturnValue({
      OPENAI_API_KEY: 'sk-test',
      TOKEN_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
    } as never);
    const response = await app.handle(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Too many chat requests, please try again shortly.',
    });
    expect(mockCreateAIProvider).not.toHaveBeenCalled();
  });
});
