import { toBigInt } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import { sql } from 'drizzle-orm';
import { createReadOnlyDb } from '../db';

// ── SQL complexity patterns ───────────────────────────────────────────
const SQL_JOIN_KEYWORD = /\bjoin\b/g;

// Mutating keywords rejected by isReadOnlyQuery. These are matched on WORD
// BOUNDARIES, not as bare substrings: a plain `includes('delete')` also
// matches the `deleted` column that every soft-deleted table carries, so the
// correct `SELECT ... WHERE deleted = false` was always rejected as a
// mutation. `\b` still catches the real statements regardless of surrounding
// whitespace, newlines, parens or casing (the input is lowercased first).
const FORBIDDEN_KEYWORD_PATTERNS = Object.freeze([
  /\binsert\b/,
  /\bupdate\b/,
  /\bdelete\b/,
  /\bdrop\b/,
  /\bcreate\b/,
  /\balter\b/,
  /\btruncate\b/,
  /\bgrant\b/,
  /\brevoke\b/,
  /\bcommit\b/,
  /\brollback\b/,
] as const);

// Post-execution result-byte budget. A bad AI-generated query
// (`SELECT * FROM catalog_items LIMIT 1000`) can otherwise ship ~100 MB
// to the Worker + LLM context. This guard is post-execution — the DB read
// still happens, so it does NOT bound Neon-side compute or DB→Worker
// egress (that's the projection-discipline work in U2-U6 + U9). What it
// DOES bound is Worker→client egress + LLM context cost per call.
// Hardening of the executeSql tool surface (SQL-injection bypass in
// isReadOnlyQuery, table allowlist for auth/session tables) is deferred
// to a follow-on hardening plan — see brainstorm's Deferred section.
const BYTE_BUDGET_BYTES = 1_048_576; // 1 MB

// JSON.stringify throws on BigInt. Neon's HTTP driver returns Postgres
// `int8` / `bigint` / `COUNT(*)` results as JS BigInt by default. The
// replacer is inlined at every stringify call (rather than named) to
// keep no-owned-max-params happy — the 2-param shape is JSON.stringify's
// callback contract, not an owned API.
const serializeBigInt = (value: unknown): string | unknown => {
  const big = toBigInt(value);
  return big !== undefined ? big.toString() : value;
};

const jsonByteLength = (json: string): number => new TextEncoder().encode(json).length;

interface Params {
  query: string;
  limit: number;
  userId: string;
}

export async function executeSqlAiTool(params: Params) {
  const db = createReadOnlyDb();
  const { query, limit = 100 } = params;

  if (!isReadOnlyQuery(query)) {
    return { error: 'Only SELECT queries are allowed', query };
  }

  const complexityCheck = validateQueryComplexity(query);
  if (!complexityCheck.valid) {
    return { error: complexityCheck.error, query };
  }

  let finalQuery = query.trim();
  if (!finalQuery.toLowerCase().includes('limit')) {
    finalQuery += ` LIMIT ${Math.min(limit, 1000)}`;
  }

  const startTime = Date.now();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), 30000),
  );

  const queryPromise = db.tag('aiTool.executeSql').execute(sql.raw(finalQuery));

  let result: unknown;
  try {
    result = await Promise.race([queryPromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof Error && err.message === 'Query timeout') {
      return { error: 'Query timeout', query: finalQuery };
    }
    throw err;
  }
  const executionTime = Date.now() - startTime;

  const resultWithRows = result as { rows?: unknown[]; rowCount?: number };
  const rows = resultWithRows.rows ?? [];

  // Byte-budget check: measure serialized result size and reject when over
  // the cap with an actionable error so the AI agent can re-issue a
  // narrower query.
  const serializedRows = safeJsonStringify(rows, (_key, value) => serializeBigInt(value));
  const byteCount = jsonByteLength(serializedRows);
  if (byteCount > BYTE_BUDGET_BYTES) {
    return {
      error: `Result exceeds ${BYTE_BUDGET_BYTES.toLocaleString()} byte budget (got ${byteCount.toLocaleString()}). Project specific columns or reduce limit.`,
      query: finalQuery,
      byteCount,
    };
  }

  return {
    success: true,
    data: safeJsonParse(serializedRows, { strict: true }),
    rowCount: resultWithRows.rowCount,
    executionTime: executionTime,
    byteCount,
    query: finalQuery,
  };
}

function isReadOnlyQuery(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery.startsWith('select')) return false;

  return !FORBIDDEN_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalizedQuery));
}

function validateQueryComplexity(query: string): { valid: boolean; error?: string } {
  const normalizedQuery = query.toLowerCase();
  const joinCount = (normalizedQuery.match(SQL_JOIN_KEYWORD) || []).length;
  if (joinCount > 5) {
    return { valid: false, error: 'Query too complex: maximum 5 joins allowed' };
  }
  if (normalizedQuery.includes('cross join')) {
    return { valid: false, error: 'CROSS JOIN operations are not allowed' };
  }
  return { valid: true };
}
