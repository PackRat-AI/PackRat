/**
 * Client-side ID helpers. Reserved for callers that want to supply their own
 * `clientUuid` for idempotent retries (e.g., a future `--client-uuid` flag).
 *
 * After Phase 1 of the client/server ID split, lean callers (this CLI, MCP,
 * web) generally let the server mint both `id` and `clientUuid` — see
 * docs/design/client-uuid-split.md §8 Q4. So `shortId` is intentionally
 * unused by current create commands; keep it available rather than reinvent.
 *
 * UUIDv7 is time-ordered for B-tree locality. The `uuid` npm package works
 * in any JS runtime — useful if this helper ever moves to MCP / Workers.
 */
import { v7 as uuidv7 } from 'uuid';

export function shortId(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
