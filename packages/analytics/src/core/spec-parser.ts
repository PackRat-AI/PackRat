/**
 * Structured spec extraction from outdoor gear product data.
 *
 * Parses weight, capacity, temperature, fill power, waterproofing,
 * seasons, and gender from unstructured product text using regex.
 * Ported from Python spec_parser.py.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { isString } from '@packrat/guards';
import { DBConfig } from './constants';
import { SQLFragments } from './query-builder';

// ── Types ─────────────────────────────────────────────────────────────

export interface ProductSpecs {
  site: string;
  name: string;
  brand: string;
  category: string;
  price: number | null;
  product_url: string;
  weight_grams: number | null;
  capacity_liters: number | null;
  temp_rating_f: number | null;
  fill_power: number | null;
  waterproof_rating: number | null;
  seasons: string | null;
  gender: string | null;
  fabric: string | null;
}

// ── Weight Conversions ────────────────────────────────────────────────

const WEIGHT_CONVERSIONS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

// ── Regex Patterns ────────────────────────────────────────────────────

const WEIGHT_COMPOUND = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s+(\d+(?:\.\d+)?)\s*(?:oz|ounces?)/i;
const WEIGHT_SIMPLE =
  /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|kilogram|kilograms|oz|ounce|ounces|lb|lbs|pound|pounds)\b/i;
const CAPACITY = /(\d+(?:\.\d+)?)\s*(?:l|liters?|litres?)\b/i;
const TEMP_RANGE = /(-?\d+)\s*\/\s*(-?\d+)\s*°?\s*([FC])\b/i;
const TEMP_SINGLE = /(-?\d+)\s*°?\s*([FC])\b/i;
const FILL_POWER = /(\d{3,4})\s*[-‑]?\s*(?:fill|fp)\b/i;
const WATERPROOF = /(\d[\d,]*)\s*(?:k\s*)?mm\b/i;
const WATERPROOF_K_MULTIPLIER_PATTERN = /(\d[\d,]*)\s*k\s*mm\b/i;
const SEASON = /([1-4])\s*[-‑]?\s*seasons?\b/i;
const GENDER = /\b(men'?s?|women'?s?|womens|mens|unisex|kids?|youth|boys?|girls?|junior)\b/i;
const COMMA_PATTERN = /,/g;
const MEN_PATTERN = /men/;
const WOMEN_PATTERN = /women/;
const YOUTH_PATTERN = /kid|youth|boy|girl|junior/;

const FABRIC_PATTERNS = [
  /\b(gore[-‑]?tex)\b/i,
  /\b(pertex)\b/i,
  /\b(cordura)\b/i,
  /\b(ripstop)\b/i,
  /\b(dyneema)\b/i,
  /\b(cuben\s*fiber)\b/i,
  /\b(silnylon)\b/i,
  /\b(silpoly)\b/i,
  /\b(\d+d\s*(?:nylon|polyester|ripstop))\b/i,
];

// ── Unit Conversion ───────────────────────────────────────────────────

function toGrams(value: number, unit: string): number | null {
  const factor = WEIGHT_CONVERSIONS[unit.toLowerCase()];
  return factor ? Math.round(value * factor * 100) / 100 : null;
}

function toFahrenheit(value: number, unit: string): number {
  if (unit.toUpperCase() === 'C') return Math.round((value * 9) / 5 + 32);
  return value;
}

// ── Spec Extractors ───────────────────────────────────────────────────

export function parseWeightGrams(text: string): number | null {
  // Try compound first: "2 lbs 3 oz"
  const compound = WEIGHT_COMPOUND.exec(text);
  if (compound?.[1] !== undefined && compound[2] !== undefined) {
    const lbs = Number.parseFloat(compound[1]);
    const oz = Number.parseFloat(compound[2]);
    return Math.round((lbs * 453.592 + oz * 28.3495) * 100) / 100;
  }

  const simple = WEIGHT_SIMPLE.exec(text);
  if (simple?.[1] !== undefined && simple[2] !== undefined) {
    return toGrams(Number.parseFloat(simple[1]), simple[2]);
  }
  return null;
}

export function parseCapacityLiters(text: string): number | null {
  const match = CAPACITY.exec(text);
  return match?.[1] !== undefined ? Number.parseFloat(match[1]) : null;
}

export function parseTempRatingF(text: string): number | null {
  // Range: take lower bound ("20/30F" → 20F)
  const range = TEMP_RANGE.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined && range[3] !== undefined) {
    const lower = Math.min(Number.parseInt(range[1], 10), Number.parseInt(range[2], 10));
    return toFahrenheit(lower, range[3]);
  }

  const single = TEMP_SINGLE.exec(text);
  if (single?.[1] !== undefined && single[2] !== undefined) {
    return toFahrenheit(Number.parseInt(single[1], 10), single[2]);
  }
  return null;
}

export function parseFillPower(text: string): number | null {
  const match = FILL_POWER.exec(text);
  if (match?.[1] !== undefined) {
    const val = Number.parseInt(match[1], 10);
    return val >= 300 && val <= 1200 ? val : null;
  }
  return null;
}

export function parseWaterproofRating(text: string): number | null {
  const match = WATERPROOF.exec(text);
  if (match?.[1] !== undefined) {
    const raw = Number.parseInt(match[1].replace(COMMA_PATTERN, ''), 10);
    // If "k" or "K" prefix was captured in the regex (e.g., "20k mm"), multiply by 1000
    const hasKMultiplier = WATERPROOF_K_MULTIPLIER_PATTERN.exec(text);
    return hasKMultiplier ? raw * 1000 : raw;
  }
  return null;
}

export function parseSeasons(text: string): string | null {
  const match = SEASON.exec(text);
  return match?.[1] !== undefined ? `${match[1]}-season` : null;
}

function normalizeGender(raw: string): string {
  const lower = raw.toLowerCase();
  if (MEN_PATTERN.test(lower) && !WOMEN_PATTERN.test(lower)) return 'men';
  if (WOMEN_PATTERN.test(lower)) return 'women';
  if (YOUTH_PATTERN.test(lower)) return 'youth';
  return 'unisex';
}

export function parseGender(text: string): string | null {
  const match = GENDER.exec(text);
  return match?.[1] !== undefined ? normalizeGender(match[1]) : null;
}

function parseFabric(text: string): string | null {
  for (const pattern of FABRIC_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

// ── Row Extraction ────────────────────────────────────────────────────

interface ProductRow {
  site: string;
  name: string;
  brand: string;
  category: string;
  price: number | null;
  product_url: string;
  description: string;
  tags: string;
}

export function extractSpecsFromRow(row: ProductRow): ProductSpecs {
  // Combine text sources for parsing
  const texts = [row.name, row.description, row.tags].filter(Boolean);
  const combined = texts.join(' ');

  return {
    site: row.site,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    product_url: row.product_url,
    weight_grams: parseWeightGrams(combined),
    capacity_liters: parseCapacityLiters(combined),
    temp_rating_f: parseTempRatingF(combined),
    fill_power: parseFillPower(combined),
    waterproof_rating: parseWaterproofRating(combined),
    seasons: parseSeasons(combined),
    gender: parseGender(combined),
    fabric: parseFabric(combined),
  };
}

// ── Spec Parser Class ─────────────────────────────────────────────────

const SPECS_TABLE = 'parsed_specs';

export class SpecParser {
  constructor(
    private readonly conn: DuckDBConnection,
    private readonly sourceTable = 'gear_data',
  ) {}

  /** Parse all products and store results in DuckDB. */
  async build(batchSize = 10_000): Promise<{ total: number; parsed: number }> {
    // Read all products
    const result = await this.conn.runAndReadAll(
      `SELECT site, name, brand, category, price, product_url, description, tags FROM ${this.sourceTable}`,
    );
    const columns = result.columnNames();
    const rows = result.getRows();

    const allSpecs: ProductSpecs[] = [];
    for (const row of rows) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col !== undefined) obj[col] = row[i];
      }
      allSpecs.push(extractSpecsFromRow(obj as unknown as ProductRow)); // safe-cast: DuckDB query result matches this row schema — columns are mapped by name
    }

    // Create specs table
    await this.conn.run(`DROP TABLE IF EXISTS ${SPECS_TABLE}`);
    await this.conn.run(`
      CREATE TABLE ${SPECS_TABLE} (
        site VARCHAR, name VARCHAR, brand VARCHAR, category VARCHAR,
        price DOUBLE, product_url VARCHAR,
        weight_grams DOUBLE, capacity_liters DOUBLE,
        temp_rating_f DOUBLE, fill_power INTEGER,
        waterproof_rating INTEGER, seasons VARCHAR,
        gender VARCHAR, fabric VARCHAR
      )
    `);

    // Insert in batches
    for (let i = 0; i < allSpecs.length; i += batchSize) {
      const batch = allSpecs.slice(i, i + batchSize);
      const values = batch
        .map((s) => {
          const v = (x: unknown) =>
            x === null || x === undefined
              ? 'NULL'
              : isString(x)
                ? `'${SQLFragments.escapeSql(String(x))}'`
                : String(x);
          return `(${v(s.site)}, ${v(s.name)}, ${v(s.brand)}, ${v(s.category)}, ${v(s.price)}, ${v(s.product_url)}, ${v(s.weight_grams)}, ${v(s.capacity_liters)}, ${v(s.temp_rating_f)}, ${v(s.fill_power)}, ${v(s.waterproof_rating)}, ${v(s.seasons)}, ${v(s.gender)}, ${v(s.fabric)})`;
        })
        .join(',\n');
      await this.conn.run(`INSERT INTO ${SPECS_TABLE} VALUES ${values}`);
    }

    await this.conn.run(`CREATE INDEX IF NOT EXISTS idx_specs_name ON ${SPECS_TABLE}(name)`);

    const parsed = allSpecs.filter(
      (s) =>
        s.weight_grams !== null ||
        s.capacity_liters !== null ||
        s.temp_rating_f !== null ||
        s.fill_power !== null ||
        s.waterproof_rating !== null ||
        s.seasons !== null ||
        s.gender !== null ||
        s.fabric !== null,
    ).length;

    return { total: allSpecs.length, parsed };
  }

  /** Search products by name/brand and return parsed specs. */
  async getProductSpecs(query: string, limit = 10): Promise<ProductSpecs[]> {
    const kw = SQLFragments.escapeSql(query.toLowerCase());
    const result = await this.conn.runAndReadAll(`
      SELECT * FROM ${SPECS_TABLE}
      WHERE LOWER(name) LIKE '%${kw}%' OR LOWER(brand) LIKE '%${kw}%'
      LIMIT ${limit}
    `);
    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col !== undefined) obj[col] = row[i];
      }
      return obj as unknown as ProductSpecs; // safe-cast: DuckDB query result matches this row schema — columns are mapped by name
    });
  }

  /** Multi-attribute product filtering. */
  async filterProducts(options: {
    category?: string;
    maxWeightG?: number;
    maxTempF?: number;
    maxPrice?: number;
    minPrice?: number;
    gender?: string;
    seasons?: string;
    sortBy?: 'weight_grams' | 'price' | 'temp_rating_f';
    limit?: number;
  }): Promise<ProductSpecs[]> {
    const {
      category,
      maxWeightG,
      maxTempF,
      maxPrice,
      minPrice,
      gender,
      seasons,
      sortBy = 'weight_grams',
      limit = DBConfig.DEFAULT_LIMIT,
    } = options;

    const conditions: string[] = [];
    if (category)
      conditions.push(`LOWER(category) LIKE '%${SQLFragments.escapeSql(category.toLowerCase())}%'`);
    if (maxWeightG !== undefined)
      conditions.push(`weight_grams IS NOT NULL AND weight_grams <= ${maxWeightG}`);
    if (maxTempF !== undefined)
      conditions.push(`temp_rating_f IS NOT NULL AND temp_rating_f <= ${maxTempF}`);
    if (maxPrice !== undefined) conditions.push(`price <= ${maxPrice}`);
    if (minPrice !== undefined) conditions.push(`price >= ${minPrice}`);
    if (gender) conditions.push(`gender = '${SQLFragments.escapeSql(gender)}'`);
    if (seasons) conditions.push(`seasons = '${SQLFragments.escapeSql(seasons)}'`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.conn.runAndReadAll(`
      SELECT * FROM ${SPECS_TABLE}
      ${where}
      ORDER BY ${sortBy} ASC NULLS LAST
      LIMIT ${limit}
    `);
    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col !== undefined) obj[col] = row[i];
      }
      return obj as unknown as ProductSpecs; // safe-cast: DuckDB query result matches this row schema — columns are mapped by name
    });
  }
}
