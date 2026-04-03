/**
 * Advanced data export with SKU generation, quality scoring, and dedup.
 *
 * Ported from Python data_export.py and robust_exporter.py.
 * All processing done in DuckDB SQL for performance (no pandas dependency).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import type { DuckDBConnection } from '@duckdb/node-api';
import { DBConfig, QUALITY_WEIGHTS } from './constants';
import { SQLFragments } from './query-builder';

// ── Types ────────────────────────────────────────────────────────────────

export interface ExportOptions {
  format?: 'csv' | 'parquet' | 'json';
  outputDir?: string;
  sample?: number;
  dedup?: 'none' | 'best_quality' | 'merge_data';
  includeQuality?: boolean;
  skuFilter?: string;
}

export interface ExportSummary {
  filepath: string;
  totalRecords: number;
  uniqueSkus: number;
  sites: number;
  brands: number;
  strategy: string;
}

// ── SQL helpers ──────────────────────────────────────────────────────────

const SKU_EXPR = `
  CONCAT(
    UPPER(SUBSTRING(site, 1, 3)), '-',
    UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(brand, 'UNK'), '[^A-Za-z0-9]', ''), 1, 3)), '-',
    MD5(LOWER(TRIM(name)) || ':' || CAST(ROUND(price, 2) AS VARCHAR))[:8]
  )
`;

const QUALITY_SCORE_EXPR = `
  ROUND(
    (CASE WHEN name IS NOT NULL AND name != 'Unknown' AND name != '' THEN 1 ELSE 0 END +
     CASE WHEN brand IS NOT NULL AND brand != 'Unknown' AND brand != '' THEN 1 ELSE 0 END +
     CASE WHEN category IS NOT NULL AND category != 'Uncategorized' AND category != '' THEN 1 ELSE 0 END +
     CASE WHEN price > 0 AND price < ${DBConfig.MAX_VALID_PRICE} THEN 1 ELSE 0 END
    ) / 4.0 * ${QUALITY_WEIGHTS.completeness} * 100 +
    CASE WHEN price > 0 AND price < ${DBConfig.MAX_VALID_PRICE} THEN ${QUALITY_WEIGHTS.price_valid} * 100 ELSE 0 END +
    LEAST(LENGTH(COALESCE(name, '')) / 50.0, 1.0) * ${QUALITY_WEIGHTS.name_quality} * 100 +
    CASE WHEN brand IS NOT NULL AND brand NOT IN ('Unknown', '') THEN ${QUALITY_WEIGHTS.brand_quality} * 100 ELSE 0 END +
    CASE WHEN product_url IS NOT NULL AND product_url != '' THEN ${QUALITY_WEIGHTS.url_present} * 100 ELSE 0 END +
    CASE WHEN image_url IS NOT NULL AND image_url != '' THEN ${QUALITY_WEIGHTS.image_present} * 100 ELSE 0 END
  , 2)
`;

// ── Data Exporter ────────────────────────────────────────────────────────

export class DataExporter {
  constructor(private readonly conn: DuckDBConnection) {}

  /** Export gear_data with optional SKU generation, quality scoring, and dedup. */
  async export(opts: ExportOptions = {}): Promise<ExportSummary> {
    const {
      format = 'csv',
      outputDir = 'data/exports',
      sample,
      dedup = 'none',
      includeQuality = false,
      skuFilter,
    } = opts;

    mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `packrat_export_${timestamp}.${format}`;
    const filepath = `${outputDir}/${filename}`;

    // Build the export query
    const selectCols = [
      `${SKU_EXPR} as sku`,
      'site',
      'name',
      'brand',
      'category',
      'price',
      'availability',
      'description',
      'product_url',
      'image_url',
      'compare_at_price',
      'rating_value',
      'review_count',
      'weight',
      'weight_unit',
      'color',
      'size',
      'material',
    ];

    if (includeQuality) {
      selectCols.push(`${QUALITY_SCORE_EXPR} as quality_score`);
    }

    let sql: string;

    if (dedup === 'best_quality') {
      // Deduplicate: keep highest quality record per SKU
      sql = `
        WITH scored AS (
          SELECT ${selectCols.join(', ')},
            ROW_NUMBER() OVER (
              PARTITION BY ${SKU_EXPR}
              ORDER BY ${QUALITY_SCORE_EXPR} DESC
            ) as rn
          FROM gear_data
          ${skuFilter ? `WHERE ${SKU_EXPR} LIKE '%${SQLFragments.escapeSql(skuFilter)}%'` : ''}
        )
        SELECT ${selectCols.map((c) => c.split(' as ').pop()).join(', ')}
        FROM scored WHERE rn = 1
        ORDER BY sku
        ${sample ? `LIMIT ${sample}` : ''}
      `;
    } else if (dedup === 'merge_data') {
      // Merge: coalesce best field values across rows per SKU
      const skuAlias = SKU_EXPR;
      sql = `
        WITH base AS (
          SELECT ${selectCols.join(', ')}
          FROM gear_data
          ${skuFilter ? `WHERE ${skuAlias} LIKE '%${SQLFragments.escapeSql(skuFilter)}%'` : ''}
        )
        SELECT
          sku,
          FIRST_VALUE(site) OVER w as site,
          MAX(name) OVER w as name,
          FIRST_VALUE(brand) OVER w as brand,
          FIRST_VALUE(category) OVER w as category,
          FIRST_VALUE(price) OVER w as price,
          FIRST_VALUE(availability) OVER w as availability,
          FIRST_VALUE(description ORDER BY LENGTH(COALESCE(description, '')) DESC) OVER (PARTITION BY sku) as description,
          FIRST_VALUE(product_url) FILTER (WHERE product_url IS NOT NULL AND product_url != '') OVER w as product_url,
          FIRST_VALUE(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') OVER w as image_url,
          FIRST_VALUE(compare_at_price) FILTER (WHERE compare_at_price IS NOT NULL) OVER w as compare_at_price,
          FIRST_VALUE(rating_value) FILTER (WHERE rating_value IS NOT NULL) OVER w as rating_value,
          FIRST_VALUE(review_count) FILTER (WHERE review_count IS NOT NULL) OVER w as review_count,
          FIRST_VALUE(weight) FILTER (WHERE weight IS NOT NULL) OVER w as weight,
          FIRST_VALUE(weight_unit) FILTER (WHERE weight_unit IS NOT NULL AND weight_unit != '') OVER w as weight_unit,
          FIRST_VALUE(color) FILTER (WHERE color IS NOT NULL AND color != '') OVER w as color,
          FIRST_VALUE(size) FILTER (WHERE size IS NOT NULL AND size != '') OVER w as size,
          FIRST_VALUE(material) FILTER (WHERE material IS NOT NULL AND material != '') OVER w as material
          ${includeQuality ? `, ${QUALITY_SCORE_EXPR} as quality_score` : ''}
        FROM base
        WINDOW w AS (PARTITION BY sku ORDER BY ${QUALITY_SCORE_EXPR} DESC)
        QUALIFY ROW_NUMBER() OVER (PARTITION BY sku ORDER BY ${QUALITY_SCORE_EXPR} DESC) = 1
        ORDER BY sku
        ${sample ? `LIMIT ${sample}` : ''}
      `;
    } else {
      // No dedup — straight export
      sql = `
        SELECT ${selectCols.join(', ')}
        FROM gear_data
        ${skuFilter ? `WHERE ${SKU_EXPR} LIKE '%${SQLFragments.escapeSql(skuFilter)}%'` : ''}
        ORDER BY site, name
        ${sample ? `LIMIT ${sample}` : ''}
      `;
    }

    // Export using DuckDB COPY
    const formatMap: Record<string, string> = {
      csv: `COPY (${sql}) TO '${filepath}' (HEADER, DELIMITER ',')`,
      parquet: `COPY (${sql}) TO '${filepath}' (FORMAT PARQUET)`,
      json: `COPY (${sql}) TO '${filepath}' (FORMAT JSON, ARRAY true)`,
    };

    await this.conn.run(formatMap[format]);

    // Get summary stats
    const statsResult = await this.conn.runAndReadAll(`
      WITH exported AS (${sql})
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT sku) as unique_skus,
        COUNT(DISTINCT site) as sites,
        COUNT(DISTINCT brand) as brands
      FROM exported
    `);

    const row = statsResult.getRows()[0];

    // Write summary JSON alongside export
    const summary: ExportSummary = {
      filepath,
      totalRecords: Number(row?.[0] ?? 0),
      uniqueSkus: Number(row?.[1] ?? 0),
      sites: Number(row?.[2] ?? 0),
      brands: Number(row?.[3] ?? 0),
      strategy: dedup,
    };

    writeFileSync(filepath.replace(/\.\w+$/, '.summary.json'), JSON.stringify(summary, null, 2));

    return summary;
  }

  /** Generate SQL schema for importing exported data into a relational DB. */
  generateSchema(outputDir = 'data/exports'): string {
    mkdirSync(outputDir, { recursive: true });
    const filepath = `${outputDir}/database_schema.sql`;

    const schema = `-- PackRat Outdoor Gear Database Schema
-- Generated for final data import

CREATE TABLE IF NOT EXISTS retailers (
    retailer_id SERIAL PRIMARY KEY,
    retailer_name VARCHAR(100) UNIQUE NOT NULL,
    retailer_code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    brand_id SERIAL PRIMARY KEY,
    brand_name VARCHAR(200) UNIQUE NOT NULL,
    normalized_brand VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(200) UNIQUE NOT NULL,
    parent_category VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(50) PRIMARY KEY,
    retailer_id INTEGER REFERENCES retailers(retailer_id),
    brand_id INTEGER REFERENCES brands(brand_id),
    category_id INTEGER REFERENCES categories(category_id),
    product_name TEXT NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    availability_status VARCHAR(20) DEFAULT 'unknown',
    product_description TEXT,
    product_url TEXT,
    image_url TEXT,
    rating_value DECIMAL(3,2),
    review_count INTEGER,
    weight DECIMAL(10,2),
    weight_unit VARCHAR(20),
    quality_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_retailer ON products(retailer_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_usd);
CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability_status);

CREATE OR REPLACE VIEW product_details AS
SELECT
    p.sku,
    r.retailer_name,
    b.brand_name,
    c.category_name,
    p.product_name,
    p.price_usd,
    p.availability_status,
    p.product_description,
    p.product_url,
    p.image_url,
    p.rating_value,
    p.review_count,
    p.quality_score,
    p.created_at
FROM products p
LEFT JOIN retailers r ON p.retailer_id = r.retailer_id
LEFT JOIN brands b ON p.brand_id = b.brand_id
LEFT JOIN categories c ON p.category_id = c.category_id;
`;

    writeFileSync(filepath, schema);
    return filepath;
  }
}
