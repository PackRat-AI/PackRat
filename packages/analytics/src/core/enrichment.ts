/**
 * Image and review enrichment for canonical products.
 *
 * Aggregates images and reviews across retailers per canonical product.
 * Deduplicates images by CDN URL normalization.
 * Computes weighted average ratings.
 *
 * Ported from Python enrichment.py.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import {
  anyOf,
  caseInsensitive,
  charNotIn,
  createRegExp,
  digit,
  exactly,
  global as globalFlag,
  oneOrMore,
  wordChar,
} from 'magic-regexp';
import { SQLFragments } from './query-builder';

// ── Image dedup regexes ──────────────────────────────────────────────────
//
// Built with magic-regexp so the patterns compose from typed primitives
// instead of fragile string literals. The derived `.source` is reused in
// the DuckDB SQL below — previously the SQL variant was hand-escaped and
// the `\d`/`\w` classes were silently dropped by the JS string parser
// (biome surfaced the bug during an unrelated auto-fix).

const digits = oneOrMore(digit);
const wordChars = oneOrMore(wordChar);
const PRODUCT_PATH_PATTERN = /\/(product|pdp|main|hero|primary)\//;
const LIFESTYLE_PATH_PATTERN = /\/(lifestyle|action|model)\//;
const DETAIL_PATH_PATTERN = /\/(detail|zoom|swatch)\//;
const TRAILING_QUESTION_MARK_PATTERN = /\?$/;
const QUESTION_MARK_AMP_PATTERN = /\?&/;

/** CDN sizing/quality query params — e.g. `?w=500`, `&quality=auto`.
 *  Longest names listed first so alternation matches greedily. */
const CDN_QUERY_PARAMS = createRegExp(
  anyOf('?', '&')
    .and(
      anyOf(
        'width',
        'height',
        'resize',
        'quality',
        'format',
        'crop',
        'auto',
        'size',
        'wid',
        'hei',
        'qlt',
        'fmt',
        'scl',
        'rect',
        'dpr',
        'fm',
        'w',
        'h',
        'q',
      ),
    )
    .and('=')
    .and(oneOrMore(charNotIn('&'))),
  [globalFlag, caseInsensitive],
);

/** Path-based CDN transforms — e.g. `/300x400/`, `/w_500/`, `/c_fill/`. */
const CDN_PATH_TRANSFORMS = createRegExp(
  exactly('/')
    .and(
      anyOf(
        exactly(digits, 'x', digits),
        exactly('w_', digits),
        exactly('h_', digits),
        exactly('c_', wordChars),
        exactly('f_', wordChars),
        exactly('q_', digits),
      ),
    )
    .before('/'),
  [globalFlag, caseInsensitive],
);

// ── Image dedup helpers ──────────────────────────────────────────────────

/** Normalize image URL for dedup — strip CDN size/quality params. */
export function normalizeImageUrl(url: string): string {
  if (!url) return '';
  // Fresh regex reference per call to avoid lastIndex issues is unnecessary
  // because `.replace` on a non-sticky global regex does not depend on lastIndex.
  let normalized = url.replace(CDN_QUERY_PARAMS, '');
  normalized = normalized
    .replace(TRAILING_QUESTION_MARK_PATTERN, '')
    .replace(QUESTION_MARK_AMP_PATTERN, '?');
  normalized = normalized.replace(CDN_PATH_TRANSFORMS, '');
  return normalized.trim();
}

/** Rank image type: product shots (0) > lifestyle (1) > detail (2) > other (3). */
export function rankImage(url: string): number {
  const path = url.toLowerCase();

  if (PRODUCT_PATH_PATTERN.test(path)) return 0;
  if (LIFESTYLE_PATH_PATTERN.test(path)) return 1;
  if (DETAIL_PATH_PATTERN.test(path)) return 2;
  return 3;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface ReviewStats {
  total_reviews: number;
  products_with_reviews: number;
  sites_with_reviews: number;
  avg_rating: number;
}

export interface ImageStats {
  total_images: number;
  products_with_images: number;
  unique_urls: number;
}

export interface ProductReview {
  product_id: string;
  site: string;
  name: string;
  brand: string;
  rating: number;
  review_count: number;
  price: number;
  weighted_avg_rating?: number;
  total_reviews?: number;
}

export interface ProductImage {
  product_id: string;
  site: string;
  name: string;
  url: string;
}

// ── Enrichment ───────────────────────────────────────────────────────────

const IMAGES_TABLE = 'product_images';
const REVIEWS_TABLE = 'product_reviews';
const ENTITIES_TABLE = 'product_entities';

export class Enrichment {
  constructor(
    private readonly conn: DuckDBConnection,
    private readonly sourceTable = 'gear_data',
  ) {}

  private async hasEntities(): Promise<boolean> {
    try {
      await this.conn.runAndReadAll(`SELECT 1 FROM ${ENTITIES_TABLE} LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  /** Aggregate reviews across retailers. */
  async buildReviews(): Promise<ReviewStats> {
    const hasEnt = await this.hasEntities();

    const productIdExpr = hasEnt
      ? `e.canonical_id`
      : `MD5(LOWER(TRIM(g.name)) || ':' || LOWER(TRIM(g.brand)))`;

    const joinClause = hasEnt
      ? `FROM ${this.sourceTable} g INNER JOIN ${ENTITIES_TABLE} e ON g.site = e.site AND g.name = e.name`
      : `FROM ${this.sourceTable} g`;

    await this.conn.run(`DROP TABLE IF EXISTS ${REVIEWS_TABLE}`);
    await this.conn.run(`
      CREATE TABLE ${REVIEWS_TABLE} AS
      SELECT
        ${productIdExpr} as product_id,
        g.site,
        g.name,
        g.brand,
        g.rating_value as rating,
        g.review_count,
        g.price
      ${joinClause}
      WHERE g.rating_value IS NOT NULL
        AND g.review_count IS NOT NULL
        AND g.review_count > 0
    `);

    const result = await this.conn.runAndReadAll(`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(DISTINCT product_id) as products_with_reviews,
        COUNT(DISTINCT site) as sites_with_reviews,
        ROUND(AVG(rating), 2) as avg_rating
      FROM ${REVIEWS_TABLE}
    `);

    const row = result.getRows()[0];
    return {
      total_reviews: Number(row?.[0] ?? 0),
      products_with_reviews: Number(row?.[1] ?? 0),
      sites_with_reviews: Number(row?.[2] ?? 0),
      avg_rating: Number(row?.[3] ?? 0),
    };
  }

  /** Aggregate and deduplicate images across retailers. */
  async buildImages(): Promise<ImageStats> {
    const hasEnt = await this.hasEntities();

    const productIdExpr = hasEnt
      ? `e.canonical_id`
      : `MD5(LOWER(TRIM(g.name)) || ':' || LOWER(TRIM(g.brand)))`;

    const joinClause = hasEnt
      ? `FROM ${this.sourceTable} g INNER JOIN ${ENTITIES_TABLE} e ON g.site = e.site AND g.name = e.name`
      : `FROM ${this.sourceTable} g`;

    await this.conn.run(`DROP TABLE IF EXISTS ${IMAGES_TABLE}`);
    // Normalize URLs in SQL to deduplicate across CDN size variants
    await this.conn.run(`
      CREATE TABLE ${IMAGES_TABLE} AS
      SELECT DISTINCT
        ${productIdExpr} as product_id,
        g.site,
        g.name,
        REGEXP_REPLACE(
          REGEXP_REPLACE(g.image_url, '${CDN_QUERY_PARAMS.source}', '', 'gi'),
          '${CDN_PATH_TRANSFORMS.source}', '', 'gi'
        ) as url
      ${joinClause}
      WHERE g.image_url IS NOT NULL
        AND TRIM(g.image_url) != ''
    `);

    const result = await this.conn.runAndReadAll(`
      SELECT
        COUNT(*) as total_images,
        COUNT(DISTINCT product_id) as products_with_images,
        COUNT(DISTINCT url) as unique_urls
      FROM ${IMAGES_TABLE}
    `);

    const row = result.getRows()[0];
    return {
      total_images: Number(row?.[0] ?? 0),
      products_with_images: Number(row?.[1] ?? 0),
      unique_urls: Number(row?.[2] ?? 0),
    };
  }

  /** Get images for a product by keyword. */
  async getProductImages(query: string, limit = 20): Promise<ProductImage[]> {
    try {
      await this.conn.runAndReadAll(`SELECT 1 FROM ${IMAGES_TABLE} LIMIT 1`);
    } catch {
      return [];
    }

    const kw = SQLFragments.escapeSql(query.toLowerCase());
    const result = await this.conn.runAndReadAll(`
      SELECT product_id, site, name, url
      FROM ${IMAGES_TABLE}
      WHERE LOWER(COALESCE(name, '')) LIKE '%${kw}%'
      ORDER BY name, site
      LIMIT ${limit}
    `);

    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col === undefined) continue;
        obj[col] = row[i];
      }
      return obj as unknown as ProductImage;
    });
  }

  /** Get review aggregation with weighted average for a product. */
  async getProductReviews(query: string, limit = 20): Promise<ProductReview[]> {
    try {
      await this.conn.runAndReadAll(`SELECT 1 FROM ${REVIEWS_TABLE} LIMIT 1`);
    } catch {
      return [];
    }

    const kw = SQLFragments.escapeSql(query.toLowerCase());
    const result = await this.conn.runAndReadAll(`
      WITH matches AS (
        SELECT product_id
        FROM ${REVIEWS_TABLE}
        WHERE LOWER(COALESCE(name, '')) LIKE '%${kw}%'
           OR LOWER(COALESCE(brand, '')) LIKE '%${kw}%'
        LIMIT 1
      )
      SELECT r.name, r.brand, r.site, r.rating, r.review_count, r.price,
             ROUND(
               SUM(r.rating * r.review_count) OVER (PARTITION BY r.product_id) /
               NULLIF(SUM(r.review_count) OVER (PARTITION BY r.product_id), 0),
             2) as weighted_avg_rating,
             SUM(r.review_count) OVER (PARTITION BY r.product_id) as total_reviews
      FROM ${REVIEWS_TABLE} r
      INNER JOIN matches m ON r.product_id = m.product_id
      ORDER BY r.review_count DESC
      LIMIT ${limit}
    `);

    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col === undefined) continue;
        obj[col] = row[i];
      }
      return obj as unknown as ProductReview;
    });
  }
}
