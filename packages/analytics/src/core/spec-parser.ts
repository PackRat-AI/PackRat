/**
 * Structured spec extraction from outdoor gear product data.
 *
 * Parses weight, capacity, temperature, fill power, waterproofing,
 * seasons, and gender from unstructured product text using regex.
 * Ported from Python spec_parser.py.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
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
const SEASON = /([1-4])\s*[-‑]?\s*seasons?\b/i;
const GENDER = /\b(men'?s?|women'?s?|womens|mens|unisex|kids?|youth|boys?|girls?|junior)\b/i;

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
  if (compound) {
    const lbs = Number.parseFloat(compound[1]);
    const oz = Number.parseFloat(compound[2]);
    return Math.round((lbs * 453.592 + oz * 28.3495) * 100) / 100;
  }

  const simple = WEIGHT_SIMPLE.exec(text);
  if (simple) {
    return toGrams(Number.parseFloat(simple[1]), simple[2]);
  }
  return null;
}

export function parseCapacityLiters(text: string): number | null {
  const match = CAPACITY.exec(text);
  return match ? Number.parseFloat(match[1]) : null;
}

export function parseTempRatingF(text: string): number | null {
  // Range: take lower bound ("20/30F" → 20F)
  const range = TEMP_RANGE.exec(text);
  if (range) {
    const lower = Math.min(Number.parseInt(range[1]), Number.parseInt(range[2]));
    return toFahrenheit(lower, range[3]);
  }

  const single = TEMP_SINGLE.exec(text);
  if (single) {
    return toFahrenheit(Number.parseInt(single[1]), single[2]);
  }
  return null;
}

export function parseFillPower(text: string): number | null {
  const match = FILL_POWER.exec(text);
  if (match) {
    const val = Number.parseInt(match[1]);
    return val >= 300 && val <= 1200 ? val : null;
  }
  return null;
}

export function parseWaterproofRating(text: string): number | null {
  const match = WATERPROOF.exec(text);
  if (match) {
    return Number.parseInt(match[1].replace(/,/g, ''));
  }
  return null;
}

export function parseSeasons(text: string): string | null {
  const match = SEASON.exec(text);
  return match ? `${match[1]}-season` : null;
}

function normalizeGender(raw: string): string {
  const lower = raw.toLowerCase();
  if (/men/.test(lower) && !/women/.test(lower)) return 'men';
  if (/women/.test(lower)) return 'women';
  if (/kid|youth|boy|girl|junior/.test(lower)) return 'youth';
  return 'unisex';
}

export function parseGender(text: string): string | null {
  const match = GENDER.exec(text);
  return match ? normalizeGender(match[1]) : null;
}

function parseFabric(text: string): string | null {
  for (const pattern of FABRIC_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[1];
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
        obj[columns[i]] = row[i];
      }
      allSpecs.push(extractSpecsFromRow(obj as unknown as ProductRow));
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
              : typeof x === 'string'
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
        s.weight_grams ||
        s.capacity_liters ||
        s.temp_rating_f ||
        s.fill_power ||
        s.waterproof_rating ||
        s.seasons ||
        s.gender ||
        s.fabric,
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
        obj[columns[i]] = row[i];
      }
      return obj as unknown as ProductSpecs;
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
    if (maxWeightG) conditions.push(`weight_grams IS NOT NULL AND weight_grams <= ${maxWeightG}`);
    if (maxTempF) conditions.push(`temp_rating_f IS NOT NULL AND temp_rating_f <= ${maxTempF}`);
    if (maxPrice) conditions.push(`price <= ${maxPrice}`);
    if (minPrice) conditions.push(`price >= ${minPrice}`);
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
        obj[columns[i]] = row[i];
      }
      return obj as unknown as ProductSpecs;
    });
  }
}
