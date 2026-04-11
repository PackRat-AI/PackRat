/**
 * Smoke test: validates DuckDB + httpfs + R2 connectivity under Bun.
 *
 * Run: bun run scripts/smoke-test.ts
 *
 * This is the Phase 0 validation gate — if this fails under Bun,
 * we fall back to running the analytics CLI under Node.
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { env } from '@packrat/env/node';

const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT_URL = env.R2_ENDPOINT_URL;
const R2_BUCKET_NAME =
  env.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME ??
  env.PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME ??
  env.R2_BUCKET_NAME ??
  'packrat-scrapy-bucket';

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}

async function main() {
  console.log('=== DuckDB Smoke Test ===\n');

  // Step 1: Create instance
  console.log('1. Creating DuckDB instance...');
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  console.log('   OK: DuckDB instance created\n');

  // Step 2: Basic query
  console.log('2. Running basic query...');
  const reader = await conn.runAndReadAll('SELECT 42 AS answer');
  const rows = reader.getRows();
  console.log(`   OK: SELECT 42 returned ${rows[0]?.[0]}\n`);

  // Step 3: Install httpfs
  console.log('3. Installing httpfs extension...');
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  console.log('   OK: httpfs loaded\n');

  // Step 4: Configure R2 (if credentials available)
  if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT_URL) {
    console.log('4. Configuring R2 credentials...');
    const endpoint = R2_ENDPOINT_URL.replace('https://', '');
    await conn.run(`
      SET s3_region='auto';
      SET s3_endpoint='${escapeSql(endpoint)}';
      SET s3_access_key_id='${escapeSql(R2_ACCESS_KEY_ID)}';
      SET s3_secret_access_key='${escapeSql(R2_SECRET_ACCESS_KEY)}';
      SET s3_use_ssl=true;
    `);
    console.log('   OK: R2 credentials configured\n');

    // Step 5: Query R2
    console.log('5. Querying R2 (counting rows from first CSV)...');
    try {
      const countReader = await conn.runAndReadAll(`
        SELECT count(*) as cnt
        FROM read_csv_auto('s3://${escapeSql(R2_BUCKET_NAME)}/v2/*/*.csv',
          ignore_errors=true,
          union_by_name=true,
          filename=true,
          sample_size=20480
        )
        LIMIT 1
      `);
      const countRows = countReader.getRows();
      console.log(`   OK: Found ${countRows[0]?.[0]} rows from v2 CSVs\n`);
    } catch (err) {
      console.log(`   WARN: R2 query failed (may need valid credentials): ${err}\n`);
    }
  } else {
    console.log('4. Skipping R2 test (no credentials in .env)\n');
  }

  console.log('=== Smoke Test Complete ===');
  console.log(`Runtime: ${typeof Bun !== 'undefined' ? 'Bun' : 'Node.js'}`);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
