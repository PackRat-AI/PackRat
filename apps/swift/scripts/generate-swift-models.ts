#!/usr/bin/env bun

/**
 * Generates Swift model structs from the OpenAPI spec.
 * Run: bun swift:models
 * Output: Sources/PackRat/Models/Generated.swift
 *
 * Covers response-shape schemas only — request bodies stay hand-written
 * in the per-feature model files so they can carry custom fields / defaults.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// ── Constants ─────────────────────────────────────────────────────────────────

const NON_ALPHANUMERIC_SPACE = /[^a-zA-Z0-9 ]/g;
const WHITESPACE = /\s+/;

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(__dir, '../PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml');
const outPath = resolve(__dir, '../Sources/PackRat/Models/Generated.swift');

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Schemas to skip — these are request bodies or envelope types
 * that are better kept hand-written so they can carry custom defaults.
 */
const SKIP_SCHEMAS = new Set([
  // Custom decoder needed (server may return plain array):
  'CatalogSearchResponse',
  // Request bodies:
  'CreatePackRequest',
  'UpdatePackRequest',
  'CreatePackItemRequest',
  'UpdatePackItemRequest',
  'CreateTripRequest',
  'UpdateTripRequest',
  'UpdateUserRequest',
  'LoginRequest',
  'RegisterRequest',
  'AuthResponse',
  'CreatePostRequest',
  'CreateCommentRequest',
  'ErrorResponse',
]);

// ── Type helpers ──────────────────────────────────────────────────────────────

interface OAPIProperty {
  type?: string;
  format?: string;
  $ref?: string;
  nullable?: boolean;
  enum?: string[];
  items?: OAPIProperty;
}

interface OAPISchema {
  type?: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, OAPIProperty>;
  required?: string[];
  nullable?: boolean;
  items?: OAPIProperty;
  $ref?: string;
}

function refName(ref: string): string {
  return ref.replace('#/components/schemas/', '');
}

function swiftType(prop: OAPIProperty, required: boolean): string {
  let base: string;

  if (prop.$ref) {
    base = refName(prop.$ref);
  } else if (prop.type === 'array') {
    const itemType = prop.items ? swiftType(prop.items, true) : 'AnyCodable';
    base = `[${itemType}]`;
  } else if (prop.type === 'integer') {
    base = 'Int';
  } else if (prop.type === 'number') {
    base = 'Double';
  } else if (prop.type === 'boolean') {
    base = 'Bool';
  } else {
    // string (including date-time, email, uri, etc.)
    base = 'String';
  }

  const optional = !required || prop.nullable;
  return optional ? `${base}?` : base;
}

function hasId(properties: Record<string, OAPIProperty>): boolean {
  return 'id' in properties;
}

// ── Enum generation ───────────────────────────────────────────────────────────

function generateEnum(name: string, values: string[]): string {
  const cases = values
    .map((v) => {
      // turn "water sports" → case waterSports = "water sports"
      const raw = v;
      const identifier = v
        .replace(NON_ALPHANUMERIC_SPACE, '')
        .split(WHITESPACE)
        .map((w, i) =>
          i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join('');
      const needsRaw = identifier !== v;
      return needsRaw ? `    case ${identifier} = "${raw}"` : `    case ${identifier}`;
    })
    .join('\n');

  return [`enum ${name}: String, Codable, CaseIterable, Sendable {`, cases, `}`].join('\n');
}

// ── Struct generation ─────────────────────────────────────────────────────────

function generateStruct(name: string, schema: OAPISchema): string {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  const conformances = ['Codable', hasId(props) ? 'Identifiable' : null, 'Sendable']
    .filter(Boolean)
    .join(', ');

  const fields = Object.entries(props)
    .map(([key, prop]) => {
      const type = swiftType(prop, required.has(key));
      return `    let ${key}: ${type}`;
    })
    .join('\n');

  return [`struct ${name}: ${conformances} {`, fields || '    // no properties', `}`].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = readFileSync(specPath, 'utf8');
const spec = parse(raw) as { components: { schemas: Record<string, OAPISchema> } };
const schemas = spec.components?.schemas ?? {};

const sections: string[] = [];

for (const [name, schema] of Object.entries(schemas)) {
  if (SKIP_SCHEMAS.has(name)) continue;

  if (schema.enum && schema.type === 'string') {
    sections.push(generateEnum(name, schema.enum));
  } else if (schema.type === 'object' || schema.properties) {
    sections.push(generateStruct(name, schema));
  }
  // skip anything else (e.g. inline primitives)
}

const output = `// @generated — DO NOT EDIT
// Run \`bun swift:models\` to regenerate from openapi.yaml
// Request body types and computed extensions live in the per-feature model files.

import Foundation

${sections.join('\n\n')}
`;

writeFileSync(outPath, output, 'utf8');
console.log(`✓ Generated ${sections.length} types → ${outPath.replace(`${process.cwd()}/`, '')}`);
