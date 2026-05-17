/**
 * ID helpers for client-side creation. The API expects the client to supply
 * IDs (so offline-first stores can write before sync). UUIDv7 is time-ordered
 * for good B-tree locality if/when the id becomes the actual PK on disk.
 * Using the `uuid` npm package (not Bun.randomUUIDv7) so the same helper
 * works in any JS runtime — useful if this ever moves to MCP / Workers.
 */
import { v7 as uuidv7 } from 'uuid';

export function shortId(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
