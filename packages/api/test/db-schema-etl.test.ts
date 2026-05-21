// Schema smoke test for the ETL Workflows columns on etl_jobs. Runs against
// the Docker Postgres wsproxy at localhost:5434 (docker-compose.test.yml).
// If the proxy is down the queries throw — intentional; the test would not
// silently skip schema drift.

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

async function describeColumns(table: string): Promise<ColumnInfo[]> {
  const db = createDbClient({} as Env);
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

describe('Migration 0047 — ETL workflow columns', () => {
  it('adds workflow_instance_id as nullable text', async () => {
    const cols = await describeColumns('etl_jobs');
    const col = cols.find((c) => c.column_name === 'workflow_instance_id');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('YES');
  });

  it('adds total_embedding_failures as integer NOT NULL DEFAULT 0', async () => {
    const cols = await describeColumns('etl_jobs');
    const col = cols.find((c) => c.column_name === 'total_embedding_failures');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('integer');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toBe('0');
  });

  it('adds the workflow_instance_id index', async () => {
    const indexes = await describeIndexes('etl_jobs');
    const names = new Set(indexes.map((i) => i.indexname));
    expect(names.has('etl_jobs_workflow_instance_id_idx')).toBe(true);
  });
});
