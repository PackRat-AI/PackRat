import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted so the module factory for queryMetrics runs against mocked deps.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsertFn = vi.fn(() => ({ values: mockInsertValues }));
  const mockDb = { insert: mockInsertFn };
  return {
    mockInsertValues,
    mockInsertFn,
    mockDb,
    createMetricsDb: vi.fn(() => mockDb),
    getEnv: vi.fn(),
  };
});

vi.mock('@packrat/api/db/metricsDb', () => ({ createMetricsDb: mocks.createMetricsDb }));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: mocks.getEnv }));
vi.mock('@packrat/db/d1Schema', () => ({ requestQueryMetricsD1: {} }));

import type { QueryMetricsStore } from '../queryMetrics';
import {
  createQueryMetricsStore,
  estimateResultBytes,
  flushQueryMetrics,
  hashQuery,
  initQueryMetricsStore,
  queryMetricsAls,
  recordQueryExecution,
  setQueryMetricsUser,
  setQueryTag,
} from '../queryMetrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<QueryMetricsStore> = {}): QueryMetricsStore {
  return {
    route: '/api/test',
    method: 'GET',
    startTimeMs: Date.now(),
    queries: [],
    totalDurationMs: 0,
    estimatedEgressBytes: 0,
    ...overrides,
  };
}

const fakeQuery = { hash: 'abc12345', preview: 'SELECT 1', durationMs: 5, resultBytes: 20 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createQueryMetricsStore', () => {
  it('initialises store with route, method and empty queries', () => {
    const store = createQueryMetricsStore('/api/foo', 'POST');
    expect(store.route).toBe('/api/foo');
    expect(store.method).toBe('POST');
    expect(store.queries).toEqual([]);
    expect(store.totalDurationMs).toBe(0);
    expect(store.estimatedEgressBytes).toBe(0);
  });
});

describe('initQueryMetricsStore', () => {
  it('normalises UUIDs in the path to :id', () => {
    const req = new Request('https://api.packrat.world/items/123e4567-e89b-12d3-a456-426614174000');
    const store = initQueryMetricsStore(req);
    expect(store.route).toBe('/items/:id');
    expect(store.method).toBe('GET');
  });

  it('normalises long numeric IDs to :id', () => {
    const req = new Request('https://api.packrat.world/items/12345678');
    const store = initQueryMetricsStore(req);
    expect(store.route).toBe('/items/:id');
  });

  it('normalises long tokens to :token', () => {
    const req = new Request('https://api.packrat.world/auth/abcdefghijklmnopqrstuvwxyz123456');
    const store = initQueryMetricsStore(req);
    expect(store.route).toBe('/auth/:token');
  });
});

describe('setQueryMetricsUser', () => {
  it('sets userId on the ALS store', () => {
    const store = makeStore();
    queryMetricsAls.run(store, () => {
      setQueryMetricsUser('user-123');
    });
    expect(store.userId).toBe('user-123');
  });

  it('is a no-op when no store is active', () => {
    expect(() => setQueryMetricsUser('user-abc')).not.toThrow();
  });
});

describe('setQueryTag', () => {
  it('sets currentQueryTag on the active store', () => {
    const store = makeStore();
    queryMetricsAls.run(store, () => {
      setQueryTag('service.method');
    });
    expect(store.currentQueryTag).toBe('service.method');
  });

  it('is a no-op when no store is active', () => {
    expect(() => setQueryTag('noop')).not.toThrow();
  });
});

describe('hashQuery', () => {
  it('returns an 8-char hex string', () => {
    expect(hashQuery('SELECT 1')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces the same hash for the same input', () => {
    expect(hashQuery('SELECT * FROM users')).toBe(hashQuery('SELECT * FROM users'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashQuery('SELECT 1')).not.toBe(hashQuery('SELECT 2'));
  });
});

describe('estimateResultBytes', () => {
  it('returns the byte length of JSON-serialised rows', () => {
    const rows = [{ id: 1, name: 'Alice' }];
    expect(estimateResultBytes(rows)).toBe(
      new TextEncoder().encode(JSON.stringify(rows)).byteLength,
    );
  });

  it('counts multi-byte UTF-8 characters correctly', () => {
    const rows = [{ name: 'Hébergement' }]; // é is 2 bytes in UTF-8
    const byteLength = new TextEncoder().encode(JSON.stringify(rows)).byteLength;
    expect(estimateResultBytes(rows)).toBe(byteLength);
    expect(byteLength).toBeGreaterThan(JSON.stringify(rows).length);
  });

  it('returns 0 when rows cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(estimateResultBytes(circular)).toBe(0);
  });
});

describe('recordQueryExecution', () => {
  it('appends an entry to the active store', () => {
    const store = makeStore();
    queryMetricsAls.run(store, () => {
      recordQueryExecution(fakeQuery);
    });
    expect(store.queries).toHaveLength(1);
    expect(store.queries[0]).toEqual(fakeQuery);
  });

  it('is a no-op when no store is active', () => {
    expect(() => recordQueryExecution(fakeQuery)).not.toThrow();
  });
});

describe('flushQueryMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips health-check routes', async () => {
    const store = makeStore({ route: '/health', queries: [fakeQuery] });
    await flushQueryMetrics(store);
    expect(mocks.createMetricsDb).not.toHaveBeenCalled();
  });

  it('skips when no queries and duration is trivial', async () => {
    const store = makeStore({ queries: [], totalDurationMs: 2 });
    await flushQueryMetrics(store);
    expect(mocks.createMetricsDb).not.toHaveBeenCalled();
  });

  it('skips when METRICS_DB is absent from env', async () => {
    mocks.getEnv.mockReturnValue({ METRICS_DB: null });
    const store = makeStore({ queries: [fakeQuery] });
    await flushQueryMetrics(store);
    expect(mocks.createMetricsDb).not.toHaveBeenCalled();
  });

  it('inserts a metrics row when all conditions are met', async () => {
    const fakeD1 = {};
    mocks.getEnv.mockReturnValue({ METRICS_DB: fakeD1 });
    const store = makeStore({ queries: [fakeQuery], totalDurationMs: 15, userId: 'u1' });

    await flushQueryMetrics(store, 200);

    expect(mocks.createMetricsDb).toHaveBeenCalledWith(fakeD1);
    expect(mocks.mockInsertFn).toHaveBeenCalledWith({});
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        queryCount: 1,
        userId: 'u1',
        queries: JSON.stringify([fakeQuery]),
      }),
    );
  });

  it('passes null statusCode when omitted', async () => {
    mocks.getEnv.mockReturnValue({ METRICS_DB: {} });
    const store = makeStore({ queries: [fakeQuery] });

    await flushQueryMetrics(store);

    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: null }),
    );
  });

  it('swallows errors without throwing', async () => {
    mocks.getEnv.mockReturnValue({ METRICS_DB: {} });
    mocks.mockInsertValues.mockRejectedValueOnce(new Error('D1 error'));
    const store = makeStore({ queries: [fakeQuery] });

    await expect(flushQueryMetrics(store)).resolves.not.toThrow();
  });

  it('flushes when there are queries even if duration is below threshold', async () => {
    mocks.getEnv.mockReturnValue({ METRICS_DB: {} });
    const store = makeStore({ queries: [fakeQuery], totalDurationMs: 0 });

    await flushQueryMetrics(store);

    expect(mocks.mockInsertValues).toHaveBeenCalled();
  });
});
