// Postgres int4 max; serial columns can't produce ids above this, so we reject
// anything larger up front rather than letting Postgres throw "integer out of
// range" (a 500) for what should be a clean 404.
const PG_INT4_MAX = 2_147_483_647;

/**
 * Parse a route param that must be a positive integer (e.g. serial primary key).
 * Accepts only a digits-only string (`/^\d+$/`) so that `Number()`-accepted
 * forms like `0x10`, `1e2`, `  42 `, or `4.0` are rejected. Returns `null` for
 * anything that isn't a clean `1..PG_INT4_MAX` integer. Routes should treat
 * `null` as "not found" (404).
 */
export function parseIntegerId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  if (n <= 0 || n > PG_INT4_MAX) return null;
  return n;
}
