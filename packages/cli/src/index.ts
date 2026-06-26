#!/usr/bin/env bun

/**
 * PackRat CLI — analytics (DuckDB) plus a thin Eden Treaty wrapper around the
 * PackRat API for user + admin operations.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';
import { safeJsonParse } from '@packrat/utils';
import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import { z } from 'zod';

const packageVersionSchema = z.object({
  version: z.string().min(1),
});

function getCliVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = resolve(currentDir, '../package.json');
    const packageJson = safeJsonParse(readFileSync(packageJsonPath, 'utf-8'), {
      strict: true,
    }) as unknown;
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
    description: 'PackRat CLI — gear analytics + API client',
  },
  subCommands: {
    // ── Session / API ──────────────────────────────────────────────────────
    auth: () => import('./commands/auth').then((m) => m.default),
    admin: () => import('./commands/admin').then((m) => m.default),
    packs: () => import('./commands/packs').then((m) => m.default),
    trips: () => import('./commands/trips').then((m) => m.default),
    catalog: () => import('./commands/catalog').then((m) => m.default),
    trails: () => import('./commands/trails').then((m) => m.default),
    weather: () => import('./commands/weather').then((m) => m.default),
    feed: () => import('./commands/feed').then((m) => m.default),
    templates: () => import('./commands/templates').then((m) => m.default),
    seasons: () => import('./commands/seasons').then((m) => m.default),
    user: () => import('./commands/user').then((m) => m.default),
    ai: () => import('./commands/ai').then((m) => m.default),

    // ── Local analytics (DuckDB-backed) ────────────────────────────────────
    search: () => import('./commands/search').then((m) => m.default),
    compare: () => import('./commands/compare').then((m) => m.default),
    trends: () => import('./commands/trends').then((m) => m.default),
    brand: () => import('./commands/brand').then((m) => m.default),
    category: () => import('./commands/category').then((m) => m.default),
    deals: () => import('./commands/deals').then((m) => m.default),
    sales: () => import('./commands/sales').then((m) => m.default),
    ratings: () => import('./commands/ratings').then((m) => m.default),
    lightweight: () => import('./commands/lightweight').then((m) => m.default),
    stats: () => import('./commands/stats').then((m) => m.default),
    summary: () => import('./commands/summary').then((m) => m.default),
    brands: () => import('./commands/brands').then((m) => m.default),
    prices: () => import('./commands/prices').then((m) => m.default),
    cache: () => import('./commands/cache').then((m) => m.default),
    specs: () => import('./commands/specs').then((m) => m.default),
    'build-specs': () => import('./commands/build-specs').then((m) => m.default),
    filter: () => import('./commands/filter').then((m) => m.default),
    'market-share': () => import('./commands/market-share').then((m) => m.default),
    resolve: () => import('./commands/resolve').then((m) => m.default),
    reviews: () => import('./commands/reviews').then((m) => m.default),
    images: () => import('./commands/images').then((m) => m.default),
    schema: () => import('./commands/schema').then((m) => m.default),
    export: () => import('./commands/export').then((m) => m.default),
  },
});

runMain(main).catch((error: unknown) => {
  if (error instanceof Error) {
    consola.error(error.message);
    if (nodeEnv.DEBUG) {
      consola.error(error.stack ?? '(no stack trace)');
    }
  } else {
    consola.error(String(error));
  }
  process.exitCode = 1;
});
