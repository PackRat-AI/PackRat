/**
 * ID helpers for client-side creation. The API mostly expects the client to
 * supply IDs (so offline-first stores can write before sync). Match the format
 * used by the mobile app / MCP: `<prefix>_<12-hex>`.
 */

const STRIP_HYPHENS = /-/g;

export function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(STRIP_HYPHENS, '').slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
