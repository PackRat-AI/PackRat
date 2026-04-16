import { z } from 'zod';

// Postgres int4 max; serial columns can't produce ids above this, so we reject
// anything larger up front rather than letting Postgres throw "integer out of
// range" (a 500) for what should be a clean 404.
const PG_INT4_MAX = 2_147_483_647;

// Accept only a digits-only string starting with 1-9 so `Number()`-accepted
// forms like `0x10`, `1e2`, `  42 `, `4.0`, and leading-zero `007` are rejected.
// Pipe into z.coerce.number for the int range check.
const integerIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .pipe(z.coerce.number().int().positive().max(PG_INT4_MAX));

/**
 * Parse a route param that must be a positive Postgres-int4 primary key.
 * Returns `null` for anything not in `1..PG_INT4_MAX`. Routes should treat
 * `null` as "not found" (404) — it can't match a serial id regardless.
 */
export function parseIntegerId(value: string | undefined): number | null {
  const result = integerIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
