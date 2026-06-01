// Unit tests for the invalid_item_logs retention sweep.
//
// The function's behavior with real DB rows is covered by integration tests
// (test/etl-log-retention.test.ts). These unit tests stub createDbClient to
// verify the loop semantics — stop on empty batch, iteration cap, and the
// returned RetentionResult shape — without touching Postgres.

import { sweepInvalidItemLogs } from '@packrat/api/services/retention/invalidLogRetention';
import type { Env } from '@packrat/api/utils/env-validation';
import { afterEach, describe, expect, it, vi } from 'vitest';

type FakeRow = { id: number };

// Hoisted state shared between the mock factory and the tests. `vi.mock` calls
// hoist above imports, so this declaration uses `vi.hoisted` to ensure the
// mock factory and the test code reference the same array.
const mockState = vi.hoisted(() => ({
  batches: [] as FakeRow[][],
  callCount: 0,
}));

vi.mock('@packrat/api/db', () => {
  const mockDb = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockState }) }) }),
    delete: () => ({
      where: () => ({
        returning: async () => {
          const batch = mockState.batches[mockState.callCount] ?? [];
          mockState.callCount += 1;
          return batch;
        },
      }),
    }),
  };
  return { createDbClient: () => mockDb };
});

function setBatches(batches: FakeRow[][]) {
  mockState.batches = batches;
  mockState.callCount = 0;
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

  it('accumulates deletions across batches until a short batch stops the loop', async () => {
    const fullBatch: FakeRow[] = Array.from({ length: 10_000 }, () => ({ id: 1 }));
    setBatches([fullBatch, fullBatch, [{ id: 1 }], []]);

    const result = await sweepInvalidItemLogs({} as Env);

    expect(result.deleted).toBe(20_001);
    expect(result.iterations).toBe(3);
    expect(result.capped).toBe(false);
  });

  it('caps at maxIterations and reports capped=true', async () => {
    const fullBatch: FakeRow[] = Array.from({ length: 100 }, () => ({ id: 1 }));
    setBatches([fullBatch, fullBatch, fullBatch, fullBatch, fullBatch]);

    const result = await sweepInvalidItemLogs({} as Env, { batchSize: 100, maxIterations: 3 });

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
