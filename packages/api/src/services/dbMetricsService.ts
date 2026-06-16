import { createReadOnlyDb } from '@packrat/api/db';
import { sql } from 'drizzle-orm';

/**
 * Read-only cost/infra metrics service.
 *
 * Surfaces the SAME metrics from `docs/runbooks/neon-cost-profiling.md` so
 * admins can monitor per-table sizing, activity, and index utilization
 * without running Neon MCP / SQL editor by hand. Queries are pure metadata
 * (pg_class, pg_stat_*, pg_size_pretty) — no row scans, fast, safe to poll.
 *
 * Cost + safety discipline:
 * - Uses the read-only Neon URL (`createReadOnlyDb()`). Defense in depth:
 *   even a future bug that introduces a write here would be rejected at
 *   the DB role level rather than silently mutating production.
 * - No `SELECT *` against user tables (would defeat the projection work)
 * - All queries return small, fixed-size result sets — total runtime stays
 *   well under Neon's 30s HTTP timeout for typical schemas. No explicit
 *   statement_timeout wrapper applied.
 */

export interface TableMetrics {
  name: string;
  estimatedRows: number;
  heapBytes: number;
  toastBytes: number;
  indexBytes: number;
  totalBytes: number;
  // pg_stat_user_tables — cumulative since last reset (lifetime if never reset)
  seqScans: number;
  seqTuplesRead: number;
  idxScans: number;
  idxTuplesFetched: number;
  inserts: number;
  updates: number;
  deletes: number;
  hotUpdates: number;
  liveTuples: number;
  deadTuples: number;
  lastAutovacuum: string | null;
  lastAutoanalyze: string | null;
}

export interface IndexMetrics {
  table: string;
  name: string;
  bytes: number;
  isUnique: boolean;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
}

export interface DbMetricsSnapshot {
  generatedAt: string;
  statsResetAt: string | null;
  database: {
    name: string;
    sizeBytes: number;
  };
  tables: TableMetrics[];
  indexes: IndexMetrics[];
}

export class DbMetricsService {
  private db: ReturnType<typeof createReadOnlyDb>;

  constructor() {
    this.db = createReadOnlyDb();
  }

  async snapshot(): Promise<DbMetricsSnapshot> {
    // Run all four queries in parallel — each is independent metadata-only.
    const [databaseRow, tableRows, indexRows, statsResetRow] = await Promise.all([
      this.fetchDatabaseInfo(),
      this.fetchTables(),
      this.fetchIndexes(),
      this.fetchStatsResetAt(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      statsResetAt: statsResetRow,
      database: databaseRow,
      tables: tableRows,
      indexes: indexRows,
    };
  }

  private async fetchDatabaseInfo(): Promise<{ name: string; sizeBytes: number }> {
    const rows = await this.db
      .tag('dbMetrics.fetchDatabaseInfo')
      .execute<{ name: string; size_bytes: string }>(sql`
      SELECT
        current_database() AS name,
        pg_database_size(current_database())::text AS size_bytes
    `);
    const row = rows.rows[0];
    return {
      name: row?.name ?? 'unknown',
      sizeBytes: Number(row?.size_bytes ?? 0),
    };
  }

  private async fetchStatsResetAt(): Promise<string | null> {
    const rows = await this.db
      .tag('dbMetrics.fetchStatsResetAt')
      .execute<{ stats_reset: string | null }>(sql`
      SELECT stats_reset::text AS stats_reset
      FROM pg_stat_database
      WHERE datname = current_database()
    `);
    return rows.rows[0]?.stats_reset ?? null;
  }

  private async fetchTables(): Promise<TableMetrics[]> {
    const rows = await this.db.tag('dbMetrics.fetchTables').execute<{
      name: string;
      est_rows: string;
      heap_bytes: string;
      toast_bytes: string;
      index_bytes: string;
      total_bytes: string;
      seq_scan: string;
      seq_tup_read: string;
      idx_scan: string | null;
      idx_tup_fetch: string | null;
      n_tup_ins: string;
      n_tup_upd: string;
      n_tup_del: string;
      n_tup_hot_upd: string;
      n_live_tup: string;
      n_dead_tup: string;
      last_autovacuum: string | null;
      last_autoanalyze: string | null;
    }>(sql`
      SELECT
        c.relname                                         AS name,
        c.reltuples::bigint::text                         AS est_rows,
        pg_relation_size(c.oid)::text                     AS heap_bytes,
        -- Many tables (small ones, or those with no TOAST'able columns) have
        -- reltoastrelid = 0. pg_relation_size(0) raises 'invalid relation OID',
        -- and COALESCE evaluates AFTER the function call, so the error wins.
        -- CASE short-circuits the call.
        CASE
          WHEN c.reltoastrelid = 0 THEN '0'
          ELSE pg_relation_size(c.reltoastrelid)::text
        END                                               AS toast_bytes,
        pg_indexes_size(c.oid)::text                      AS index_bytes,
        pg_total_relation_size(c.oid)::text               AS total_bytes,
        COALESCE(s.seq_scan, 0)::text                     AS seq_scan,
        COALESCE(s.seq_tup_read, 0)::text                 AS seq_tup_read,
        s.idx_scan::text                                  AS idx_scan,
        s.idx_tup_fetch::text                             AS idx_tup_fetch,
        COALESCE(s.n_tup_ins, 0)::text                    AS n_tup_ins,
        COALESCE(s.n_tup_upd, 0)::text                    AS n_tup_upd,
        COALESCE(s.n_tup_del, 0)::text                    AS n_tup_del,
        COALESCE(s.n_tup_hot_upd, 0)::text                AS n_tup_hot_upd,
        COALESCE(s.n_live_tup, 0)::text                   AS n_live_tup,
        COALESCE(s.n_dead_tup, 0)::text                   AS n_dead_tup,
        s.last_autovacuum::text                           AS last_autovacuum,
        s.last_autoanalyze::text                          AS last_autoanalyze
      FROM pg_class c
      JOIN pg_namespace n  ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);

    return rows.rows.map((r) => ({
      name: r.name,
      estimatedRows: Number(r.est_rows),
      heapBytes: Number(r.heap_bytes),
      toastBytes: Number(r.toast_bytes),
      indexBytes: Number(r.index_bytes),
      totalBytes: Number(r.total_bytes),
      seqScans: Number(r.seq_scan),
      seqTuplesRead: Number(r.seq_tup_read),
      idxScans: Number(r.idx_scan ?? 0),
      idxTuplesFetched: Number(r.idx_tup_fetch ?? 0),
      inserts: Number(r.n_tup_ins),
      updates: Number(r.n_tup_upd),
      deletes: Number(r.n_tup_del),
      hotUpdates: Number(r.n_tup_hot_upd),
      liveTuples: Number(r.n_live_tup),
      deadTuples: Number(r.n_dead_tup),
      lastAutovacuum: r.last_autovacuum,
      lastAutoanalyze: r.last_autoanalyze,
    }));
  }

  private async fetchIndexes(): Promise<IndexMetrics[]> {
    const rows = await this.db.tag('dbMetrics.fetchIndexes').execute<{
      table: string;
      name: string;
      bytes: string;
      is_unique: boolean;
      idx_scan: string;
      idx_tup_read: string;
      idx_tup_fetch: string;
    }>(sql`
      SELECT
        s.relname                            AS "table",
        s.indexrelname                       AS name,
        pg_relation_size(s.indexrelid)::text AS bytes,
        i.indisunique                        AS is_unique,
        COALESCE(s.idx_scan, 0)::text        AS idx_scan,
        COALESCE(s.idx_tup_read, 0)::text    AS idx_tup_read,
        COALESCE(s.idx_tup_fetch, 0)::text   AS idx_tup_fetch
      FROM pg_stat_user_indexes s
      JOIN pg_index i ON i.indexrelid = s.indexrelid
      ORDER BY pg_relation_size(s.indexrelid) DESC
    `);

    return rows.rows.map((r) => ({
      table: r.table,
      name: r.name,
      bytes: Number(r.bytes),
      isUnique: r.is_unique,
      scans: Number(r.idx_scan),
      tuplesRead: Number(r.idx_tup_read),
      tuplesFetched: Number(r.idx_tup_fetch),
    }));
  }
}
