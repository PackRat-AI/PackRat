/**
 * Unified SQL fragments and query builder for PackRat data queries.
 *
 * Single source of truth for all SQL patterns. Ported from Python sql_fragments.py
 * with SQL injection fixes (user input is escaped via _escapeSql).
 */

import {
  DBConfig,
  FIELD_DEFAULTS,
  FIELD_MAPPINGS,
  R2_CSV_GLOBS,
  SITE_EXTRACT_REGEX,
} from './constants';

// ── SQL Fragments ─────────────────────────────────────────────────────

export class SQLFragments {
  /** Escape single quotes for safe SQL string interpolation. */
  static escapeSql(value: string): string {
    return value.replaceAll("'", "''");
  }

  /** SQL expression to extract site name from filename. */
  static siteExtract(alias = 'site'): string {
    return `regexp_extract(filename, '${SITE_EXTRACT_REGEX}', 1) as ${alias}`;
  }

  /**
   * Build COALESCE for a logical field across all column name variations.
   *
   * Example: safeCoalesce("name") =>
   *   COALESCE(NULLIF(TRIM(TRY_CAST(name AS VARCHAR)), ''),
   *            NULLIF(TRIM(TRY_CAST(heading AS VARCHAR)), ''),
   *            'Unknown') as name
   */
  static safeCoalesce(field: string, defaultValue?: string): string {
    const variations = FIELD_MAPPINGS[field] ?? [field];
    let dflt: string;
    if (defaultValue !== undefined) {
      dflt = defaultValue.startsWith("'") ? defaultValue : `'${defaultValue}'`;
    } else {
      const raw = FIELD_DEFAULTS[field] ?? '';
      dflt = `'${raw}'`;
    }

    const parts = variations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    return `COALESCE(${parts.join(', ')}, ${dflt}) as ${field}`;
  }

  /** Bulletproof price extraction with fallbacks from FIELD_MAPPINGS. */
  static safePrice(alias = 'price'): string {
    const maxP = DBConfig.MAX_VALID_PRICE;
    const digits = DBConfig.PRICE_ROUND_DIGITS;
    const priceCols = FIELD_MAPPINGS.price ?? ['price'];

    const whenClauses: string[] = [];
    for (const col of priceCols) {
      whenClauses.push(`
            WHEN TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) IS NOT NULL
                AND TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) > 0
                AND TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) < ${maxP}
            THEN ROUND(TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE), ${digits})`);
    }

    // Final fallback: strip non-numeric chars from primary price column
    const primary = priceCols[0];
    whenClauses.push(`
            WHEN TRY_CAST(REGEXP_REPLACE(COALESCE(TRY_CAST(${primary} AS VARCHAR), ''), '[^0-9.]', '', 'g') AS DOUBLE) IS NOT NULL
                AND TRY_CAST(REGEXP_REPLACE(COALESCE(TRY_CAST(${primary} AS VARCHAR), ''), '[^0-9.]', '', 'g') AS DOUBLE) > 0
                AND TRY_CAST(REGEXP_REPLACE(COALESCE(TRY_CAST(${primary} AS VARCHAR), ''), '[^0-9.]', '', 'g') AS DOUBLE) < ${maxP}
            THEN ROUND(TRY_CAST(REGEXP_REPLACE(COALESCE(TRY_CAST(${primary} AS VARCHAR), ''), '[^0-9.]', '', 'g') AS DOUBLE), ${digits})`);

    return `CASE${whenClauses.join('')}
            ELSE NULL
        END as ${alias}`;
  }

  /** Safe float extraction from FIELD_MAPPINGS with optional range check. */
  static safeFloat(
    field: string,
    opts: { alias?: string; minVal?: number; maxVal?: number } = {},
  ): string {
    const { alias, minVal, maxVal } = opts;
    const a = alias ?? field;
    const variations = FIELD_MAPPINGS[field] ?? [field];
    const digits = DBConfig.PRICE_ROUND_DIGITS;

    const whenClauses: string[] = [];
    for (const col of variations) {
      let cond = `WHEN TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) IS NOT NULL`;
      const checks: string[] = [];
      if (minVal !== undefined) {
        checks.push(`TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) >= ${minVal}`);
      }
      if (maxVal !== undefined) {
        checks.push(`TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE) <= ${maxVal}`);
      }
      if (checks.length > 0) {
        cond += ` AND ${checks.join(' AND ')}`;
      }
      cond += `\n            THEN ROUND(TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS DOUBLE), ${digits})`;
      whenClauses.push(cond);
    }

    return `CASE
            ${whenClauses.join('\n            ')}
            ELSE NULL
        END as ${a}`;
  }

  /** Safe integer extraction from FIELD_MAPPINGS. */
  static safeInt(field: string, alias?: string): string {
    const a = alias ?? field;
    const variations = FIELD_MAPPINGS[field] ?? [field];

    const whenClauses = variations.map(
      (col) =>
        `WHEN TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS INTEGER) IS NOT NULL\n            THEN TRY_CAST(TRY_CAST(${col} AS VARCHAR) AS INTEGER)`,
    );

    return `CASE
            ${whenClauses.join('\n            ')}
            ELSE NULL
        END as ${a}`;
  }

  /** Normalize availability across all known formats. */
  static safeAvailability(alias = 'availability'): string {
    return `CASE
            WHEN TRY_CAST(availability AS VARCHAR) IS NULL
                OR TRIM(TRY_CAST(availability AS VARCHAR)) = '' THEN 'unknown'
            WHEN LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%instock%'
                OR LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%in_stock%'
                OR LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%in stock%' THEN 'in_stock'
            WHEN LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%available%'
                OR LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%yes%'
                OR TRY_CAST(availability AS VARCHAR) = '1' THEN 'in_stock'
            WHEN TRY_CAST(TRY_CAST(availability AS VARCHAR) AS INTEGER) IS NOT NULL
                AND TRY_CAST(TRY_CAST(availability AS VARCHAR) AS INTEGER) > 0 THEN 'in_stock'
            WHEN LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%out%'
                OR LOWER(TRY_CAST(availability AS VARCHAR)) LIKE '%no%'
                OR TRY_CAST(availability AS VARCHAR) = '0' THEN 'out_of_stock'
            WHEN TRY_CAST(TRY_CAST(availability AS VARCHAR) AS INTEGER) IS NOT NULL
                AND TRY_CAST(TRY_CAST(availability AS VARCHAR) AS INTEGER) = 0 THEN 'out_of_stock'
            ELSE 'unknown'
        END as ${alias}`;
  }

  /** Standard read_csv_auto clause reading from multiple version prefixes. */
  static readCsvSource(bucketPath: string, globPatterns?: string[]): string {
    const globs = globPatterns ?? R2_CSV_GLOBS;
    const paths = globs.map((g) => `'${bucketPath}/${g}'`);
    const pathList = `[${paths.join(', ')}]`;
    return `read_csv_auto(${pathList},
            ignore_errors=true,
            strict_mode=false,
            union_by_name=true,
            filename=true,
            sample_size=20480)`;
  }

  /** Standard SELECT fields for normalized gear data. */
  static selectFields(): string[] {
    return [
      SQLFragments.siteExtract(),
      SQLFragments.safeCoalesce('name'),
      SQLFragments.safeCoalesce('brand'),
      SQLFragments.safeCoalesce('category'),
      SQLFragments.safePrice(),
      SQLFragments.safeAvailability(),
      SQLFragments.safeCoalesce('description'),
      SQLFragments.safeCoalesce('product_url'),
      SQLFragments.safeCoalesce('image_url'),
      // V2 fields
      SQLFragments.safeFloat('compare_at_price', { minVal: 0, maxVal: DBConfig.MAX_VALID_PRICE }),
      SQLFragments.safeFloat('rating_value', { minVal: 0, maxVal: 5 }),
      SQLFragments.safeInt('review_count'),
      SQLFragments.safeFloat('weight', { minVal: -1 }),
      SQLFragments.safeCoalesce('weight_unit', "''"),
      SQLFragments.safeCoalesce('color'),
      SQLFragments.safeCoalesce('size'),
      SQLFragments.safeCoalesce('material'),
      SQLFragments.safeCoalesce('tags'),
      SQLFragments.safeCoalesce('published_at'),
      SQLFragments.safeCoalesce('updated_at'),
    ];
  }

  /** Standard WHERE conditions for valid product data. */
  static baseWhere(): string[] {
    const maxP = DBConfig.MAX_VALID_PRICE;
    return [
      'name IS NOT NULL',
      "TRIM(COALESCE(name, '')) != ''",
      `(
                (TRY_CAST(price AS DOUBLE) IS NOT NULL AND TRY_CAST(price AS DOUBLE) > 0 AND TRY_CAST(price AS DOUBLE) < ${maxP})
                OR
                (TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) IS NOT NULL
                AND TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) > 0
                AND TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) < ${maxP})
            )`,
    ];
  }

  /** WHERE clause for keyword search across text fields using FIELD_MAPPINGS. */
  static keywordFilter(keyword: string): string {
    const kw = SQLFragments.escapeSql(keyword.toLowerCase());
    const searchFields = ['name', 'brand', 'category', 'description'];
    const clauses: string[] = [];
    for (const field of searchFields) {
      const variations = FIELD_MAPPINGS[field] ?? [field];
      const parts = variations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
      const coalesce = `COALESCE(${parts.join(', ')}, '')`;
      clauses.push(`LOWER(${coalesce}) LIKE '%${kw}%'`);
    }
    return `(${clauses.join(' OR ')})`;
  }

  /** WHERE clause filtering to specific sites. */
  static siteFilter(sites: string[]): string | null {
    if (sites.length === 0) return null;
    const siteList = sites.map((s) => `'${SQLFragments.escapeSql(s)}'`).join(', ');
    return `regexp_extract(filename, '${SITE_EXTRACT_REGEX}', 1) IN (${siteList})`;
  }

  /** WHERE clauses for price range filtering. */
  static priceRangeFilter(minPrice?: number, maxPrice?: number): string[] {
    const conditions: string[] = [];
    if (minPrice !== undefined) {
      conditions.push(`(
                (TRY_CAST(price AS DOUBLE) IS NOT NULL AND TRY_CAST(price AS DOUBLE) >= ${minPrice})
                OR
                (TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) IS NOT NULL
                 AND TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) >= ${minPrice})
            )`);
    }
    if (maxPrice !== undefined) {
      conditions.push(`(
                (TRY_CAST(price AS DOUBLE) IS NOT NULL AND TRY_CAST(price AS DOUBLE) <= ${maxPrice})
                OR
                (TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) IS NOT NULL
                 AND TRY_CAST(REGEXP_REPLACE(COALESCE(price, ''), '[^0-9.]', '') AS DOUBLE) <= ${maxPrice})
            )`);
    }
    return conditions;
  }
}

// ── Query Builder ─────────────────────────────────────────────────────

export class QueryBuilder {
  constructor(readonly bucketPath: string) {}

  private buildWhere(conditions: (string | null)[]): string {
    return conditions.filter(Boolean).join(' AND ');
  }

  searchQuery(
    keyword: string,
    opts: { sites?: string[]; minPrice?: number; maxPrice?: number; limit?: number } = {},
  ): string {
    const { sites, minPrice, maxPrice, limit = DBConfig.DEFAULT_LIMIT } = opts;
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);

    const conditions: (string | null)[] = [
      ...SQLFragments.baseWhere(),
      SQLFragments.keywordFilter(keyword),
      sites ? SQLFragments.siteFilter(sites) : null,
      ...SQLFragments.priceRangeFilter(minPrice, maxPrice),
    ];

    return `
        SELECT ${select}
        FROM ${source}
        WHERE ${this.buildWhere(conditions)}
        ORDER BY price ASC
        LIMIT ${limit}
        `;
  }

  priceComparisonQuery(keyword: string, sites?: string[]): string {
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);

    const conditions: (string | null)[] = [
      ...SQLFragments.baseWhere(),
      SQLFragments.keywordFilter(keyword),
      sites ? SQLFragments.siteFilter(sites) : null,
    ];

    return `
        WITH base AS (
            SELECT ${select}
            FROM ${source}
            WHERE ${this.buildWhere(conditions)}
        )
        SELECT
            site,
            COUNT(*) as item_count,
            ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
            ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
            ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
        FROM base
        GROUP BY site
        HAVING COUNT(*) >= ${DBConfig.MIN_GROUP_COUNT}
        ORDER BY avg_price ASC
        `;
  }

  brandAnalysisQuery(brandName: string, sites?: string[]): string {
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);

    const conditions: (string | null)[] = [...SQLFragments.baseWhere()];
    const brandVariations = FIELD_MAPPINGS.brand ?? ['brand'];
    const brandParts = brandVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const brandCoalesce = `COALESCE(${brandParts.join(', ')}, '')`;
    const escapedBrand = SQLFragments.escapeSql(brandName.toLowerCase());
    conditions.push(`LOWER(${brandCoalesce}) LIKE '%${escapedBrand}%'`);
    if (sites) conditions.push(SQLFragments.siteFilter(sites));

    return `
        WITH base AS (
            SELECT ${select}
            FROM ${source}
            WHERE ${this.buildWhere(conditions)}
        )
        SELECT
            site,
            category,
            COUNT(*) as product_count,
            ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
            ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
            ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
        FROM base
        GROUP BY site, category
        HAVING COUNT(*) >= 2
        ORDER BY product_count DESC
        `;
  }

  categoryInsightsQuery(categoryKeyword: string, sites?: string[]): string {
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);

    const conditions: (string | null)[] = [...SQLFragments.baseWhere()];
    const catVariations = FIELD_MAPPINGS.category ?? ['category'];
    const catParts = catVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const catCoalesce = `COALESCE(${catParts.join(', ')}, '')`;
    const escapedCat = SQLFragments.escapeSql(categoryKeyword.toLowerCase());
    conditions.push(`LOWER(${catCoalesce}) LIKE '%${escapedCat}%'`);
    if (sites) conditions.push(SQLFragments.siteFilter(sites));

    return `
        WITH base AS (
            SELECT ${select}
            FROM ${source}
            WHERE ${this.buildWhere(conditions)}
        )
        SELECT
            site,
            COUNT(*) as product_count,
            COUNT(DISTINCT brand) as brand_count,
            ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
            ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
            ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price
        FROM base
        GROUP BY site
        HAVING COUNT(*) >= ${DBConfig.MIN_CATEGORY_COUNT}
        ORDER BY product_count DESC
        `;
  }

  dealsQuery(
    maxPrice: number,
    opts: { category?: string; sites?: string[]; limit?: number } = {},
  ): string {
    const { category, sites, limit = DBConfig.DEFAULT_LIMIT } = opts;
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);

    const conditions: (string | null)[] = [
      ...SQLFragments.baseWhere(),
      ...SQLFragments.priceRangeFilter(undefined, maxPrice),
    ];
    if (category) {
      const escapedCategory = SQLFragments.escapeSql(category.toLowerCase());
      conditions.push(`LOWER(COALESCE(category, '')) LIKE '%${escapedCategory}%'`);
    }
    if (sites) conditions.push(SQLFragments.siteFilter(sites));

    return `
        SELECT ${select}
        FROM ${source}
        WHERE ${this.buildWhere(conditions)}
        ORDER BY price ASC
        LIMIT ${limit}
        `;
  }

  trendsQuery(keyword: string, opts: { sites?: string[]; days?: number } = {}): string {
    const { sites, days = 90 } = opts;
    const source = SQLFragments.readCsvSource(this.bucketPath);
    const kw = SQLFragments.escapeSql(keyword.toLowerCase());

    const nameVariations = FIELD_MAPPINGS.name ?? ['name'];
    const nameParts = nameVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const nameCoalesce = `COALESCE(${nameParts.join(', ')}, '')`;

    const brandVariations = FIELD_MAPPINGS.brand ?? ['brand'];
    const brandParts = brandVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const brandCoalesce = `COALESCE(${brandParts.join(', ')}, '')`;

    const conditions: (string | null)[] = [
      `(${nameCoalesce} != '' OR ${brandCoalesce} != '')`,
      `(LOWER(${nameCoalesce}) LIKE '%${kw}%' OR LOWER(${brandCoalesce}) LIKE '%${kw}%')`,
      `TRY_CAST(price AS DOUBLE) IS NOT NULL AND TRY_CAST(price AS DOUBLE) > 0 AND TRY_CAST(price AS DOUBLE) < ${DBConfig.MAX_VALID_PRICE}`,
    ];
    if (sites) conditions.push(SQLFragments.siteFilter(sites));

    return `
        WITH raw AS (
            SELECT
                ${SQLFragments.siteExtract()},
                regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) as scrape_date,
                ${nameCoalesce} as name,
                ${brandCoalesce} as brand,
                ROUND(TRY_CAST(price AS DOUBLE), ${DBConfig.PRICE_ROUND_DIGITS}) as price
            FROM ${source}
            WHERE ${this.buildWhere(conditions)}
                AND regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) IS NOT NULL
                AND regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) != ''
                AND TRY_CAST(regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) AS DATE)
                    >= CURRENT_DATE - INTERVAL '${days} days'
        )
        SELECT
            scrape_date,
            site,
            name,
            brand,
            ROUND(AVG(price), ${DBConfig.PRICE_ROUND_DIGITS}) as avg_price,
            ROUND(MIN(price), ${DBConfig.PRICE_ROUND_DIGITS}) as min_price,
            ROUND(MAX(price), ${DBConfig.PRICE_ROUND_DIGITS}) as max_price,
            COUNT(*) as observations
        FROM raw
        GROUP BY scrape_date, site, name, brand
        ORDER BY name, scrape_date, site
        `;
  }

  /** Build a SELECT query for normalized gear data (no CREATE TABLE). */
  normalizedSelectQuery(): string {
    const select = SQLFragments.selectFields().join(',\n            ');
    const source = SQLFragments.readCsvSource(this.bucketPath);
    const conditions = SQLFragments.baseWhere();

    return `
        SELECT ${select}
        FROM ${source}
        WHERE ${this.buildWhere(conditions)}
        `;
  }

  /** Build CREATE TABLE AS SELECT for cache population. */
  createCacheTable(tableName = 'gear_data'): string {
    return `
        CREATE TABLE ${tableName} AS
        ${this.normalizedSelectQuery()}
        `;
  }

  /** Build CREATE TABLE AS SELECT for price history cache. */
  createPriceHistoryTable(tableName = 'price_history'): string {
    const source = SQLFragments.readCsvSource(this.bucketPath);
    const maxP = DBConfig.MAX_VALID_PRICE;

    const nameVariations = FIELD_MAPPINGS.name ?? ['name'];
    const nameParts = nameVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const nameCoalesce = `COALESCE(${nameParts.join(', ')}, '')`;

    const brandVariations = FIELD_MAPPINGS.brand ?? ['brand'];
    const brandParts = brandVariations.map((v) => `NULLIF(TRIM(TRY_CAST(${v} AS VARCHAR)), '')`);
    const brandCoalesce = `COALESCE(${brandParts.join(', ')}, '')`;

    return `
        CREATE TABLE ${tableName} AS
        SELECT
            regexp_extract(filename, '${SITE_EXTRACT_REGEX}', 1) as site,
            regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) as scrape_date,
            ${nameCoalesce} as name,
            ${brandCoalesce} as brand,
            TRY_CAST(price AS DOUBLE) as price
        FROM ${source}
        WHERE ${nameCoalesce} != ''
          AND TRY_CAST(price AS DOUBLE) IS NOT NULL
          AND TRY_CAST(price AS DOUBLE) > 0
          AND TRY_CAST(price AS DOUBLE) < ${maxP}
          AND regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) IS NOT NULL
          AND regexp_extract(filename, '(\\d{4}-\\d{2}-\\d{2})T', 1) != ''
        `;
  }
}
