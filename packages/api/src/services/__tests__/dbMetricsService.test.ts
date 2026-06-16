import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbMetricsService } from '../dbMetricsService';

// ---------------------------------------------------------------------------
// Mocks
//
// snapshot() fires four execute() calls via Promise.all in source order:
//   1. fetchDatabaseInfo  (pg_database_size)
//   2. fetchTables        (pg_class + pg_stat_user_tables)
//   3. fetchIndexes       (pg_stat_user_indexes)
//   4. fetchStatsResetAt  (pg_stat_database)
// We drive each call with mockResolvedValueOnce in that order so tests stay
// hermetic without depending on Drizzle's SQL string representation.
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();
const mockDb = { execute: mockExecute, tag: (_label: string) => mockDb };

vi.mock('@packrat/api/db', () => ({
  createReadOnlyDb: vi.fn(() => mockDb),
}));

interface CallFixtures {
  databaseInfo: { name: string; size_bytes: string } | undefined;
  tables: Array<Record<string, unknown>>;
  indexes: Array<Record<string, unknown>>;
  statsReset: { stats_reset: string | null } | undefined;
}

function queueFixtures(f: CallFixtures): void {
  mockExecute.mockReset();
  mockExecute.mockResolvedValueOnce({ rows: f.databaseInfo ? [f.databaseInfo] : [] });
  mockExecute.mockResolvedValueOnce({ rows: f.tables });
  mockExecute.mockResolvedValueOnce({ rows: f.indexes });
  mockExecute.mockResolvedValueOnce({ rows: f.statsReset ? [f.statsReset] : [] });
}

const makeTableRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  name: 'catalog_items',
  est_rows: '1790606',
  heap_bytes: '3336863744',
  toast_bytes: '16106127360',
  index_bytes: '16106127360',
  total_bytes: '35433480192',
  seq_scan: '32475',
  seq_tup_read: '2806032896',
  idx_scan: '14682572',
  idx_tup_fetch: '19313043',
  n_tup_ins: '1789703',
  n_tup_upd: '5556406',
  n_tup_del: '10',
  n_tup_hot_upd: '0',
  n_live_tup: '1789693',
  n_dead_tup: '0',
  last_autovacuum: null,
  last_autoanalyze: '2026-06-04T12:34:56Z',
  ...overrides,
});

const makeIndexRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  table: 'catalog_items',
  name: 'embedding_idx',
  bytes: '15032385536',
  is_unique: false,
  idx_scan: '0',
  idx_tup_read: '0',
  idx_tup_fetch: '0',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DbMetricsService', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  describe('snapshot()', () => {
    it('returns a fully populated snapshot with parsed numerics', async () => {
      queueFixtures({
        databaseInfo: { name: 'packrat-neon-db', size_bytes: '39245591696' },
        statsReset: { stats_reset: null },
        tables: [makeTableRow()],
        indexes: [makeIndexRow()],
      });

      const service = new DbMetricsService();
      const result = await service.snapshot();

      // Top-level shape
      expect(result).toMatchObject({
        statsResetAt: null,
        database: { name: 'packrat-neon-db', sizeBytes: 39245591696 },
      });
      expect(typeof result.generatedAt).toBe('string');
      expect(new Date(result.generatedAt).toString()).not.toBe('Invalid Date');

      // Tables — text-cast numerics parsed back to number
      expect(result.tables).toHaveLength(1);
      const [table] = result.tables;
      expect(table).toMatchObject({
        name: 'catalog_items',
        estimatedRows: 1790606,
        heapBytes: 3336863744,
        toastBytes: 16106127360,
        indexBytes: 16106127360,
        totalBytes: 35433480192,
        seqScans: 32475,
        seqTuplesRead: 2806032896,
        idxScans: 14682572,
        idxTuplesFetched: 19313043,
        inserts: 1789703,
        updates: 5556406,
        deletes: 10,
        hotUpdates: 0,
        liveTuples: 1789693,
        deadTuples: 0,
        lastAutovacuum: null,
        lastAutoanalyze: '2026-06-04T12:34:56Z',
      });

      // Indexes
      expect(result.indexes).toHaveLength(1);
      const [index] = result.indexes;
      expect(index).toMatchObject({
        table: 'catalog_items',
        name: 'embedding_idx',
        bytes: 15032385536,
        isUnique: false,
        scans: 0,
        tuplesRead: 0,
        tuplesFetched: 0,
      });
    });

    it('falls back gracefully when database info query returns no rows', async () => {
      queueFixtures({
        databaseInfo: undefined,
        statsReset: { stats_reset: null },
        tables: [],
        indexes: [],
      });

      const service = new DbMetricsService();
      const result = await service.snapshot();

      expect(result.database).toEqual({ name: 'unknown', sizeBytes: 0 });
      expect(result.tables).toEqual([]);
      expect(result.indexes).toEqual([]);
    });

    it('treats reltoastrelid=0 tables (toast_bytes "0") as toastBytes: 0', async () => {
      // Defensive: ensures the parser handles the SQL CASE branch output
      // (string "0") correctly. The CASE is required because
      // pg_relation_size(0) raises before COALESCE can wrap it; this test
      // locks in the parser's behavior on that fixture shape.
      queueFixtures({
        databaseInfo: { name: 'db', size_bytes: '0' },
        statsReset: { stats_reset: '2026-01-01T00:00:00Z' },
        tables: [
          makeTableRow({
            name: 'tiny_table',
            est_rows: '0',
            heap_bytes: '8192',
            toast_bytes: '0',
            index_bytes: '0',
            total_bytes: '8192',
            idx_scan: null,
            idx_tup_fetch: null,
          }),
        ],
        indexes: [],
      });

      const service = new DbMetricsService();
      const result = await service.snapshot();

      expect(result.statsResetAt).toBe('2026-01-01T00:00:00Z');
      expect(result.tables[0]).toMatchObject({
        name: 'tiny_table',
        toastBytes: 0,
        idxScans: 0,
        idxTuplesFetched: 0,
      });
    });

    it('preserves the order of tables and indexes returned by the underlying SQL', async () => {
      queueFixtures({
        databaseInfo: { name: 'db', size_bytes: '0' },
        statsReset: { stats_reset: null },
        tables: [
          makeTableRow({ name: 'big', total_bytes: '1000000' }),
          makeTableRow({ name: 'small', total_bytes: '100' }),
        ],
        indexes: [
          makeIndexRow({ table: 'big', name: 'big_idx', bytes: '500000' }),
          makeIndexRow({ table: 'small', name: 'small_idx', bytes: '50' }),
        ],
      });

      const service = new DbMetricsService();
      const result = await service.snapshot();

      expect(result.tables.map((t) => t.name)).toEqual(['big', 'small']);
      expect(result.indexes.map((i) => i.name)).toEqual(['big_idx', 'small_idx']);
    });

    it('runs four parallel metadata queries per snapshot', async () => {
      queueFixtures({
        databaseInfo: { name: 'db', size_bytes: '1' },
        statsReset: { stats_reset: null },
        tables: [],
        indexes: [],
      });

      const service = new DbMetricsService();
      await service.snapshot();

      expect(mockExecute).toHaveBeenCalledTimes(4);
    });
  });
});
