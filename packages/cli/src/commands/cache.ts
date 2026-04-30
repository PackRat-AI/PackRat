import {
  CatalogCacheManager,
  configureS3,
  createCatalogConnection,
  dbPath,
  env,
  LocalCacheManager,
  QueryBuilder,
} from '@packrat/analytics';
import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, getCache, printSummary } from '../shared';

export default defineCommand({
  meta: { name: 'cache', description: 'Manage local data cache and R2 Data Catalog' },
  args: {
    refresh: {
      type: 'boolean',
      alias: 'r',
      description: 'Force refresh from R2 CSVs (local mode)',
    },
    publish: {
      type: 'boolean',
      alias: 'p',
      description: 'Publish local cache to R2 Data Catalog (Iceberg)',
    },
    ingest: {
      type: 'boolean',
      description: 'Ingest R2 CSVs directly into Iceberg (skips local cache)',
    },
  },
  async run({ args }) {
    if (args.publish) {
      await publishToCatalog();
    } else if (args.ingest) {
      await ingestToCatalog();
    } else if (args.refresh) {
      if (env().ANALYTICS_MODE === 'catalog') {
        consola.info(
          'Catalog mode: data is managed in R2 Data Catalog. Use --publish to update from local cache.',
        );
        return;
      }
      await ensureCache(true);
    } else {
      await showStatus();
    }
  },
});

async function showStatus(): Promise<void> {
  const mode = env().ANALYTICS_MODE;

  if (mode === 'catalog') {
    const cache = await getCache();
    if (!(cache instanceof CatalogCacheManager)) {
      consola.error('Expected CatalogCacheManager in catalog mode.');
      return;
    }
    consola.start('Fetching catalog stats...');
    const stats = await cache.getLiveStats();
    printSummary(
      {
        Mode: 'catalog (R2 Data Catalog / Iceberg)',
        Records: stats.recordCount.toLocaleString(),
        Sites: stats.sites.join(', ') || '(none)',
      },
      'Cache Status',
    );
  } else {
    const cache = await getCache();
    const stats = cache.getCacheStats();
    if (stats.recordCount === 0) {
      consola.info('Cache is empty. Run with --refresh to populate.');
    } else {
      printSummary(
        {
          Mode: 'local (DuckDB file)',
          Records: stats.recordCount.toLocaleString(),
          Sites: stats.sites.join(', '),
          'Last Updated': stats.updatedAt ?? 'Never',
        },
        'Cache Status',
      );
    }
  }
}

/**
 * Publish local DuckDB cache → R2 Data Catalog (Iceberg).
 * Requires both S3 creds (to read local cache) and Iceberg creds.
 */
async function publishToCatalog(): Promise<void> {
  const { R2_CATALOG_TOKEN, R2_CATALOG_URI, R2_WAREHOUSE_NAME } = env();

  if (!R2_CATALOG_TOKEN || !R2_CATALOG_URI || !R2_WAREHOUSE_NAME) {
    consola.error(
      'Publishing requires Iceberg credentials: R2_CATALOG_TOKEN, R2_CATALOG_URI, R2_WAREHOUSE_NAME',
    );
    return;
  }

  // Ensure local cache is populated
  consola.start('Opening local cache...');
  const localCache = await getCache();
  const localStats = localCache.getCacheStats();
  if (localStats.recordCount === 0) {
    consola.error('Local cache is empty. Run --refresh first.');
    return;
  }
  consola.info(
    `Local cache: ${localStats.recordCount.toLocaleString()} records from ${localStats.sites.length} sites`,
  );

  // Create Iceberg connection
  consola.start('Connecting to R2 Data Catalog...');
  const { conn: iceConn } = await createCatalogConnection();

  // Attach local DuckDB file as a second database
  const localDbPath = dbPath(new LocalCacheManager().cacheDir);
  await iceConn.run(`ATTACH '${localDbPath}' AS local_gear (READ_ONLY)`);

  // Publish gear_data
  consola.start('Publishing gear_data to Iceberg...');
  await iceConn.run('DROP TABLE IF EXISTS gear_data');
  await iceConn.run('CREATE TABLE gear_data AS SELECT * FROM local_gear.gear_data');
  const gearCount = await iceConn.runAndReadAll('SELECT COUNT(*) FROM gear_data');
  consola.success(
    `gear_data: ${Number(gearCount.getRows()[0]?.[0] ?? 0).toLocaleString()} rows published`,
  );

  // Publish price_history
  consola.start('Publishing price_history to Iceberg...');
  await iceConn.run('DROP TABLE IF EXISTS price_history');
  await iceConn.run('CREATE TABLE price_history AS SELECT * FROM local_gear.price_history');
  const phCount = await iceConn.runAndReadAll('SELECT COUNT(*) FROM price_history');
  consola.success(
    `price_history: ${Number(phCount.getRows()[0]?.[0] ?? 0).toLocaleString()} rows published`,
  );

  consola.success('Publish complete! Data is now queryable via ANALYTICS_MODE=catalog');
}

/**
 * Ingest R2 CSVs directly into Iceberg (bypass local cache).
 * Requires both S3 + Iceberg credentials.
 */
async function ingestToCatalog(): Promise<void> {
  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_CATALOG_TOKEN,
    R2_CATALOG_URI,
    R2_WAREHOUSE_NAME,
  } = env();

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    consola.error('Ingest requires S3 credentials: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    return;
  }
  if (!R2_CATALOG_TOKEN || !R2_CATALOG_URI || !R2_WAREHOUSE_NAME) {
    consola.error(
      'Ingest requires Iceberg credentials: R2_CATALOG_TOKEN, R2_CATALOG_URI, R2_WAREHOUSE_NAME',
    );
    return;
  }

  // Create Iceberg connection
  consola.start('Connecting to R2 Data Catalog...');
  const { conn: iceConn } = await createCatalogConnection();

  // Also configure S3 on this connection for CSV reads
  await configureS3(iceConn);

  // Use the QueryBuilder to generate the same CSV→table SQL as local cache
  const qb = new QueryBuilder(`s3://${env().R2_BUCKET_NAME}`);

  consola.start('Ingesting gear_data from R2 CSVs → Iceberg...');
  await iceConn.run('DROP TABLE IF EXISTS gear_data');
  await iceConn.run(qb.createCacheTable('gear_data'));
  const gearCount = await iceConn.runAndReadAll('SELECT COUNT(*) FROM gear_data');
  consola.success(
    `gear_data: ${Number(gearCount.getRows()[0]?.[0] ?? 0).toLocaleString()} rows ingested`,
  );

  consola.start('Ingesting price_history from R2 CSVs → Iceberg...');
  await iceConn.run('DROP TABLE IF EXISTS price_history');
  await iceConn.run(qb.createPriceHistoryTable('price_history'));
  const phCount = await iceConn.runAndReadAll('SELECT COUNT(*) FROM price_history');
  consola.success(
    `price_history: ${Number(phCount.getRows()[0]?.[0] ?? 0).toLocaleString()} rows ingested`,
  );

  consola.success('Ingest complete! Data is now queryable via ANALYTICS_MODE=catalog');
}
