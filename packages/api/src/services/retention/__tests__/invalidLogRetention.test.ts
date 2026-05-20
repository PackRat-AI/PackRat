// Unit tests for the invalid_item_logs retention sweep.
//
// The function's behavior with real DB rows is covered by integration tests
// (test/etl-log-retention.test.ts). These unit tests stub createDbClient to
// verify the loop semantics — stop on empty batch, iteration cap, and the
// returned RetentionResult shape — without touching Postgres.

import { sweepInvalidItemLogs } from '@packrat/api/services/retention/invalidLogRetention';
import type { Env } from '@packrat/api/utils/env-validation';
import { afterEach, describe, expect, it, vi } from 'vitest';

const FAKE_ROW = { id: 1 } as const;

vi.mock('@packrat/api/db', () => {
  const state = {
    batches: [] as Array<(typeof FAKE_ROW)[]>,
    callCount: 0,
  };

  const mockDb = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => state }) }) }),
    delete: () => ({
      where: () => ({
        returning: async () => {
          const batch = state.batches[state.callCount] ?? [];
          state.callCount += 1;
          return batch;
        },
      }),
    }),
    __state: state,
  };

  return {
    createDbClient: () => mockDb,
    __mockDb: mockDb,
  };
});

import { __mockDb } from '@packrat/api/db';

type MockDb = { __state: { batches: (typeof FAKE_ROW)[][]; callCount: number } };

function setBatches(batches: (typeof FAKE_ROW)[][]) {
  const db = __mockDb as unknown as MockDb;
  db.__state.batches = batches;
  db.__state.callCount = 0;
}

describe('sweepInvalidItemLogs', () => {
  afterEach(() => {
    setBatches([]);
  });

  it('returns deleted=0 / iterations=1 when the first batch is empty', async () => {
    setBatches([[]]);
    const result = await sweepInvalidItemLogs({} as Env);
    expect(result.deleted).toBe(0);
    expect(result.iterations).toBe(1);
    expect(result.capped).toBe(false);
    expect(result.retentionDays).toBe(90);
  });

  it('accumulates deletions across batches until an empty one stops the loop', async () => {
    const fullBatch = Array.from({ length: 10_000 }, () => FAKE_ROW);
    setBatches([fullBatch, fullBatch, [FAKE_ROW], []]);

    const result = await sweepInvalidItemLogs({} as Env);

    expect(result.deleted).toBe(20_001);
    expect(result.iterations).toBe(4);
    expect(result.capped).toBe(false);
  });

  it('caps at maxIterations and reports capped=true', async () => {
    const fullBatch = Array.from({ length: 100 }, () => FAKE_ROW);
    setBatches([fullBatch, fullBatch, fullBatch, fullBatch, fullBatch]);

    const result = await sweepInvalidItemLogs({} as Env, { maxIterations: 3 });

    expect(result.iterations).toBe(3);
    expect(result.capped).toBe(true);
    expect(result.deleted).toBe(300);
  });

  it('honors a custom retentionDays option', async () => {
    setBatches([[]]);
    const result = await sweepInvalidItemLogs({} as Env, { retentionDays: 30 });
    expect(result.retentionDays).toBe(30);
  });

  it('falls back to the default retentionDays when the option is zero or negative', async () => {
    setBatches([[]]);
    const result = await sweepInvalidItemLogs({} as Env, { retentionDays: 0 });
    expect(result.retentionDays).toBe(90);
  });
});
