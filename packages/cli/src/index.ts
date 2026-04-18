#!/usr/bin/env bun
/**
 * PackRat Analytics CLI — outdoor gear market intelligence.
 *
 * Built with citty (UnJS) for modern CLI ergonomics.
 */

import { defineCommand, runMain } from 'citty';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import consola from 'consola';
import { z } from 'zod';

const packageVersionSchema = z.object({
  version: z.string().min(1),
});

function getCliVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = resolve(currentDir, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as unknown;
    const parsed = packageVersionSchema.safeParse(packageJson);
    if (!parsed.success) {
      consola.warn('package.json is missing a valid string "version" field.');
      return '0.0.0';
    }
    return parsed.data.version;
  } catch (error) {
    consola.warn(`Unable to determine CLI version from package.json: ${String(error)}`);
    return '0.0.0';
  }
}

const main = defineCommand({
  meta: {
    name: 'packrat',
    version: getCliVersion(),
    description: 'Outdoor gear analytics powered by DuckDB',
  },
  subCommands: {
    // Core search & discovery
    search: () => import('./commands/search').then((m) => m.default),
    compare: () => import('./commands/compare').then((m) => m.default),
    trends: () => import('./commands/trends').then((m) => m.default),
    brand: () => import('./commands/brand').then((m) => m.default),
    category: () => import('./commands/category').then((m) => m.default),
    deals: () => import('./commands/deals').then((m) => m.default),

    // Ratings & weight
    sales: () => import('./commands/sales').then((m) => m.default),
    ratings: () => import('./commands/ratings').then((m) => m.default),
    lightweight: () => import('./commands/lightweight').then((m) => m.default),

    // Dashboards
    stats: () => import('./commands/stats').then((m) => m.default),
    summary: () => import('./commands/summary').then((m) => m.default),
    brands: () => import('./commands/brands').then((m) => m.default),
    prices: () => import('./commands/prices').then((m) => m.default),

    // Data management
    cache: () => import('./commands/cache').then((m) => m.default),

    // Specs
    specs: () => import('./commands/specs').then((m) => m.default),
    'build-specs': () => import('./commands/build-specs').then((m) => m.default),
    filter: () => import('./commands/filter').then((m) => m.default),

    // Advanced analytics
    'market-share': () => import('./commands/market-share').then((m) => m.default),

    // Enrichment & dedup
    resolve: () => import('./commands/resolve').then((m) => m.default),
    reviews: () => import('./commands/reviews').then((m) => m.default),
    images: () => import('./commands/images').then((m) => m.default),

    // Schema analysis
    schema: () => import('./commands/schema').then((m) => m.default),

    // Export
    export: () => import('./commands/export').then((m) => m.default),
  },
});

runMain(main).catch((error: unknown) => {
  if (error instanceof Error) {
    consola.error(error.message);
    if (process.env.DEBUG) {
      consola.error(error.stack ?? '(no stack trace)');
    }
  } else {
    consola.error(String(error));
  }
  process.exitCode = 1;
});
