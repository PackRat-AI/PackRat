/**
 * Product entity resolution — deduplicates listings across retailers.
 *
 * Uses union-find clustering with multi-strategy fuzzy matching:
 * 1. Exact normalized name match (confidence 1.0)
 * 2. Token-sort fuzzy match
 * 3. URL slug comparison fallback
 *
 * Ported from Python entity_resolver.py.
 */

import { createHash } from 'node:crypto';
import type { DuckDBConnection } from '@duckdb/node-api';
import { isString } from '@packrat/guards';
import { SQLFragments } from './query-builder';
import { assertDefined } from './type-assertions';

// ── Confidence Levels ─────────────────────────────────────────────────

const CONFIDENCE_EXACT = 1.0;
const CONFIDENCE_HIGH = 0.9;
const CONFIDENCE_MEDIUM = 0.8;
const CONFIDENCE_LOW = 0.65;
const MAX_BLOCK_SIZE = 5000;
const URL_QUERY_OR_HASH_PATTERN = /[?#].*$/;
const FILE_EXTENSION_PATTERN = /\.\w+$/;
const WHITESPACE_SPLIT_PATTERN = /\s+/;
const GENDER_SIZE_WORDS = /\b(men'?s?|women'?s?|unisex|kids?|youth)\b/gi;
const SIZE_ABBREVIATIONS = /\b(xs|s|m|l|xl|xxl|one size)\b/gi;
const NON_ALPHANUMERIC_SPACES = /[^a-z0-9\s]/g;
const MULTIPLE_SPACES = /\s+/g;
const NON_ALPHANUMERIC = /[^a-z0-9]/g;

// ── Normalization ─────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(GENDER_SIZE_WORDS, '')
    .replace(SIZE_ABBREVIATIONS, '')
    .replace(NON_ALPHANUMERIC_SPACES, '')
    .replace(MULTIPLE_SPACES, ' ')
    .trim();
}

function normalizeBrand(brand: string): string {
  return brand.toLowerCase().replace(NON_ALPHANUMERIC, '').trim();
}

function canonicalId(brand: string, name: string): string {
  const key = `${normalizeBrand(brand)}:${normalizeName(name)}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function extractSlug(url: string): string {
  if (!url) return '';
  const parts = url.replace(URL_QUERY_OR_HASH_PATTERN, '').split('/').filter(Boolean);
  return parts.at(-1)?.replace(FILE_EXTENSION_PATTERN, '') ?? '';
}

// ── Token Sort Ratio ──────────────────────────────────────────────────

/**
 * Simple token-sort similarity ratio (0-100).
 * Sorts tokens alphabetically then computes char-level similarity.
 * Good enough for product name matching without a heavy dep.
 */
function tokenSortRatio(a: string, b: string): number {
  const sortTokens = (s: string) =>
    s.toLowerCase().split(WHITESPACE_SPLIT_PATTERN).sort().join(' ');
  const sa = sortTokens(a);
  const sb = sortTokens(b);

  if (sa === sb) return 100;
  if (sa.length === 0 || sb.length === 0) return 0;

  // Levenshtein-based ratio
  const len = Math.max(sa.length, sb.length);
  const dist = levenshtein(sa, sb);
  return Math.round(((len - dist) / len) * 100);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    assertDefined(row);
    row[0] = i;
  }
  const firstRow = dp[0];
  assertDefined(firstRow);
  for (let j = 0; j <= n; j++) firstRow[j] = j;

  for (let i = 1; i <= m; i++) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    assertDefined(row);
    assertDefined(prevRow);
    for (let j = 1; j <= n; j++) {
      const diag: number | undefined = prevRow[j - 1];
      const up: number | undefined = prevRow[j];
      const left: number | undefined = row[j - 1];
      assertDefined(diag);
      assertDefined(up);
      assertDefined(left);
      row[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(up, left, diag);
    }
  }

  const lastRow = dp[m];
  assertDefined(lastRow);
  const result = lastRow[n];
  assertDefined(result);
  return result;
}

// ── Union-Find ────────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<number, number> = new Map();

  find(x: number): number {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) {
      const parent = this.parent.get(root);
      assertDefined(parent, 'Union-Find parent must exist after has-check');
      root = parent;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr);
      assertDefined(next, 'Union-Find parent must exist for non-root node');
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }

  groups(): Map<number, number[]> {
    const result = new Map<number, number[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!result.has(root)) result.set(root, []);
      result.get(root)?.push(key);
    }
    return result;
  }
}

// ── Types ─────────────────────────────────────────────────────────────

interface Candidate {
  idx: number;
  site: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  product_url: string;
  normalized_name: string;
  normalized_brand: string;
}

interface EntityRow {
  canonical_id: string;
  canonical_name: string;
  canonical_brand: string;
  site: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  product_url: string;
  confidence: number;
  match_method: string;
}

// ── Entity Resolver ───────────────────────────────────────────────────

const ENTITIES_TABLE = 'product_entities';

export class EntityResolver {
  constructor(
    private readonly conn: DuckDBConnection,
    private readonly sourceTable = 'gear_data',
  ) {}

  /** Run full entity resolution pipeline. */
  async build(
    minConfidence = CONFIDENCE_LOW,
  ): Promise<{ total: number; entities: number; dedupRatio: number }> {
    const candidates = await this.loadCandidates();
    const blocks = this.blockCandidates(candidates);
    const matches: [number, number, number, string][] = [];

    for (const block of blocks.values()) {
      if (block.length > MAX_BLOCK_SIZE) continue;
      matches.push(...this.matchWithinBlock(block, minConfidence));
    }

    const entities = this.buildEntities(candidates, matches);
    await this.writeEntities(entities);

    const uniqueEntities = new Set(entities.map((e) => e.canonical_id)).size;
    return {
      total: candidates.length,
      entities: uniqueEntities,
      dedupRatio:
        candidates.length > 0 ? Math.round((1 - uniqueEntities / candidates.length) * 100) : 0,
    };
  }

  private async loadCandidates(): Promise<Candidate[]> {
    const result = await this.conn.runAndReadAll(`
      SELECT site, name, brand, category, price, product_url
      FROM ${this.sourceTable}
      WHERE name IS NOT NULL AND TRIM(name) != '' AND price > 0
    `);
    const columns = result.columnNames();
    return result.getRows().map((row, idx) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col !== undefined) obj[col] = row[i];
      }
      return {
        idx,
        site: String(obj.site ?? ''),
        name: String(obj.name ?? ''),
        brand: String(obj.brand ?? ''),
        category: String(obj.category ?? ''),
        price: Number(obj.price ?? 0),
        product_url: String(obj.product_url ?? ''),
        normalized_name: normalizeName(String(obj.name ?? '')),
        normalized_brand: normalizeBrand(String(obj.brand ?? '')),
      };
    });
  }

  private blockCandidates(candidates: Candidate[]): Map<string, Candidate[]> {
    const blocks = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = c.normalized_brand || '_unknown_';
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key)?.push(c);
    }
    return blocks;
  }

  private matchWithinBlock(
    block: Candidate[],
    minConfidence: number,
  ): [number, number, number, string][] {
    const matches: [number, number, number, string][] = [];

    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const a = block[i];
        const b = block[j];
        assertDefined(a);
        assertDefined(b);

        // Skip same-site pairs
        if (a.site === b.site) continue;

        // Exact normalized name match
        if (a.normalized_name === b.normalized_name && a.normalized_name.length > 3) {
          matches.push([a.idx, b.idx, CONFIDENCE_EXACT, 'exact']);
          continue;
        }

        // Token-sort fuzzy
        const nameScore = tokenSortRatio(a.normalized_name, b.normalized_name);
        let confidence = nameScore / 100;

        // URL slug boost
        const slugA = extractSlug(a.product_url);
        const slugB = extractSlug(b.product_url);
        if (slugA && slugB && slugA.length > 5) {
          const slugScore = tokenSortRatio(slugA, slugB);
          if (slugScore > 70) {
            confidence = confidence * 0.1 + (slugScore / 100) * 0.9;
          }
        }

        if (confidence >= minConfidence) {
          const method =
            confidence >= CONFIDENCE_HIGH
              ? 'fuzzy_high'
              : confidence >= CONFIDENCE_MEDIUM
                ? 'fuzzy_medium'
                : 'fuzzy_low';
          matches.push([a.idx, b.idx, Math.round(confidence * 100) / 100, method]);
        }
      }
    }

    return matches;
  }

  private buildEntities(
    candidates: Candidate[],
    matches: [number, number, number, string][],
  ): EntityRow[] {
    const uf = new UnionFind();
    const matchMap = new Map<number, { confidence: number; method: string }>();

    // Initialize all candidates
    for (const c of candidates) uf.find(c.idx);

    // Union matched pairs
    for (const [a, b, confidence, method] of matches) {
      uf.union(a, b);
      // Track highest confidence per candidate
      const existing = matchMap.get(a);
      if (!existing || confidence > existing.confidence) matchMap.set(a, { confidence, method });
      const existingB = matchMap.get(b);
      if (!existingB || confidence > existingB.confidence) matchMap.set(b, { confidence, method });
    }

    // Build entity rows
    const groups = uf.groups();
    const entities: EntityRow[] = [];

    for (const [root, members] of groups) {
      const rootCandidate = candidates[root];
      assertDefined(rootCandidate);
      const cid = canonicalId(rootCandidate.brand, rootCandidate.name);

      for (const idx of members) {
        const c = candidates[idx];
        assertDefined(c);
        const match = matchMap.get(idx) ?? { confidence: 1.0, method: 'unique' };
        entities.push({
          canonical_id: cid,
          canonical_name: rootCandidate.name,
          canonical_brand: rootCandidate.brand,
          site: c.site,
          name: c.name,
          brand: c.brand,
          category: c.category,
          price: c.price,
          product_url: c.product_url,
          confidence: match.confidence,
          match_method: match.method,
        });
      }
    }

    return entities;
  }

  private async writeEntities(entities: EntityRow[]): Promise<void> {
    await this.conn.run(`DROP TABLE IF EXISTS ${ENTITIES_TABLE}`);
    await this.conn.run(`
      CREATE TABLE ${ENTITIES_TABLE} (
        canonical_id VARCHAR, canonical_name VARCHAR, canonical_brand VARCHAR,
        site VARCHAR, name VARCHAR, brand VARCHAR, category VARCHAR,
        price DOUBLE, product_url VARCHAR,
        confidence DOUBLE, match_method VARCHAR
      )
    `);

    const BATCH = 5000;
    for (let i = 0; i < entities.length; i += BATCH) {
      const batch = entities.slice(i, i + BATCH);
      const values = batch
        .map((e) => {
          const v = (x: unknown) =>
            x === null || x === undefined
              ? 'NULL'
              : isString(x)
                ? `'${SQLFragments.escapeSql(String(x))}'`
                : String(x);
          return `(${v(e.canonical_id)}, ${v(e.canonical_name)}, ${v(e.canonical_brand)}, ${v(e.site)}, ${v(e.name)}, ${v(e.brand)}, ${v(e.category)}, ${v(e.price)}, ${v(e.product_url)}, ${v(e.confidence)}, ${v(e.match_method)})`;
        })
        .join(',\n');
      await this.conn.run(`INSERT INTO ${ENTITIES_TABLE} VALUES ${values}`);
    }

    await this.conn.run(
      `CREATE INDEX IF NOT EXISTS idx_ent_cid ON ${ENTITIES_TABLE}(canonical_id)`,
    );
    await this.conn.run(`CREATE INDEX IF NOT EXISTS idx_ent_name ON ${ENTITIES_TABLE}(name)`);
  }

  /** Find all retailer listings for a product. */
  async identifyProduct(query: string, limit = 20): Promise<EntityRow[]> {
    const kw = SQLFragments.escapeSql(query.toLowerCase());
    const result = await this.conn.runAndReadAll(`
      SELECT * FROM ${ENTITIES_TABLE}
      WHERE LOWER(canonical_name) LIKE '%${kw}%' OR LOWER(name) LIKE '%${kw}%'
      ORDER BY canonical_id, price ASC
      LIMIT ${limit}
    `);
    const columns = result.columnNames();
    return result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col !== undefined) obj[col] = row[i];
      }
      return obj as unknown as EntityRow; // safe-cast: DuckDB query result matches this row schema — columns are mapped by name
    });
  }
}
