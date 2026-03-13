/**
 * Local DuckDB cache manager for PackRat analytics.
 *
 * Downloads R2 CSV data into a persistent local DuckDB file for
 * sub-second queries. Ported from Python local_cache.py.
 */

import { mkdirSync } from 'node:fs';
import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { tryit } from 'radash';
import type {
  BrandAnalysis,
  CatalogRow,
  CategoryInsights,
  PriceComparison,
  PriceTrend,
  SiteStats,
} from '../types';
import {
  type CacheMetadataFile,
  dbPath,
  loadMetadata,
  needsUpdate,
  saveMetadata,
  schemaIsCurrent,
} from './cache-metadata';
import { DBConfig } from './constants';
import { R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_ENDPOINT_URL, R2_SECRET_ACCESS_KEY } from './env';
import { QueryBuilder, SQLFragments } from './query-builder';

const TABLE_NAME = 'gear_data';
const PRICE_HISTORY_TABLE = 'price_history';

export class LocalCacheManager {
  private instance: DuckDBInstance | null = null;
  private conn: DuckDBConnection | null = null;
  private metadata: CacheMetadataFile | null = null;
  readonly cacheDir: string;
  readonly queryBuilder: QueryBuilder;

  constructor(cacheDir = 'data/cache') {
    this.cacheDir = cacheDir;
    this.queryBuilder = new QueryBuilder(`s3://${R2_BUCKET_NAME}`);
  }

  // ── Connection ──────────────────────────────────────────────────────

  async connect(): Promise<DuckDBConnection> {
    if (this.conn) return this.conn;

    mkdirSync(this.cacheDir, { recursive: true });
    this.instance = await DuckDBInstance.create(dbPath(this.cacheDir));
    this.conn = await this.instance.connect();

    await this.conn.run(
      `SET memory_limit='${DBConfig.MEMORY_LIMIT}'; SET threads=${DBConfig.THREAD_COUNT};`,
    );

    this.metadata = loadMetadata(this.cacheDir);
    return this.conn;
  }

  async close(): Promise<void> {
    this.conn = null;
    this.instance = null;
  }

  private getConn(): DuckDBConnection {
    if (!this.conn) throw new Error('Not connected. Call connect() first.');
    return this.conn;
  }

  /** Public accessor for DuckDB connection (used by SpecParser, etc). */
  getConnection(): DuckDBConnection {
    return this.getConn();
  }

  // ── Cache Lifecycle ─────────────────────────────────────────────────

  async createLocalCache(forceRefresh = false): Promise<void> {
    const conn = this.getConn();

    if (
      !forceRefresh &&
      this.metadata &&
      !needsUpdate(this.metadata) &&
      schemaIsCurrent(this.metadata)
    ) {
      return;
    }

    // Install httpfs for R2 access
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

    // Drop and rebuild tables
    await conn.run(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
    await conn.run(`DROP TABLE IF EXISTS ${PRICE_HISTORY_TABLE}`);

    await conn.run(this.queryBuilder.createCacheTable(TABLE_NAME));
    await conn.run(this.queryBuilder.createPriceHistoryTable(PRICE_HISTORY_TABLE));

    // Create indexes for fast queries
    await conn.run(`CREATE INDEX IF NOT EXISTS idx_site ON ${TABLE_NAME}(site)`);
    await conn.run(`CREATE INDEX IF NOT EXISTS idx_brand ON ${TABLE_NAME}(brand)`);
    await conn.run(`CREATE INDEX IF NOT EXISTS idx_category ON ${TABLE_NAME}(category)`);
    await conn.run(`CREATE INDEX IF NOT EXISTS idx_price ON ${TABLE_NAME}(price)`);
    await conn.run(
      `CREATE INDEX IF NOT EXISTS idx_ph_name ON ${PRICE_HISTORY_TABLE}(name, scrape_date)`,
    );

    // Save metadata
    const countResult = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM ${TABLE_NAME}`);
    const recordCount = Number(countResult.getRows()[0]?.[0] ?? 0);

    const sitesResult = await conn.runAndReadAll(
      `SELECT DISTINCT site FROM ${TABLE_NAME} ORDER BY site`,
    );
    const sites = sitesResult.getRows().map((r) => String(r[0]));

    const now = new Date().toISOString();
    saveMetadata(this.cacheDir, {
      version: DBConfig.CACHE_VERSION,
      schema_version: DBConfig.SCHEMA_VERSION,
      created_at: this.metadata?.created_at ?? now,
      updated_at: now,
      record_count: recordCount,
      sites,
    });
    this.metadata = loadMetadata(this.cacheDir);
  }

  getCacheStats(): { recordCount: number; sites: string[]; updatedAt: string | undefined } {
    return {
      recordCount: this.metadata?.record_count ?? 0,
      sites: this.metadata?.sites ?? [],
      updatedAt: this.metadata?.updated_at,
    };
  }

  // ── Query Helpers ───────────────────────────────────────────────────

  private async query<T>(sql: string): Promise<T[]> {
    const conn = this.getConn();
    const result = await conn.runAndReadAll(sql);
    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return obj as T;
    });
  }

  // ── Search ──────────────────────────────────────────────────────────

  async search(
    keyword: string,
    options: { sites?: string[]; minPrice?: number; maxPrice?: number; limit?: number } = {},
  ): Promise<CatalogRow[]> {
    const { sites, minPrice, maxPrice, limit = DBConfig.DEFAULT_LIMIT } = options;
    const kw = SQLFragments.escapeSql(keyword.toLowerCase());

    const conditions = [
      `(LOWER(name) LIKE '%${kw}%' OR LOWER(brand) LIKE '%${kw}%' OR LOWER(category) LIKE '%${kw}%' OR LOWER(description) LIKE '%${kw}%')`,
    ];

    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }
    if (minPrice !== undefined) conditions.push(`price >= ${minPrice}`);
    if (maxPrice !== undefined) conditions.push(`price <= ${maxPrice}`);

    return this.query<CatalogRow>(`
      SELECT * FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      ORDER BY price ASC
      LIMIT ${limit}
    `);
  }

  // ── Price Comparison ────────────────────────────────────────────────

  async comparePrices(keyword: string, sites?: string[]): Promise<PriceComparison[]> {
    const kw = SQLFragments.escapeSql(keyword.toLowerCase());

    const conditions = [`(LOWER(name) LIKE '%${kw}%' OR LOWER(brand) LIKE '%${kw}%')`];
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query<PriceComparison>(`
      SELECT
        site,
        COUNT(*) as item_count,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
        ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      GROUP BY site
      HAVING COUNT(*) >= ${DBConfig.MIN_GROUP_COUNT}
      ORDER BY avg_price ASC
    `);
  }

  // ── Brand Analysis ──────────────────────────────────────────────────

  async analyzeBrand(brandName: string, sites?: string[]): Promise<BrandAnalysis[]> {
    const brand = SQLFragments.escapeSql(brandName.toLowerCase());

    const conditions = [`LOWER(brand) LIKE '%${brand}%'`];
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query<BrandAnalysis>(`
      SELECT
        site,
        category,
        COUNT(*) as product_count,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
        ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      GROUP BY site, category
      HAVING COUNT(*) >= 2
      ORDER BY product_count DESC
    `);
  }

  // ── Category Insights ───────────────────────────────────────────────

  async categoryInsights(categoryKeyword: string, sites?: string[]): Promise<CategoryInsights[]> {
    const cat = SQLFragments.escapeSql(categoryKeyword.toLowerCase());

    const conditions = [`LOWER(category) LIKE '%${cat}%'`];
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query<CategoryInsights>(`
      SELECT
        site,
        COUNT(*) as product_count,
        COUNT(DISTINCT brand) as brand_count,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
        ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      GROUP BY site
      HAVING COUNT(*) >= ${DBConfig.MIN_CATEGORY_COUNT}
      ORDER BY product_count DESC
    `);
  }

  // ── Deals ───────────────────────────────────────────────────────────

  async findDeals(
    maxPrice: number,
    options: { category?: string; sites?: string[]; limit?: number } = {},
  ): Promise<CatalogRow[]> {
    const { category, sites, limit = DBConfig.DEFAULT_LIMIT } = options;

    const conditions = [`price <= ${maxPrice}`, `price > 0`];
    if (category) {
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    }
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query<CatalogRow>(`
      SELECT * FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      ORDER BY price ASC
      LIMIT ${limit}
    `);
  }

  // ── Trends ──────────────────────────────────────────────────────────

  async searchTrends(
    keyword: string,
    options: { site?: string; days?: number; limit?: number } = {},
  ): Promise<PriceTrend[]> {
    const { site, days = 90 } = options;
    const kw = SQLFragments.escapeSql(keyword.toLowerCase());

    const conditions = [
      `(LOWER(name) LIKE '%${kw}%' OR LOWER(brand) LIKE '%${kw}%')`,
      `TRY_CAST(scrape_date AS DATE) >= CURRENT_DATE - INTERVAL '${days} days'`,
    ];
    if (site) {
      conditions.push(`site = '${SQLFragments.escapeSql(site)}'`);
    }

    return this.query<PriceTrend>(`
      SELECT
        scrape_date,
        site,
        name,
        brand,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
        ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price,
        COUNT(*) as observations
      FROM ${PRICE_HISTORY_TABLE}
      WHERE ${conditions.join(' AND ')}
      GROUP BY scrape_date, site, name, brand
      ORDER BY name, scrape_date, site
    `);
  }

  // ── Site Stats ──────────────────────────────────────────────────────

  async getSiteStats(): Promise<SiteStats[]> {
    return this.query<SiteStats>(`
      SELECT
        site,
        COUNT(*) as items,
        COUNT(DISTINCT brand) as brands,
        COUNT(DISTINCT category) as categories,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
        ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price,
        ROUND(100.0 * SUM(CASE WHEN availability = 'in_stock' THEN 1 ELSE 0 END) / COUNT(*), 1) as in_stock_pct,
        ROUND(100.0 * SUM(CASE WHEN product_url != '' THEN 1 ELSE 0 END) / COUNT(*), 1) as has_url_pct
      FROM ${TABLE_NAME}
      GROUP BY site
      ORDER BY items DESC
    `);
  }

  // ── Top Brands ──────────────────────────────────────────────────────

  async getTopBrands(
    limit = 20,
    site?: string,
  ): Promise<{ brand: string; product_count: number; avg_price: number }[]> {
    const conditions = ["brand != 'Unknown'"];
    if (site) conditions.push(`site = '${SQLFragments.escapeSql(site)}'`);

    return this.query(`
      SELECT
        brand,
        COUNT(*) as product_count,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      GROUP BY brand
      ORDER BY product_count DESC
      LIMIT ${limit}
    `);
  }

  // ── Sales / Discounts ───────────────────────────────────────────────

  async findSales(
    options: { minDiscountPct?: number; sites?: string[]; category?: string; limit?: number } = {},
  ): Promise<(CatalogRow & { discount_pct: number })[]> {
    const { minDiscountPct = 10, sites, category, limit = DBConfig.DEFAULT_LIMIT } = options;

    const conditions = ['compare_at_price IS NOT NULL', 'compare_at_price > price', 'price > 0'];
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }
    if (category) {
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    }

    return this.query(`
      SELECT *,
        ROUND(100.0 * (compare_at_price - price) / compare_at_price, 1) as discount_pct
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
        AND ROUND(100.0 * (compare_at_price - price) / compare_at_price, 1) >= ${minDiscountPct}
      ORDER BY discount_pct DESC
      LIMIT ${limit}
    `);
  }

  // ── Top Rated ───────────────────────────────────────────────────────

  async getTopRated(
    options: { category?: string; minReviews?: number; sites?: string[]; limit?: number } = {},
  ): Promise<(CatalogRow & { score: number })[]> {
    const { category, minReviews = 5, sites, limit = DBConfig.DEFAULT_LIMIT } = options;

    const conditions = [
      'rating_value IS NOT NULL',
      'review_count IS NOT NULL',
      `review_count >= ${minReviews}`,
    ];
    if (category) {
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    }
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query(`
      SELECT *,
        ROUND(rating_value * LN(review_count + 1), 2) as score
      FROM ${TABLE_NAME}
      WHERE ${conditions.join(' AND ')}
      ORDER BY score DESC
      LIMIT ${limit}
    `);
  }

  // ── Lightweight Products ────────────────────────────────────────────

  async findLightweight(
    options: { category?: string; maxWeightG?: number; sites?: string[]; limit?: number } = {},
  ): Promise<(CatalogRow & { weight_g: number; weight_per_dollar: number })[]> {
    const { category, maxWeightG = 500, sites, limit = DBConfig.DEFAULT_LIMIT } = options;

    const conditions = ['weight IS NOT NULL', 'weight > 0', "weight_unit != ''"];
    if (category) {
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    }
    if (sites?.length) {
      conditions.push(`site IN (${sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ')})`);
    }

    return this.query(`
      WITH weighted AS (
        SELECT *,
          CASE
            WHEN LOWER(weight_unit) IN ('g', 'gram', 'grams') THEN weight
            WHEN LOWER(weight_unit) IN ('kg', 'kilogram', 'kilograms') THEN weight * 1000
            WHEN LOWER(weight_unit) IN ('oz', 'ounce', 'ounces') THEN weight * 28.3495
            WHEN LOWER(weight_unit) IN ('lb', 'lbs', 'pound', 'pounds') THEN weight * 453.592
            ELSE weight
          END as weight_g
        FROM ${TABLE_NAME}
        WHERE ${conditions.join(' AND ')}
      )
      SELECT *,
        ROUND(weight_g / NULLIF(price, 0), 2) as weight_per_dollar
      FROM weighted
      WHERE weight_g <= ${maxWeightG} AND weight_g > 0
      ORDER BY weight_g ASC
      LIMIT ${limit}
    `);
  }

  // ── Market Summary ──────────────────────────────────────────────────

  async getMarketSummary(): Promise<{
    totalItems: number;
    totalSites: number;
    totalBrands: number;
    totalCategories: number;
    avgPrice: number;
    inStockPct: number;
  }> {
    const rows = await this.query<{
      total_items: number;
      total_sites: number;
      total_brands: number;
      total_categories: number;
      avg_price: number;
      in_stock_pct: number;
    }>(`
      SELECT
        COUNT(*) as total_items,
        COUNT(DISTINCT site) as total_sites,
        COUNT(DISTINCT brand) as total_brands,
        COUNT(DISTINCT category) as total_categories,
        ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
        ROUND(100.0 * SUM(CASE WHEN availability = 'in_stock' THEN 1 ELSE 0 END) / COUNT(*), 1) as in_stock_pct
      FROM ${TABLE_NAME}
    `);

    const r = rows[0];
    return {
      totalItems: Number(r?.total_items ?? 0),
      totalSites: Number(r?.total_sites ?? 0),
      totalBrands: Number(r?.total_brands ?? 0),
      totalCategories: Number(r?.total_categories ?? 0),
      avgPrice: Number(r?.avg_price ?? 0),
      inStockPct: Number(r?.in_stock_pct ?? 0),
    };
  }

  // ── Price Distribution ──────────────────────────────────────────────

  async getPriceDistribution(site?: string): Promise<{ bucket: string; count: number }[]> {
    const where = site ? `WHERE site = '${SQLFragments.escapeSql(site)}'` : '';

    return this.query(`
      SELECT
        CASE
          WHEN price < 25 THEN 'Under $25'
          WHEN price < 50 THEN '$25-50'
          WHEN price < 100 THEN '$50-100'
          WHEN price < 250 THEN '$100-250'
          WHEN price < 500 THEN '$250-500'
          WHEN price < 1000 THEN '$500-1000'
          ELSE '$1000+'
        END as bucket,
        COUNT(*) as count
      FROM ${TABLE_NAME}
      ${where}
      GROUP BY bucket
      ORDER BY MIN(price)
    `);
  }

  // ── Availability Summary ────────────────────────────────────────────

  async getAvailabilitySummary(): Promise<{ site: string; availability: string; count: number }[]> {
    return this.query(`
      SELECT site, availability, COUNT(*) as count
      FROM ${TABLE_NAME}
      GROUP BY site, availability
      ORDER BY site, count DESC
    `);
  }

  // ── Market Share ────────────────────────────────────────────────────

  async getMarketShare(
    options: { category?: string; topN?: number } = {},
  ): Promise<{ brand: string; product_count: number; revenue_share: number }[]> {
    const { category, topN = 10 } = options;

    const conditions = ["brand != 'Unknown'"];
    if (category) {
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    }

    return this.query(`
      WITH totals AS (
        SELECT SUM(price) as total_revenue, COUNT(*) as total_count
        FROM ${TABLE_NAME}
        WHERE ${conditions.join(' AND ')}
      )
      SELECT
        brand,
        COUNT(*) as product_count,
        ROUND(100.0 * SUM(price) / MAX(totals.total_revenue), 1) as revenue_share
      FROM ${TABLE_NAME}, totals
      WHERE ${conditions.join(' AND ')}
      GROUP BY brand
      ORDER BY product_count DESC
      LIMIT ${topN}
    `);
  }

  // ── Price History Check ─────────────────────────────────────────────

  async hasPriceHistory(): Promise<boolean> {
    const [err] = await tryit(async () => {
      await this.getConn().runAndReadAll(`SELECT 1 FROM ${PRICE_HISTORY_TABLE} LIMIT 1`);
    })();
    return !err;
  }
}
