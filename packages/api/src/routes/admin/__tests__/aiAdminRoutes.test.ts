/**
 * The AI admin routes are thin: each calls a service and translates its result
 * into an HTTP status. These drive them through Elysia with the services
 * mocked, to pin that translation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPendingAiReports: vi.fn(),
  resolveAiReport: vi.fn(),
  resolveAppTemplateOwnerId: vi.fn(),
  generatePacks: vi.fn(),
  packServiceUser: vi.fn(),
  captureApiException: vi.fn(),
}));

vi.mock('@packrat/api/services/aiReportModeration', () => ({
  listPendingAiReports: mocks.listPendingAiReports,
  resolveAiReport: mocks.resolveAiReport,
}));
vi.mock('@packrat/api/services/packTemplateImportService', () => ({
  resolveAppTemplateOwnerId: mocks.resolveAppTemplateOwnerId,
}));
vi.mock('@packrat/api/services/packService', () => ({
  PackService: class {
    constructor(userId: string) {
      mocks.packServiceUser(userId);
    }
    generatePacks = mocks.generatePacks;
  },
}));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));

const { adminAiReportModerationRoutes } = await import(
  '@packrat/api/routes/admin/aiReportModeration'
);
const { adminAiPacksRoutes } = await import('@packrat/api/routes/admin/aiPacks');

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin AI report routes', () => {
  it('lists pending reports under items', async () => {
    mocks.listPendingAiReports.mockResolvedValue([]);
    const res = await adminAiReportModerationRoutes.handle(request('/ai-reports'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it('passes a numeric id and the action to the service', async () => {
    mocks.resolveAiReport.mockResolvedValue({ ok: true, value: { success: true } });
    const res = await adminAiReportModerationRoutes.handle(
      request('/ai-reports/7/resolve', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(mocks.resolveAiReport).toHaveBeenCalledWith({ id: 7, action: 'resolve' });
  });

  it('returns the service status when the report is gone', async () => {
    mocks.resolveAiReport.mockResolvedValue({ ok: false, status: 404, error: 'Report not found' });
    const res = await adminAiReportModerationRoutes.handle(
      request('/ai-reports/7/dismiss', { method: 'POST' }),
    );
    expect(res.status).toBe(404);
  });

  it('rejects an unknown action', async () => {
    const res = await adminAiReportModerationRoutes.handle(
      request('/ai-reports/7/remove', { method: 'POST' }),
    );
    expect(res.status).toBe(422);
    expect(mocks.resolveAiReport).not.toHaveBeenCalled();
  });
});

describe('admin AI pack generation route', () => {
  it('generates as the app-template owner and returns summaries', async () => {
    mocks.resolveAppTemplateOwnerId.mockResolvedValue('admin_1');
    mocks.generatePacks.mockResolvedValue([
      { id: 'p1', name: 'Desert Overnighter', description: null, category: 'desert', tags: null },
    ]);
    const res = await adminAiPacksRoutes.handle(
      request('/packs/generate', { method: 'POST', body: { count: 1 } }),
    );
    expect(res.status).toBe(200);
    expect(mocks.packServiceUser).toHaveBeenCalledWith('admin_1');
    expect(mocks.generatePacks).toHaveBeenCalledWith(1);
    await expect(res.json()).resolves.toEqual({
      items: [
        { id: 'p1', name: 'Desert Overnighter', description: null, category: 'desert', tags: [] },
      ],
    });
  });

  it('returns 503 when no admin account can own the packs', async () => {
    mocks.resolveAppTemplateOwnerId.mockResolvedValue(null);
    const res = await adminAiPacksRoutes.handle(
      request('/packs/generate', { method: 'POST', body: { count: 1 } }),
    );
    expect(res.status).toBe(503);
    expect(mocks.generatePacks).not.toHaveBeenCalled();
  });

  it('reports and returns 500 when generation throws', async () => {
    mocks.resolveAppTemplateOwnerId.mockResolvedValue('admin_1');
    const error = new Error('model down');
    mocks.generatePacks.mockRejectedValue(error);
    const res = await adminAiPacksRoutes.handle(
      request('/packs/generate', { method: 'POST', body: { count: 2 } }),
    );
    expect(res.status).toBe(500);
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error, operation: 'adminAiPacks.generate' }),
    );
  });

  it('rejects a count above the limit', async () => {
    const res = await adminAiPacksRoutes.handle(
      request('/packs/generate', { method: 'POST', body: { count: 11 } }),
    );
    expect(res.status).toBe(422);
  });
});
