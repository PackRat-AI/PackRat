/**
 * Integration tests for local mode — uses the existing local DuckDB cache
 * to run queries against real data. Falls back to building a fresh cache
 * from R2 if none exists (slow, needs S3 creds).
 *
 * Requires: existing data/cache/packrat_cache.duckdb OR R2 credentials.
 * Skips if neither is available.
 */

import { existsSync, rmSync } from 'node:fs';
import { LocalCacheManager } from '@packrat/data-lake/core/local-cache';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DEFAULT_CACHE_DIR = 'data/cache';
const FRESH_CACHE_DIR = 'data/test-integration-cache';
const hasExistingCache = existsSync(`${DEFAULT_CACHE_DIR}/packrat_cache.duckdb`);
const hasS3Creds = !!process.env.R2_ACCESS_KEY_ID && !!process.env.R2_SECRET_ACCESS_KEY;
const canRun = hasExistingCache || hasS3Creds;

describe.skipIf(!canRun)('local mode integration', () => {
  let cache: LocalCacheManager;
  let usedFreshCache = false;

  beforeAll(async () => {
    if (hasExistingCache) {
      // Use existing cache — fast, no network needed
      cache = new LocalCacheManager(DEFAULT_CACHE_DIR);
      await cache.connect();
    } else {
      // Build fresh cache from R2 — slow
      usedFreshCache = true;
      cache = new LocalCacheManager(FRESH_CACHE_DIR);
      await cache.connect();
      await cache.createLocalCache(true);
    }
  }, 300_000);

  afterAll(async () => {
    await cache?.close();
    if (usedFreshCache) {
      rmSync(FRESH_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('has records in cache', () => {
    const stats = cache.getCacheStats();
    expect(stats.recordCount).toBeGreaterThan(0);
    expect(stats.sites.length).toBeGreaterThan(0);
    expect(stats.updatedAt).toBeDefined();
  });

  it('search returns results for broad keyword', async () => {
    const results = await cache.search('jacket', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('price');
    expect(results[0]).toHaveProperty('site');
  });

  it('comparePrices returns site-level aggregates', async () => {
    const results = await cache.comparePrices('tent');
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('site');
      expect(results[0]).toHaveProperty('avg_price');
      expect(results[0]).toHaveProperty('min_price');
      expect(results[0]).toHaveProperty('max_price');
    }
  });

  it('getSiteStats returns per-site breakdown', async () => {
    const stats = await cache.getSiteStats();
    expect(stats.length).toBeGreaterThan(0);
    const first = stats[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(first).toHaveProperty('site');
    expect(first).toHaveProperty('items');
    expect(first).toHaveProperty('brands');
    expect(Number(first.items)).toBeGreaterThan(0);
  });

  it('getMarketSummary returns aggregates', async () => {
    const summary = await cache.getMarketSummary();
    expect(summary.totalItems).toBeGreaterThan(0);
    expect(summary.totalSites).toBeGreaterThan(0);
    expect(summary.totalBrands).toBeGreaterThan(0);
    expect(summary.avgPrice).toBeGreaterThan(0);
  });

  it('getTopBrands returns brand rankings', async () => {
    const brands = await cache.getTopBrands(5);
    expect(brands.length).toBeGreaterThan(0);
    const first = brands[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(first).toHaveProperty('brand');
    expect(first).toHaveProperty('product_count');
    expect(Number(first.product_count)).toBeGreaterThan(0);
  });

  it('getPriceDistribution returns bucketed counts', async () => {
    const dist = await cache.getPriceDistribution();
    expect(dist.length).toBeGreaterThan(0);
    expect(dist[0]).toHaveProperty('bucket');
    expect(dist[0]).toHaveProperty('count');
  });

  it('findDeals returns items under price threshold', async () => {
    const deals = await cache.findDeals(50, { limit: 5 });
    expect(deals.length).toBeGreaterThan(0);
    for (const deal of deals) {
      expect(Number(deal.price)).toBeLessThanOrEqual(50);
      expect(Number(deal.price)).toBeGreaterThan(0);
    }
  });

  it('search with site filter narrows results', async () => {
    const stats = cache.getCacheStats();
    if (stats.sites.length === 0) return;

    const site = stats.sites[0];
    if (site === undefined) return;
    const results = await cache.search('gear', { sites: [site], limit: 10 });
    for (const r of results) {
      expect(r.site).toBe(site);
    }
  });

  it('analyzeBrand returns category breakdown', async () => {
    const brands = await cache.getTopBrands(1);
    if (brands.length === 0) return;

    const firstBrand = brands[0];
    if (firstBrand === undefined) return;
    const analysis = await cache.analyzeBrand(firstBrand.brand);
    if (analysis.length > 0) {
      expect(analysis[0]).toHaveProperty('site');
      expect(analysis[0]).toHaveProperty('category');
      expect(analysis[0]).toHaveProperty('product_count');
    }
  });

  it('categoryInsights returns category-level stats', async () => {
    const results = await cache.categoryInsights('tent');
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('site');
      expect(results[0]).toHaveProperty('product_count');
      expect(results[0]).toHaveProperty('brand_count');
    }
  });

  it('getMarketShare returns brand share data', async () => {
    const share = await cache.getMarketShare({ topN: 5 });
    expect(share.length).toBeGreaterThan(0);
    expect(share[0]).toHaveProperty('brand');
    expect(share[0]).toHaveProperty('product_count');
    expect(share[0]).toHaveProperty('revenue_share');
  });

  it('getConnection returns a live connection', () => {
    const conn = cache.getConnection();
    expect(conn).toBeDefined();
  });
});
