/**
 * Parse a route param that must be a positive integer (e.g. serial primary key).
 * Returns the parsed integer, or `null` if the param is missing, non-numeric,
 * a float, negative, or zero. Routes should treat `null` as "not found" (404),
 * matching Postgres behavior where such a row cannot exist.
 */
export function parseIntegerId(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
