#!/usr/bin/env bun
/**
 * Peer codegen path — quicktype-driven Swift types from the canonical Zod
 * schemas in `@packrat/schemas`.
 *
 * Sits alongside two other Swift codegen paths:
 *   1. `bun swift:codegen`  — Apple's swift-openapi-generator → API/{Client,Types}.swift
 *   2. `bun swift:models`   — custom YAML parser → Models/Generated.swift
 *   3. `bun swift:quicktype` (this script) → Models/QuicktypeGenerated.swift
 *
 * Why three? Each tool has different strengths:
 *   - swift-openapi-generator: full HTTP client + types from OpenAPI;
 *     requires `components.schemas` to be populated (Elysia `.model({})` registry).
 *   - generate-swift-models: lightweight response-shape structs the app uses
 *     in view-models; survives even when the OpenAPI spec lacks component refs.
 *   - quicktype: TS-direct → Swift; handles JSON Schema, raw JSON samples, or
 *     TypeScript interfaces. Useful when a schema lands in `@packrat/schemas`
 *     before the OpenAPI plugin picks it up, or for shapes that don't flow
 *     through HTTP (e.g., local on-device serialization payloads).
 *
 * Run from repo root:
 *   bun swift:quicktype
 *
 * Output: `apps/swift/Sources/PackRat/Models/QuicktypeGenerated.swift`
 *   — wrapped in a `Quicktype` namespace so it doesn't collide with the other
 *   two generators' top-level type names.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isObject } from '@packrat/guards';
import { FetchingJSONSchemaStore, InputData, JSONSchemaInput, quicktype } from 'quicktype-core';
import { parse as parseYaml } from 'yaml';
import { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as schemas from '../../../packages/schemas/src/index';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dir, '../Sources/PackRat/Models/QuicktypeGenerated.swift');
const OPENAPI_YAML_PATH = resolve(
  __dir,
  '../PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml',
);

// ─── Input mode selection ────────────────────────────────────────────────────
// Two input paths, picked at runtime:
//   1. **bundle** — if the OpenAPI YAML has `components.schemas` populated,
//      feed quicktype that single well-formed input. One source = better
//      chance of avoiding the per-schema namer bugs in quicktype-core.
//   2. **per-schema** — fallback: iterate every Zod schema in @packrat/schemas
//      and feed each as its own JSON Schema source. More fragile but works
//      even before the API routes register schemas via Elysia's `.model({})`.
//
// Override via `BUN_QUICKTYPE_INPUT=bundle|per-schema`. Default auto-detects.

type InputMode = 'bundle' | 'per-schema';

function detectInputMode(): InputMode {
  const override = process.env.BUN_QUICKTYPE_INPUT as InputMode | undefined;
  if (override === 'bundle' || override === 'per-schema') return override;
  if (!existsSync(OPENAPI_YAML_PATH)) return 'per-schema';
  try {
    const spec = parseYaml(readFileSync(OPENAPI_YAML_PATH, 'utf8'));
    const componentsSchemas = isObject(spec)
      ? (spec as { components?: { schemas?: Record<string, unknown> } }).components?.schemas
      : undefined;
    const count = componentsSchemas ? Object.keys(componentsSchemas).length : 0;
    return count > 0 ? 'bundle' : 'per-schema';
  } catch {
    return 'per-schema';
  }
}

const inputMode = detectInputMode();
console.log(`Input mode: ${inputMode}`);

// Top-level regex literals (lint rule: useTopLevelRegex). Captured once at
// module load so hot paths don't allocate a fresh RegExp on each invocation.
const FOUNDATION_IMPORT_RE = /^import Foundation/;
const INVALID_IDENT_ROOT_RE = /^[^A-Za-z_]/;
const WHITESPACE_RE = /\s/;

// ─── Schema discovery ────────────────────────────────────────────────────────
// `@packrat/schemas` exports a mix of Zod schemas, helper constants, and types.
// Filter to actual Zod types (have `_def` and `parse` and `safeParse`) and use
// the export name as the JSON-Schema title so quicktype emits clean Swift names.

function isZodSchema(value: unknown): value is ZodType {
  return value instanceof ZodType;
}

const zodEntries = Object.entries(schemas).filter((entry): entry is [string, ZodType] =>
  isZodSchema(entry[1]),
);

console.log(`Discovered ${zodEntries.length} Zod schemas in @packrat/schemas`);

// ─── Convert to JSON Schema + feed to quicktype ──────────────────────────────

// Pre-validate that every entry has a string-typed name — quicktype's Swift
// name normalizer assumes the source name and every property name are strings.
// One non-string slip causes the inscrutable `s.codePointAt is not a function`
// crash in quicktype/Swift/utils.js. Catch it here with a clear message.

const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

if (inputMode === 'bundle') {
  // Bundle mode: feed quicktype the entire openapi.yaml's components.schemas
  // as a single JSON Schema source. quicktype dedupes + names from the schema
  // keys. Works once Elysia's `.model({})` registry is wired (U7).
  const spec = parseYaml(readFileSync(OPENAPI_YAML_PATH, 'utf8')) as {
    components?: { schemas?: Record<string, unknown> };
  };
  const components = spec.components?.schemas ?? {};
  const wrapped = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'PackRatComponents',
    definitions: components,
    type: 'object',
    properties: Object.fromEntries(
      Object.keys(components).map((key) => [key, { $ref: `#/definitions/${key}` }]),
    ),
  };
  await schemaInput.addSource({
    name: 'PackRatComponents',
    schema: JSON.stringify(wrapped),
  });
  console.log(`Bundle mode: ${Object.keys(components).length} schemas from openapi.yaml`);
}

const skipped: Array<{ name: string; reason: string }> = [];

for (const [name, schema] of inputMode === 'per-schema' ? zodEntries : []) {
  // Skip names that aren't valid Swift identifier roots — anything that starts
  // with a digit, contains spaces, or is empty. quicktype could probably handle
  // some of these but it's better to keep names predictable.
  if (!name || INVALID_IDENT_ROOT_RE.test(name) || WHITESPACE_RE.test(name)) {
    skipped.push({ name, reason: 'invalid Swift identifier root' });
    continue;
  }
  try {
    const jsonSchema = zodToJsonSchema(schema, {
      name,
      target: 'jsonSchema7',
      $refStrategy: 'none',
    });
    // Some Zod features (e.g., recursive types, branded types) produce JSON
    // Schemas with non-string keys quicktype can't normalize. Add defensively
    // one-at-a-time so a single bad schema doesn't take the whole batch down.
    await schemaInput.addSource({
      name,
      schema: JSON.stringify(jsonSchema),
    });
  } catch (err) {
    skipped.push({ name, reason: err instanceof Error ? err.message : String(err) });
  }
}

if (skipped.length > 0) {
  console.log(`⚠️  Skipped ${skipped.length} schemas:`);
  for (const { name, reason } of skipped.slice(0, 10)) {
    console.log(`    • ${name}: ${reason}`);
  }
  if (skipped.length > 10) {
    console.log(`    ... and ${skipped.length - 10} more`);
  }
}

const inputData = new InputData();
inputData.addInput(schemaInput);

const result = await quicktype({
  inputData,
  lang: 'swift',
  rendererOptions: {
    // Match the existing Swift app's conventions
    'access-level': 'public',
    initializers: 'true',
    protocol: 'equatable',
    // Use Swift 5 syntax — the project targets iOS 17 / macOS 14 with Swift 5.9
    'swift-version': '5',
    'mutable-properties': 'false',
  },
});

// ─── Wrap output in `Quicktype` namespace to avoid type collisions ───────────
// The other codegen paths emit top-level `User`, `Pack`, etc. quicktype's
// output goes inside `enum Quicktype { ... }` so callers reach types via
// `Quicktype.User`, leaving the existing Generated.swift / Types.swift names
// uncontested.

const header = [
  '// AUTO-GENERATED by `bun swift:quicktype` — do not edit by hand.',
  '// Source: packages/schemas/src/*.ts (Zod → JSON Schema → quicktype → Swift).',
  '//',
  '// Wrapped in a `Quicktype` namespace so types do not collide with the parallel',
  '// codegen paths (swift-openapi-generator emits Components.Schemas.*, and the',
  '// legacy custom generator emits top-level structs in Models/Generated.swift).',
  '',
  'import Foundation',
  '',
  'public enum Quicktype {',
] satisfies readonly string[];

// Quicktype emits its own `import Foundation` at the top; strip it (we own the
// import order) and indent the rest by 4 spaces so it sits inside the namespace.
const renderedBody = result.lines
  .filter((line) => !FOUNDATION_IMPORT_RE.test(line))
  .map((line) => (line.length > 0 ? `    ${line}` : line))
  .join('\n');

const output = `${header.join('\n')}\n${renderedBody}\n}\n`;

writeFileSync(OUTPUT_PATH, output, 'utf8');

const lineCount = output.split('\n').length;
console.log(`✅ Wrote ${OUTPUT_PATH.replace(`${process.cwd()}/`, '')}`);
console.log(`   ${zodEntries.length} schemas → ${lineCount} lines of Swift`);

// Validate the file at least *looks* like valid Swift by checking for the
// closing brace of the namespace. Best-effort guard against truncated writes.
if (!output.trimEnd().endsWith('}')) {
  console.error('⚠️  Output does not end with a closing brace — possible truncation');
  process.exit(1);
}

// Stop the Bun process here; isObject is unused but imported defensively against
// future schema-detection edge cases. Mark for tree-shake-safe future use.
void isObject;
