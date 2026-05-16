/**
 * Server-side ID minting for offline-first stores.
 *
 * The mobile / desktop stores supply their own IDs so Legend State can
 * write rows before sync — those client-supplied IDs are kept as-is.
 * Lean callers (MCP, CLI, web) can omit `id` and let the server mint one
 * with the right prefix here, which keeps the format stable across both
 * sources.
 *
 * Format: `<prefix>_<12-hex>`, e.g. `p_a1b2c3d4e5f6`.
 */

const STRIP_HYPHENS = /-/g;

const SHORT_LENGTH = 12;

export function mintId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(STRIP_HYPHENS, '').slice(0, SHORT_LENGTH)}`;
}
