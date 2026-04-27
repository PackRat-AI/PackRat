import { sql } from 'drizzle-orm';
import { createReadOnlyDb } from '../db';

// ── SQL complexity patterns ───────────────────────────────────────────
const SQL_JOIN_KEYWORD = /\bjoin\b/g;

interface Params {
  query: string;
  limit: number;
  userId: number;
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

  const queryPromise = db.execute(sql.raw(finalQuery));

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
  return {
    success: true,
    data: resultWithRows.rows || [],
    rowCount: resultWithRows.rowCount,
    executionTime: executionTime,
    query: finalQuery,
  };
}

function isReadOnlyQuery(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery.startsWith('select')) return false;

  const forbiddenKeywords = [
    'insert',
    'update',
    'delete',
    'drop',
    'create',
    'alter',
    'truncate',
    'grant',
    'revoke',
    'commit',
    'rollback',
  ];

  return !forbiddenKeywords.some((keyword) => normalizedQuery.includes(keyword));
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
