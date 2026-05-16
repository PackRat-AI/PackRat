/**
 * Tiny display helpers used by API commands.
 *
 * Treaty hands back precisely-typed `data` for each endpoint, but the CLI's
 * tabular renderer accepts plain records. Rather than re-derive each row
 * shape with a Zod parser, we narrow once and centralise the unavoidable
 * type cast here so individual command files stay safe-cast-comment-free.
 */

import { isObject } from '@packrat/guards';

/** Narrow an unknown value to a `Record<string, unknown>` for keyed display. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? (value as Record<string, unknown>) : {}; // safe-cast: isObject() narrows to non-null object
}

/** Narrow an unknown value to an array of records (empty when not an array). */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

/** Pull `<key>` out of an unknown value, returning a record array. */
export function pickArray(value: unknown, key: string): Record<string, unknown>[] {
  const obj = asRecord(value);
  return Array.isArray(obj[key]) ? (obj[key] as unknown[]).map(asRecord) : []; // safe-cast: Array.isArray narrows the LHS
}
