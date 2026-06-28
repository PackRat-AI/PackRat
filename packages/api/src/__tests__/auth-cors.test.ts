import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const compiledApp = { fetch: vi.fn(async () => new Response('ok')) };
  // `use` must be chainable: appBase.use(a).use(b).compile() mirrors Elysia's
  // fluent API. The mock returns the same builder object on every .use() call.
  const builder = { use: vi.fn(), compile: vi.fn(() => compiledApp) };
  builder.use.mockReturnValue(builder);
  const appBase = builder;

  return {
    appBase,
    captureApiException: vi.fn(),
    createQueryMetricsStore: vi.fn(() => ({ startTimeMs: Date.now(), route: 'test' })),
    flushQueryMetrics: vi.fn(async () => {}),
    getAuth: vi.fn(async () => ({ handler: vi.fn(async () => new Response('auth')) })),
    getEnv: vi.fn(() => ({ ENVIRONMENT: 'development' })),
    initQueryMetricsStore: vi.fn(() => ({ startTimeMs: Date.now(), route: 'fetch' })),
    instrumentWorkflowWithSentry: vi.fn((_opts: unknown, workflow: unknown) => workflow),
    queryMetricsAls: {
      getStore: vi.fn(() => undefined),
      run: vi.fn((_store: unknown, fn: () => unknown) => fn()),
    },
    record: vi.fn(),
    setWorkerEnv: vi.fn(),
    withSentry: vi.fn((_opts: unknown, handler: unknown) => handler),
  };
});

vi.mock('@better-auth/oauth-provider', () => ({
  oauthProviderAuthServerMetadata: vi.fn(),
  oauthProviderOpenIdConfigMetadata: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neonConfig: {},
}));

vi.mock('@packrat/api/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@packrat/api/app')>();
  return {
    addCorsHeaders: actual.addCorsHeaders,
    appBase: mocks.appBase,
    corsPreflightResponse: actual.corsPreflightResponse,
  };
});

vi.mock('@packrat/api/auth', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('@packrat/api/auth/consent-route', () => ({
  consentRoute: {},
  signInRoute: {},
}));

vi.mock('@packrat/api/auth/local-e2e', () => ({
  isLocalE2EAuthEnabled: vi.fn(() => false),
  localE2EToken: vi.fn(),
  makeLocalE2EUser: vi.fn(),
}));

vi.mock('@packrat/api/containers', () => ({
  AppContainer: class AppContainer {},
}));

vi.mock('@packrat/api/services', () => ({
  CatalogService: class CatalogService {},
}));

vi.mock('@packrat/api/services/etl/queue', () => ({
  processQueueBatch: vi.fn(),
}));

vi.mock('@packrat/api/services/retention/invalidLogRetention', () => ({
  sweepInvalidItemLogs: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: mocks.getEnv,
  setWorkerEnv: mocks.setWorkerEnv,
}));

vi.mock('@packrat/api/utils/queryMetrics', () => ({
  createQueryMetricsStore: mocks.createQueryMetricsStore,
  flushQueryMetrics: mocks.flushQueryMetrics,
  initQueryMetricsStore: mocks.initQueryMetricsStore,
  queryMetricsAls: mocks.queryMetricsAls,
}));

vi.mock('@packrat/api/utils/sentry', () => ({
  captureApiException: mocks.captureApiException,
  record: mocks.record,
}));

vi.mock('@packrat/api/workflows/catalog-etl-workflow', () => ({
  CatalogEtlWorkflow: class CatalogEtlWorkflow {},
}));

vi.mock('@sentry/cloudflare', () => ({
  instrumentWorkflowWithSentry: mocks.instrumentWorkflowWithSentry,
  withSentry: mocks.withSentry,
}));

const { default: worker } = await import('../index');

const ctx = {
  passThroughOnException: vi.fn(),
  waitUntil: vi.fn(),
} as unknown as ExecutionContext;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Worker /api/auth CORS', () => {
  it('answers sign-in preflight before Better Auth handles the request', async () => {
    const fetch = worker.fetch;
    if (!fetch) throw new Error('Worker fetch handler is not configured');

    const request = new Request('http://localhost:8787/api/auth/sign-in/email', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Headers': 'content-type',
        'Access-Control-Request-Method': 'POST',
      },
    });

    const res = await fetch(
      // safe-cast: Cloudflare's typed Request carries cf metadata; this path only reads URL, method, and headers.
      request as never,
      { ENVIRONMENT: 'development' } as never,
      ctx as never,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });
});
