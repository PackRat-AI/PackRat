import type { Context } from 'hono';
import { sql } from 'drizzle-orm';
import { createReadOnlyDb } from '../db';

interface Params {
  query: string;
  limit: number;
  c: Context;
  userId: number;
}

export async function executeSqlAiTool(params: Params) {
  const db = createReadOnlyDb(params.c);
  const { query, limit = 100 } = params;

  // Validate read-only
  if (!isReadOnlyQuery(query)) {
    return {
      error: 'Only SELECT queries are allowed',
      query,
    };
  }

  // Validate complexity
  const complexityCheck = validateQueryComplexity(query);
  if (!complexityCheck.valid) {
    return {
      error: complexityCheck.error,
      query,
    };
  }

  // Add LIMIT if not already present
  let finalQuery = query.trim();
  if (!finalQuery.toLowerCase().includes('limit')) {
    finalQuery += ` LIMIT ${Math.min(limit, 1000)}`;
  }

  // Execute with timeout
  const startTime = Date.now();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), 30000),
  );

  const queryPromise = db.execute(sql.raw(finalQuery));

  const result = await Promise.race([queryPromise, timeoutPromise]);
  const executionTime = Date.now() - startTime;

  return {
    success: true,
    data: result.rows,
    rowCount: result.rowCount,
    executionTime: executionTime,
    query: finalQuery,
  };
}

// Validation helpers
function isReadOnlyQuery(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  // Must start with SELECT
  if (!normalizedQuery.startsWith('select')) {
    return false;
  }

  // Check for forbidden keywords
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

  // Count joins (basic complexity check)
  const joinCount = (normalizedQuery.match(/\bjoin\b/g) || []).length;
  if (joinCount > 5) {
    return { valid: false, error: 'Query too complex: maximum 5 joins allowed' };
  }

  // Check for potentially expensive operations
  if (normalizedQuery.includes('cross join')) {
    return { valid: false, error: 'CROSS JOIN operations are not allowed' };
  }

  return { valid: true };
}
