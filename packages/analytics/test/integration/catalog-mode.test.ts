/**
 * Integration tests for catalog mode — connects to R2 Data Catalog (Iceberg).
 *
 * Requires: R2_CATALOG_TOKEN, R2_CATALOG_URI, R2_WAREHOUSE_NAME in .env
 * Skips if credentials are missing.
 *
 * These tests verify the Iceberg ATTACH/USE flow and that CatalogCacheManager
 * can run the same queries as LocalCacheManager against catalog tables.
 */

import { CatalogCacheManager } from '@packrat/analytics/core/catalog-cache';
import { nodeEnv } from '@packrat/env/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const hasCatalogCreds =
  !!nodeEnv.R2_CATALOG_TOKEN && !!nodeEnv.R2_CATALOG_URI && !!nodeEnv.R2_WAREHOUSE_NAME;

describe.skipIf(!hasCatalogCreds)('catalog mode integration', () => {
  let cache: CatalogCacheManager;

  beforeAll(async () => {
    cache = new CatalogCacheManager();
    await cache.connect();
  }, 30_000);

  afterAll(async () => {
    await cache.close();
  });

  it('connects to Iceberg catalog', () => {
    const conn = cache.getConnection();
    expect(conn).toBeDefined();
  });

  it('getLiveStats returns record count and sites', async () => {
    const stats = await cache.getLiveStats();
    expect(stats.recordCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.sites)).toBe(true);
  });

  it('createLocalCache is a no-op', async () => {
    // Should not throw — just prints an info message
    await expect(cache.createLocalCache()).resolves.not.toThrow();
  });

  // The following tests only run if data has been published to the catalog
  it('search returns results if data exists', async () => {
    const stats = await cache.getLiveStats();
    if (stats.recordCount === 0) return; // No data published yet

    const results = await cache.search('jacket', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('price');
  });

  it('getSiteStats works against Iceberg tables', async () => {
    const stats = await cache.getLiveStats();
    if (stats.recordCount === 0) return;

    const siteStats = await cache.getSiteStats();
    expect(siteStats.length).toBeGreaterThan(0);
    expect(siteStats[0]).toHaveProperty('site');
    expect(siteStats[0]).toHaveProperty('items');
  });

  it('getMarketSummary works against Iceberg tables', async () => {
    const stats = await cache.getLiveStats();
    if (stats.recordCount === 0) return;

    const summary = await cache.getMarketSummary();
    expect(summary.totalItems).toBeGreaterThan(0);
    expect(summary.totalSites).toBeGreaterThan(0);
  });

  it('getTopBrands works against Iceberg tables', async () => {
    const stats = await cache.getLiveStats();
    if (stats.recordCount === 0) return;

    const brands = await cache.getTopBrands(5);
    expect(brands.length).toBeGreaterThan(0);
    expect(brands[0]).toHaveProperty('brand');
  });
});
