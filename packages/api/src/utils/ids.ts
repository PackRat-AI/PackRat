/**
 * Server-side ID minting for the client/server ID split.
 *
 * Used in two positions during Phase 1 (docs/design/client-uuid-split.md):
 *   1. Fills the `id` text PK for inserts (legacy field, dropped in Phase 2).
 *   2. Fills `client_uuid` as the lean-caller default — MCP, CLI, and web
 *      callers don't have offline-first concerns and shouldn't have to mint.
 *
 * Distinct from any client-side ID generation (mobile uses nanoid,
 * CLI uses `uuid` v7). The format here happens to match nanoid charset
 * (URL-safe, ≤ 64 chars) so the DB CHECK constraint accepts both.
 */

const STRIP_HYPHENS = /-/g;

export function mintId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(STRIP_HYPHENS, '').slice(0, 12)}`;
}
