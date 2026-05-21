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

const spec = (await response.json()) as {
  paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
  components?: { schemas?: Record<string, unknown> };
};

// ---------------------------------------------------------------------------
// Post-processing passes for swift-openapi-generator compatibility.
//
// 1. `normaliseExclusiveBounds` — zod-to-json-schema emits draft-07-style
//    `exclusiveMinimum: true/false` alongside `minimum: N`. OpenAPI 3.1 and
//    the Apple generator expect the numeric form (`exclusiveMinimum: N`).
// 2. `unwrapOptionalAnyOf` — `.optional()` at a Zod schema root produces
//    `anyOf: [{not: {}}, S]`, which swift-openapi-generator rejects because
//    it cannot model the `not` keyword. We replace it with `S` — the Elysia
//    handler still treats the body as optional at runtime.
// 3. JSON-only request bodies — the OpenAPI plugin emits every requestBody
//    under `application/json`, `application/x-www-form-urlencoded`, and
//    `multipart/form-data`. swift-openapi-generator picks multipart for some
//    routes and generates a part-based enum that doesn't conform to
//    Encodable. We strip the non-JSON variants.
// 4. `backfilledResponses` — routes that don't declare a `response:` schema
//    fail codegen ("Operations contain at least one response"). We inject a
//    generic 200 placeholder so the client builds; specific routes can opt
//    in to typed responses by adding a `response:` clause later.
// ---------------------------------------------------------------------------

function normaliseExclusiveBounds(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) normaliseExclusiveBounds(child);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.exclusiveMinimum === true && typeof obj.minimum === 'number') {
    obj.exclusiveMinimum = obj.minimum;
    delete obj.minimum;
  } else if (obj.exclusiveMinimum === false) {
    delete obj.exclusiveMinimum;
  }
  if (obj.exclusiveMaximum === true && typeof obj.maximum === 'number') {
    obj.exclusiveMaximum = obj.maximum;
    delete obj.maximum;
  } else if (obj.exclusiveMaximum === false) {
    delete obj.exclusiveMaximum;
  }
  for (const value of Object.values(obj)) normaliseExclusiveBounds(value);
}

normaliseExclusiveBounds(spec);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;
let strippedAlternateContentTypes = 0;
if (spec.paths) {
  for (const methods of Object.values(spec.paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const method of HTTP_METHODS) {
      const op = methods[method] as
        | undefined
        | {
            requestBody?: { content?: Record<string, unknown> };
          };
      const content = op?.requestBody?.content;
      if (!content || typeof content !== 'object') continue;
      if (!('application/json' in content)) continue;
      for (const ct of Object.keys(content)) {
        if (ct !== 'application/json') {
          delete content[ct];
          strippedAlternateContentTypes++;
        }
      }
    }
  }
}

function unwrapOptionalAnyOf(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.map(unwrapOptionalAnyOf);
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.anyOf) && obj.anyOf.length === 2) {
    const [first, second] = obj.anyOf;
    const firstIsNot =
      first &&
      typeof first === 'object' &&
      'not' in first &&
      Object.keys((first as { not?: unknown }).not ?? {}).length === 0;
    if (firstIsNot && second && typeof second === 'object') {
      // Replace the anyOf with the second element's contents
      return unwrapOptionalAnyOf(second);
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = unwrapOptionalAnyOf(v);
  return out;
}

const cleaned = unwrapOptionalAnyOf(spec) as typeof spec;
Object.assign(spec, cleaned);

let backfilledResponses = 0;
if (spec.paths) {
  for (const [_path, methods] of Object.entries(spec.paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const method of HTTP_METHODS) {
      const op = methods[method];
      if (!op || typeof op !== 'object') continue;
      if (!op.responses || Object.keys(op.responses).length === 0) {
        op.responses = {
          '200': {
            description: 'Successful response',
            content: { 'application/json': { schema: {} } },
          },
        };
        backfilledResponses++;
      }
    }
  }
}

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

const paths = Object.keys(spec.paths ?? {}).length;
const schemas = Object.keys(spec.components?.schemas ?? {}).length;
console.log(
  `   Paths: ${paths}  |  Schemas: ${schemas}  |  Placeholder responses: ${backfilledResponses}  |  Non-JSON content types stripped: ${strippedAlternateContentTypes}`,
);
