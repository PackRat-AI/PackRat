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
  getAdminPack: vi.fn(),
  updateAdminPack: vi.fn(),
  createAdminPackItem: vi.fn(),
  updateAdminPackItem: vi.fn(),
  deleteAdminPackItem: vi.fn(),
}));

vi.mock('@packrat/api/services/adminPacksService', () => ({
  getAdminPack: mocks.getAdminPack,
  updateAdminPack: mocks.updateAdminPack,
  createAdminPackItem: mocks.createAdminPackItem,
  updateAdminPackItem: mocks.updateAdminPackItem,
  deleteAdminPackItem: mocks.deleteAdminPackItem,
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
    expect(mocks.resolveAiReport).toHaveBeenCalledTimes(0);
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
    expect(mocks.generatePacks).toHaveBeenCalledWith({ count: 1, isPublic: false });
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
    expect(mocks.generatePacks).toHaveBeenCalledTimes(0);
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

describe('admin pack review routes', () => {
  const pack = {
    id: 'p1',
    name: 'Desert Overnighter',
    description: null,
    category: 'desert',
    image: null,
    tags: [],
    isPublic: false,
    isAIGenerated: true,
    ownerEmail: 'admin@example.com',
    itemCount: 0,
    totalWeightGrams: 0,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    items: [],
  };

  it('returns a pack with its items', async () => {
    mocks.getAdminPack.mockResolvedValue(pack);
    const res = await adminAiPacksRoutes.handle(request('/packs/p1'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(pack);
  });

  it('returns 404 for a missing pack', async () => {
    mocks.getAdminPack.mockResolvedValue(null);
    const res = await adminAiPacksRoutes.handle(request('/packs/nope'));
    expect(res.status).toBe(404);
  });

  it('publishes by passing isPublic through', async () => {
    mocks.updateAdminPack.mockResolvedValue({ ...pack, isPublic: true });
    const res = await adminAiPacksRoutes.handle(
      request('/packs/p1', { method: 'PATCH', body: { isPublic: true } }),
    );
    expect(res.status).toBe(200);
    expect(mocks.updateAdminPack).toHaveBeenCalledWith({
      id: 'p1',
      changes: { isPublic: true },
    });
  });

  it('returns 404 when the pack is not AI-generated', async () => {
    mocks.updateAdminPack.mockResolvedValue(null);
    const res = await adminAiPacksRoutes.handle(
      request('/packs/p1', { method: 'PATCH', body: { name: 'Mine' } }),
    );
    expect(res.status).toBe(404);
  });

  it('rejects an unknown category', async () => {
    const res = await adminAiPacksRoutes.handle(
      request('/packs/p1', { method: 'PATCH', body: { category: 'spelunking' } }),
    );
    expect(res.status).toBe(422);
    expect(mocks.updateAdminPack).toHaveBeenCalledTimes(0);
  });

  it('adds an item to the pack', async () => {
    const item = {
      id: 'i1',
      name: 'Tent',
      description: null,
      weight: 900,
      weightUnit: 'g',
      quantity: 1,
      category: 'shelter',
      consumable: false,
      worn: false,
      image: null,
      notes: null,
      catalogItemId: null,
    };
    mocks.createAdminPackItem.mockResolvedValue(item);
    const body = { name: 'Tent', weight: 900, weightUnit: 'g', category: 'shelter' };
    const res = await adminAiPacksRoutes.handle(
      request('/packs/p1/items', { method: 'POST', body }),
    );
    expect(res.status).toBe(200);
    expect(mocks.createAdminPackItem).toHaveBeenCalledWith({ packId: 'p1', item: body });
  });

  it('edits an item', async () => {
    mocks.updateAdminPackItem.mockResolvedValue(null);
    const res = await adminAiPacksRoutes.handle(
      request('/packs/items/i1', { method: 'PATCH', body: { quantity: 2 } }),
    );
    expect(res.status).toBe(404);
    expect(mocks.updateAdminPackItem).toHaveBeenCalledWith({
      itemId: 'i1',
      changes: { quantity: 2 },
    });
  });

  it('removes an item', async () => {
    mocks.deleteAdminPackItem.mockResolvedValue(true);
    const res = await adminAiPacksRoutes.handle(request('/packs/items/i1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mocks.deleteAdminPackItem).toHaveBeenCalledWith('i1');
  });
});
