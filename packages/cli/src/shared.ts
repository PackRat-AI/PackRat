/**
 * Shared CLI utilities: cache initialization, output formatting.
 */

import { assertDefined, CatalogCacheManager, env, LocalCacheManager } from '@packrat/analytics';
import { isNumber } from '@packrat/guards';
import chalk from 'chalk';
import Table from 'cli-table3';
import consola from 'consola';

let _cache: LocalCacheManager | null = null;

/** Get or initialize the cache manager (local or catalog based on ANALYTICS_MODE). */
export async function getCache(): Promise<LocalCacheManager> {
  if (_cache) return _cache;

  if (env().ANALYTICS_MODE === 'catalog') {
    _cache = new CatalogCacheManager();
  } else {
    _cache = new LocalCacheManager();
  }

  await _cache.connect();
  return _cache;
}

/** Ensure cache is populated, refreshing if needed. */
export async function ensureCache(forceRefresh = false): Promise<LocalCacheManager> {
  const cache = await getCache();

  if (env().ANALYTICS_MODE === 'catalog') {
    // Catalog mode — data lives in Iceberg, no local refresh needed
    return cache;
  }

  const stats = cache.getCacheStats();
  if (forceRefresh || stats.recordCount === 0) {
    consola.start('Refreshing cache from R2...');
    await cache.createLocalCache(forceRefresh);
    const updated = cache.getCacheStats();
    consola.success(
      `Cache ready: ${updated.recordCount.toLocaleString()} products from ${updated.sites.length} sites`,
    );
  }
  return cache;
}

/** Print an array of objects as a formatted CLI table. */
export function printTable(rows: unknown[], options?: { title?: string }): void {
  if (rows.length === 0) {
    consola.warn('No results found.');
    return;
  }

  const firstRow = rows[0];
  assertDefined(firstRow, 'rows[0] must be defined after length check');
  const keys = Object.keys(firstRow as Record<string, unknown>); // safe-cast: rows are plain objects from DuckDB/DB queries; unknown[] narrows to Record after length check

  const table = new Table({
    head: keys.map((k) => chalk.cyan(k)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(keys.map((k) => formatValue((row as Record<string, unknown>)[k]))); // safe-cast: rows are plain objects from DuckDB/DB queries; unknown[] narrows to Record for key access
  }

  if (options?.title) {
    console.log(`\n${chalk.bold(options.title)}`);
  }
  console.log(table.toString());
  console.log(chalk.dim(`${rows.length} rows`));
}

/** Print a key-value summary. */
export function printSummary(data: Record<string, unknown>, title?: string): void {
  if (title) console.log(`\n${chalk.bold(title)}`);

  const table = new Table({ style: { head: [], border: [] } });
  for (const [key, value] of Object.entries(data)) {
    table.push([chalk.cyan(key), formatValue(value)]);
  }
  console.log(table.toString());
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return chalk.dim('—');
  if (isNumber(val)) {
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  const str = String(val);
  return str.length > 60 ? `${str.slice(0, 57)}...` : str;
}
