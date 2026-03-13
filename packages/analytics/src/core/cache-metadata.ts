/**
 * Cache metadata persistence using Zod validation.
 * Uses node:fs which works under both Bun and Node (vitest).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DBConfig } from './constants';

const MetadataSchema = z.object({
  version: z.string().default(DBConfig.CACHE_VERSION),
  schema_version: z.string().default(DBConfig.SCHEMA_VERSION),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  record_count: z.number().int().nonnegative().default(0),
  sites: z.array(z.string()).default([]),
});

export type CacheMetadataFile = z.infer<typeof MetadataSchema>;

const METADATA_FILENAME = 'cache_metadata.json';
const DB_FILENAME = 'packrat_cache.duckdb';

export function metadataPath(cacheDir: string): string {
  return join(cacheDir, METADATA_FILENAME);
}

export function dbPath(cacheDir: string): string {
  return join(cacheDir, DB_FILENAME);
}

export function loadMetadata(cacheDir: string): CacheMetadataFile | null {
  const path = metadataPath(cacheDir);
  if (!existsSync(path)) return null;

  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const result = MetadataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function saveMetadata(cacheDir: string, data: CacheMetadataFile): void {
  const validated = MetadataSchema.parse(data);
  writeFileSync(metadataPath(cacheDir), JSON.stringify(validated, null, 2));
}

export function needsUpdate(metadata: CacheMetadataFile | null): boolean {
  if (!metadata?.updated_at) return true;
  const updated = new Date(metadata.updated_at);
  const hoursAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= DBConfig.CACHE_REFRESH_HOURS;
}

export function schemaIsCurrent(metadata: CacheMetadataFile | null): boolean {
  if (!metadata) return false;
  return metadata.schema_version === DBConfig.SCHEMA_VERSION;
}
