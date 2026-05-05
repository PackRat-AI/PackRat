/**
 * Generates openapi.yaml for the PackRat API and writes it to
 * apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml (consumed
 * by the Swift openapi-generator SPM build plugin) and apps/swift/openapi.yaml
 * (the human-readable canonical copy).
 *
 * Run from the repo root:
 *   bun generate:openapi
 *
 * Requires the API package dependencies to be installed. No Cloudflare
 * Worker runtime or live server needed — Elysia builds the OpenAPI spec
 * entirely from route metadata at definition time.
 */

import { cors } from '@elysiajs/cors';
import { routes } from '@packrat/api/routes';
import { packratOpenApi } from '@packrat/api/utils/openapi';
import { Elysia } from 'elysia';

// Bare Elysia app — no CloudflareAdapter so handle() works in plain Bun/Node.
// Route handlers are never called; only schema metadata is read for spec generation.
const specApp = new Elysia()
  .use(cors())
  .use(packratOpenApi)
  .get('/', () => 'ok')
  .use(routes);

const response = await specApp.handle(new Request('http://localhost/doc'));

if (!response.ok) {
  throw new Error(`Spec fetch failed: ${response.status} ${response.statusText}`);
}

const spec = await response.json();
const json = JSON.stringify(spec, null, 2);

const repoRoot = new URL('../../..', import.meta.url).pathname;

const destinations = [
  `${repoRoot}apps/swift/openapi.yaml`,
  `${repoRoot}apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml`,
];

for (const dest of destinations) {
  await Bun.write(dest, json);
  console.log(`✅ Written → ${dest}`);
}

const paths = Object.keys((spec as { paths?: Record<string, unknown> }).paths ?? {}).length;
const schemas = Object.keys(
  (spec as { components?: { schemas?: Record<string, unknown> } }).components?.schemas ?? {},
).length;
console.log(`   Paths: ${paths}  |  Schemas: ${schemas}`);
