/**
 * Connection factory for PackRat analytics.
 *
 * Provides shared S3 credential setup and an Iceberg catalog connection
 * builder. The local DuckDB file connection remains in LocalCacheManager.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { DBConfig } from './constants';
import { analyticsEnv as env } from '@packrat/env/analytics';

/** Configure S3/R2 credentials on a DuckDB connection. */
export async function configureS3(conn: DuckDBConnection): Promise<void> {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL } = env();

  await conn.run('INSTALL httpfs; LOAD httpfs;');

  const endpoint = R2_ENDPOINT_URL.replace('https://', '');
  await conn.run(`
    SET s3_region='auto';
    SET s3_endpoint='${endpoint}';
    SET s3_access_key_id='${R2_ACCESS_KEY_ID}';
    SET s3_secret_access_key='${R2_SECRET_ACCESS_KEY}';
    SET s3_use_ssl=true;
    SET http_timeout=${DBConfig.HTTP_TIMEOUT};
  `);
}

/**
 * Create a DuckDB connection ATTACHed to the R2 Data Catalog (Iceberg).
 *
 * After this call, `USE packrat.default` has been run so unqualified
 * table names (gear_data, price_history) resolve to Iceberg tables.
 */
export async function createCatalogConnection(): Promise<{
  instance: DuckDBInstance;
  conn: DuckDBConnection;
}> {
  const { R2_CATALOG_TOKEN, R2_CATALOG_URI, R2_WAREHOUSE_NAME } = env();

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  await conn.run(`
    SET memory_limit='${DBConfig.MEMORY_LIMIT}';
    SET threads=${DBConfig.THREAD_COUNT};
  `);

  // httpfs must be loaded before ATTACH ICEBERG
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run('INSTALL iceberg; LOAD iceberg;');

  await conn.run(`CREATE SECRET r2_iceberg (
    TYPE ICEBERG,
    TOKEN '${R2_CATALOG_TOKEN}'
  )`);

  await conn.run(`ATTACH '${R2_WAREHOUSE_NAME}' AS packrat (
    TYPE ICEBERG,
    ENDPOINT '${R2_CATALOG_URI}',
    SECRET r2_iceberg
  )`);

  // Set default search path so unqualified table names resolve to Iceberg
  await conn.run('USE packrat.default');

  return { instance, conn };
}
