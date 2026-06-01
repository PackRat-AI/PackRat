/**
 * CF Workflows instance-id construction.
 *
 * CF Workflows constrains instance IDs to `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`
 * (max 64 chars enforced by CF). The catalog ETL trigger builds the id from a
 * freeform request-body filename, which can contain a file extension, spaces,
 * punctuation, and leading non-alphanumerics — all of which violate that
 * pattern and get rejected with a 500.
 *
 * Lives in its own module (rather than inline in the route) so it can be unit
 * tested without importing the whole Elysia route graph.
 */

// Hoisted so the literals aren't re-allocated per call (lint/performance and
// the repo's no-raw-regex rule, which forbids inline regex literals).
const FILE_EXT_RE = /\.[^.]*$/;
const DISALLOWED_CHAR_RE = /[^A-Za-z0-9_-]/g;
const REPEATED_DASH_RE = /-+/g;
const EDGE_DASH_RE = /^-+|-+$/g;
const VALID_FIRST_CHAR_RE = /^[A-Za-z0-9_]/;

/**
 * Sanitize a filename into a valid CF Workflows instance ID.
 *
 * Strips the file extension, replaces any disallowed char with `-`, collapses
 * repeated `-`, trims leading/trailing `-`, guarantees the first char is
 * `[A-Za-z0-9_]` (prefixing `f-` otherwise), and caps the length at 100.
 */
export function buildInstanceId(filename: string): string {
  const withoutExt = filename.replace(FILE_EXT_RE, '');
  let id = withoutExt
    .replace(DISALLOWED_CHAR_RE, '-')
    .replace(REPEATED_DASH_RE, '-')
    .replace(EDGE_DASH_RE, '');
  // First char must be [A-Za-z0-9_]; an empty result also needs a valid prefix.
  if (id === '' || !VALID_FIRST_CHAR_RE.test(id)) {
    id = `f-${id}`;
  }
  return id.slice(0, 100);
}
