/**
 * ID helpers for client-side creation. The API expects the client to supply
 * IDs (so offline-first stores can write before sync). The CLI runs under
 * Bun, so we use the native UUIDv7 generator — time-ordered for good B-tree
 * locality if/when the id becomes the actual PK on disk.
 */

export function shortId(prefix: string): string {
  return `${prefix}_${Bun.randomUUIDv7()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
