export type RawSqlResult<T> = T[] | { rows?: T[] | null } | null | undefined;

export function queryRows<T>(result: RawSqlResult<T>): T[] {
  if (Array.isArray(result)) return result;
  return result?.rows ?? [];
}

export function firstQueryRow<T>(result: RawSqlResult<T>): T | undefined {
  return queryRows(result)[0];
}
