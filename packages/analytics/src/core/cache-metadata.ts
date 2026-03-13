/**
 * Cache metadata persistence using Zod validation and Bun file I/O.
 */

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

export async function loadMetadata(cacheDir: string): Promise<CacheMetadataFile | null> {
  const file = Bun.file(metadataPath(cacheDir));
  if (!(await file.exists())) return null;

  const raw = await file.json();
  const result = MetadataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export async function saveMetadata(cacheDir: string, data: CacheMetadataFile): Promise<void> {
  const validated = MetadataSchema.parse(data);
  await Bun.write(metadataPath(cacheDir), JSON.stringify(validated, null, 2));
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
