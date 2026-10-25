import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every query starts with `db.tag(label)`, so the fake db records each tagged
 * chain (label + method calls) and resolves it with whatever the test queued
 * for that label, defaulting to `[]`.
 */
type Call = { method: string; args: unknown[] };
type Query = { label: string; calls: Call[] };

const mocks = vi.hoisted(() => ({
  queries: [] as Array<{ label: string; calls: Array<{ method: string; args: unknown[] }> }>,
  results: new Map<string, unknown[]>(),
}));

function chain(query: Query): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          const queued = mocks.results.get(query.label);
          const value = queued && queued.length > 0 ? queued.shift() : [];
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (typeof prop === 'symbol') return undefined;
        return (...args: unknown[]) => {
          query.calls.push({ method: prop, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock('@packrat/api/db', () => ({
  createDb: () => ({
    tag: (label: string) => {
      const query: Query = { label, calls: [] };
      mocks.queries.push(query);
      return chain(query);
    },
  }),
}));

import { listPendingAiReports, resolveAiReport } from '@packrat/api/services/aiReportModeration';

function respond(label: string, ...values: unknown[]) {
  mocks.results.set(label, [...(mocks.results.get(label) ?? []), ...values]);
}

function argOf(label: string, method: string): unknown {
  return mocks.queries.find((q) => q.label === label)?.calls.find((c) => c.method === method)
    ?.args[0];
}

describe('aiReportModeration', () => {
  beforeEach(() => {
    mocks.queries.length = 0;
    mocks.results.clear();
  });

  describe('listPendingAiReports()', () => {
    it('returns an empty queue when nothing is pending', async () => {
      await expect(listPendingAiReports()).resolves.toEqual([]);
    });

    it('maps each row to the admin shape with its reporter', async () => {
      respond('aiReports.admin.listPending', [
        {
          id: 7,
          userQuery: 'Can I drink from the stream?',
          aiResponse: 'Yes, untreated is fine.',
          reason: 'harmful_advice',
          userComment: null,
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
          reporterId: 'u_1',
          reporterFirstName: 'Sam',
          reporterLastName: null,
          reporterAvatarUrl: null,
        },
      ]);
      await expect(listPendingAiReports()).resolves.toEqual([
        {
          id: 7,
          userQuery: 'Can I drink from the stream?',
          aiResponse: 'Yes, untreated is fine.',
          reason: 'harmful_advice',
          userComment: null,
          reporter: { id: 'u_1', firstName: 'Sam', lastName: null, avatarUrl: null },
          reportedAt: '2026-10-02T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('resolveAiReport()', () => {
    it.each([
      ['dismiss', 'dismissed'],
      ['resolve', 'resolved'],
    ] as const)('%s marks the report %s and reviewed', async (action, status) => {
      respond('aiReports.admin.resolve', [{ id: 7 }]);
      await expect(resolveAiReport({ id: 7, action })).resolves.toEqual({
        ok: true,
        value: { success: true },
      });
      expect(argOf('aiReports.admin.resolve', 'set')).toEqual({
        status,
        reviewed: true,
        reviewedAt: expect.any(Date),
      });
    });

    it('returns 404 when no pending report matched', async () => {
      await expect(resolveAiReport({ id: 99, action: 'dismiss' })).resolves.toEqual({
        ok: false,
        status: 404,
        error: 'Report not found',
      });
    });
  });
});
