/**
 * Catalog-backed cache manager for PackRat analytics.
 *
 * Extends LocalCacheManager to query R2 Data Catalog (Iceberg) tables
 * instead of a local DuckDB file. All domain query methods (search,
 * comparePrices, etc.) are inherited unchanged — they query `gear_data`
 * which resolves to the Iceberg table via `USE packrat.default`.
 */

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import consola from 'consola';
import { createCatalogConnection } from './connection';
import { LocalCacheManager } from './local-cache';

export class CatalogCacheManager extends LocalCacheManager {
  private catalogInstance: DuckDBInstance | null = null;
  private catalogConn: DuckDBConnection | null = null;

  constructor() {
    // Pass a dummy cacheDir — we won't use the local file system
    super('data/cache');
  }

  override async connect(): Promise<DuckDBConnection> {
    if (this.catalogConn) return this.catalogConn;

    consola.start('Connecting to R2 Data Catalog (Iceberg)...');
    const { instance, conn } = await createCatalogConnection();
    this.catalogInstance = instance;
    this.catalogConn = conn;
    consola.success('Connected to R2 Data Catalog');

    return conn;
  }

  override async close(): Promise<void> {
    this.catalogConn = null;
    this.catalogInstance = null;
  }

  override getConnection(): DuckDBConnection {
    if (!this.catalogConn) throw new Error('Not connected. Call connect() first.');
    return this.catalogConn;
  }

  /** No-op for catalog mode — data lives in Iceberg, not a local file. */
  override async createLocalCache(_forceRefresh = false): Promise<void> {
    consola.info('Catalog mode: data is managed in R2 Data Catalog. Use --publish to update.');
  }

  override getCacheStats(): {
    recordCount: number;
    sites: string[];
    updatedAt: string | undefined;
  } {
    // Stats are fetched live from the catalog on demand
    return { recordCount: -1, sites: [], updatedAt: undefined };
  }

  /** Fetch live stats from the Iceberg catalog tables. */
  async getLiveStats(): Promise<{
    recordCount: number;
    sites: string[];
  }> {
    const conn = this.getConnection();

    const countResult = await conn.runAndReadAll('SELECT COUNT(*) FROM gear_data');
    const recordCount = Number(countResult.getRows()[0]?.[0] ?? 0);

    const sitesResult = await conn.runAndReadAll(
      'SELECT DISTINCT site FROM gear_data ORDER BY site',
    );
    const sites = sitesResult.getRows().map((r) => String(r[0]));

    return { recordCount, sites };
  }
}
