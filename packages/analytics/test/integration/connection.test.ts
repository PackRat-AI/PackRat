/**
 * Integration tests for the connection factory.
 *
 * Tests configureS3 against real R2 and createCatalogConnection against
 * real Iceberg catalog. Each test suite skips if creds are missing.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { configureS3, createCatalogConnection } from '@packrat/analytics/core/connection';
import { nodeEnv } from '@packrat/env/node';
import { describe, expect, it } from 'vitest';

const hasS3Creds = !!nodeEnv.R2_ACCESS_KEY_ID && !!nodeEnv.R2_SECRET_ACCESS_KEY;
const hasCatalogCreds =
  !!nodeEnv.R2_CATALOG_TOKEN && !!nodeEnv.R2_CATALOG_URI && !!nodeEnv.R2_WAREHOUSE_NAME;

describe.skipIf(!hasS3Creds)('configureS3', () => {
  let conn: DuckDBConnection;

  it('configures S3 and can reach R2', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    conn = await instance.connect();

    await configureS3(conn);

    const bucketName = nodeEnv.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME || nodeEnv.R2_BUCKET_NAME;
    if (!bucketName) return;

    // Verify httpfs can list files from R2
    const result = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM glob('s3://${bucketName}/v2/*/*.csv')`,
    );
    const count = Number(result.getRows()[0]?.[0] ?? 0);
    expect(count).toBeGreaterThan(0);
  }, 30_000);
});

describe.skipIf(!hasCatalogCreds)('createCatalogConnection', () => {
  let conn: DuckDBConnection | null = null;

  it('connects to Iceberg catalog and can list tables', async () => {
    const result = await createCatalogConnection();
    conn = result.conn;
    expect(conn).toBeDefined();

    // SHOW TABLES should work after USE packrat.default
    const tables = await conn.runAndReadAll('SHOW TABLES');
    const tableNames = tables.getRows().map((r) => String(r[0]));
    // May be empty if nothing published yet — just ensure no error
    expect(Array.isArray(tableNames)).toBe(true);
  }, 30_000);
});
