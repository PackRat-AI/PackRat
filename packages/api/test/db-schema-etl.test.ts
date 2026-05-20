// Schema smoke test for the ETL Workflows columns on etl_jobs and the unique
// index on catalog_item_etl_jobs. Runs against the Docker Postgres wsproxy at
// localhost:5434 (docker-compose.test.yml). If the proxy is down the queries
// throw — intentional; the test would not silently skip schema drift.

import { createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/utils/env-validation';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

type IndexInfo = { indexname: string; indexdef: string };

type ConstraintInfo = { conname: string; pg_get_constraintdef: string };

async function describeColumns(table: string): Promise<ColumnInfo[]> {
  const db = createDbClient({} as Env); // env validated in setup.ts via setWorkerEnv
  const result = (await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `)) as unknown as ColumnInfo[];
  return result;
}

async function describeIndexes(table: string): Promise<IndexInfo[]> {
  const db = createDbClient({} as Env);
  const result = (await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
  `)) as unknown as IndexInfo[];
  return result;
}

async function describeCheckConstraints(table: string): Promise<ConstraintInfo[]> {
  const db = createDbClient({} as Env);
  const result = (await db.execute(sql`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = ${table} AND c.contype = 'c'
  `)) as unknown as ConstraintInfo[];
  return result;
}

describe('Migration 0048 — ETL workflow columns', () => {
  describe('etl_jobs', () => {
    it('has the eight new columns with the expected nullability and defaults', async () => {
      const cols = await describeColumns('etl_jobs');
      const byName = Object.fromEntries(cols.map((c) => [c.column_name, c]));

      expect(byName.workflow_instance_id?.data_type).toBe('text');
      expect(byName.workflow_instance_id?.is_nullable).toBe('YES');

      expect(byName.verified_at?.data_type).toBe('timestamp without time zone');
      expect(byName.verified_at?.is_nullable).toBe('YES');

      expect(byName.verified_row_count?.data_type).toBe('integer');
      expect(byName.verified_row_count?.is_nullable).toBe('YES');

      expect(byName.total_embedding_failures?.data_type).toBe('integer');
      expect(byName.total_embedding_failures?.is_nullable).toBe('NO');
      expect(byName.total_embedding_failures?.column_default).toBe('0');

      expect(byName.superseded_by_job_id?.data_type).toBe('text');
      expect(byName.superseded_by_job_id?.is_nullable).toBe('YES');

      expect(byName.superseded_at?.data_type).toBe('timestamp without time zone');
      expect(byName.superseded_at?.is_nullable).toBe('YES');

      expect(byName.source_etag?.data_type).toBe('text');
      expect(byName.source_etag?.is_nullable).toBe('YES');

      expect(byName.source_last_modified?.data_type).toBe('timestamp without time zone');
      expect(byName.source_last_modified?.is_nullable).toBe('YES');
    });

    it('has the workflow_instance_id and superseded_by_job_id indexes', async () => {
      const indexes = await describeIndexes('etl_jobs');
      const names = new Set(indexes.map((i) => i.indexname));
      expect(names.has('etl_jobs_workflow_instance_id_idx')).toBe(true);
      expect(names.has('etl_jobs_superseded_by_idx')).toBe(true);
    });

    it('enforces the no-self-supersede CHECK constraint', async () => {
      const checks = await describeCheckConstraints('etl_jobs');
      const noSelfSupersede = checks.find((c) => c.conname === 'etl_jobs_no_self_supersede');
      expect(noSelfSupersede).toBeDefined();
      // Constraint definition should reference both columns.
      expect(noSelfSupersede?.pg_get_constraintdef).toMatch(/superseded_by_job_id/);
      expect(noSelfSupersede?.pg_get_constraintdef).toMatch(/<>/);
    });

    it('rejects a row that supersedes itself', async () => {
      const db = createDbClient({} as Env);
      // INSERT a baseline row first.
      await db.execute(sql`
        INSERT INTO etl_jobs (id, status, source, filename, started_at, scraper_revision)
        VALUES ('test-no-self-supersede', 'running', 'test', 'test.csv', now(), 'test-rev')
        ON CONFLICT (id) DO NOTHING
      `);

      let threw = false;
      try {
        await db.execute(sql`
          UPDATE etl_jobs
          SET superseded_by_job_id = id
          WHERE id = 'test-no-self-supersede'
        `);
      } catch (err) {
        threw = true;
        expect(String(err)).toMatch(/etl_jobs_no_self_supersede/);
      }
      expect(threw).toBe(true);

      // Cleanup.
      await db.execute(sql`DELETE FROM etl_jobs WHERE id = 'test-no-self-supersede'`);
    });
  });

  describe('catalog_item_etl_jobs', () => {
    it('has the unique index on (catalog_item_id, etl_job_id)', async () => {
      const indexes = await describeIndexes('catalog_item_etl_jobs');
      const unique = indexes.find((i) => i.indexname === 'catalog_item_etl_jobs_catalog_job_idx');
      expect(unique).toBeDefined();
      expect(unique?.indexdef).toMatch(/UNIQUE/);
      expect(unique?.indexdef).toMatch(/catalog_item_id/);
      expect(unique?.indexdef).toMatch(/etl_job_id/);
    });
  });
});
