/**
 * OAuth scope model + scope-based tool gating for the PackRat MCP Worker (U5).
 *
 * The PackRat MCP server advertises four coarse-grained scopes:
 *
 *   `mcp`        — legacy umbrella scope kept for back-compat with any
 *                  client registered before the scope split. Treated as
 *                  read-only (per the connector-store plan's scope-to-tool
 *                  table); pre-split clients never expected to perform
 *                  writes through the MCP surface.
 *   `mcp:read`   — read-only tools: get_*, list_*, search_*, find_*, plus
 *                  whoami / extract_* / preview_*.
 *   `mcp:write`  — read + write tools (create/update/delete/submit/...).
 *   `mcp:admin`  — read + write + admin tools, including the explicit
 *                  database-access overrides (`execute_sql_query`,
 *                  `get_database_schema`).
 *
 * The classifier is prefix-based: a tool's name decides which classification
 * bucket it falls into. The two explicit overrides handle tools whose names
 * don't match the prefix conventions but whose blast radius warrants admin
 * gating (per doc-review finding D3).
 *
 * Gating is enforced in `init()` on PackRatMCP: tools are registered
 * normally, then any whose visible-scopes don't intersect the granted
 * scopes get `.disable()`d. The SDK auto-emits
 * `notifications/tools/list_changed` on disable, so the client's
 * tool list stays in sync.
 *
 * Note: tool naming is U5-compatible with both the current `admin_*` shape
 * and the post-U7 `packrat_admin_*` shape — the classifier accepts either
 * prefix so this module doesn't need to land in lockstep with U7.
 */

import { SCOPES_SUPPORTED, type Scope } from './metadata';

// Re-export so consumers have a single import surface for scope strings.
export { SCOPES_SUPPORTED };
export type { Scope };

/** Classification of a tool by its blast radius. */
export type ToolClassification = 'read' | 'write' | 'admin';

// Tools whose names don't match the `*` prefix patterns below but whose
// blast radius warrants admin gating. Per the resolved D3 doc-review
// finding: `execute_sql_query` and `get_database_schema` are database-
// access tools and must not be exposed to mcp:read/mcp:write clients,
// regardless of what their prefixes suggest.
//
// U7 additions:
//  - `generate_pack_template_from_url`: the API gates on admin role; MCP
//    must hide the tool from non-admin sessions so the listed surface
//    matches what the user can actually call (the API still enforces).
//  - `create_app_pack_template`: the admin-only split of
//    `create_pack_template` (which used to take an `is_app_template`
//    boolean that switched between user-level and admin-only behaviour).
//    The user-level `create_pack_template` keeps its write classification;
//    the new `create_app_pack_template` is admin-only.
//
// Both the current names and the post-U7 `packrat_*` variants are listed
// so this set doesn't have to land in lockstep with U7's rename.
const ADMIN_OVERRIDES: ReadonlySet<string> = new Set([
  'execute_sql_query',
  'get_database_schema',
  'generate_pack_template_from_url',
  'create_app_pack_template',
  'packrat_execute_sql_query',
  'packrat_get_database_schema',
  'packrat_generate_pack_template_from_url',
  'packrat_create_app_pack_template',
]);

// Prefix bucket: read tools. Any tool whose name starts with one of these
// strings (case-sensitive, since MCP tool names are case-sensitive) is
// considered a read tool. The `packrat_` namespace prefix is U7's job;
// we accept both `get_pack` and `packrat_get_pack` here.
const READ_PREFIXES: readonly string[] = [
  'get_',
  'list_',
  'search_',
  'find_',
  'extract_',
  'preview_',
  'packrat_get_',
  'packrat_list_',
  'packrat_search_',
  'packrat_find_',
  'packrat_extract_',
  'packrat_preview_',
];

// Read tools whose names don't match a prefix. Keep this list narrow: these
// names do not mutate state, but their verbs are domain-specific enough that a
// prefix classifier would otherwise fail closed into the write bucket.
const READ_NAMES: ReadonlySet<string> = new Set([
  'whoami',
  'packrat_whoami',
  'packrat_analyze_pack_gaps',
  'packrat_analyze_pack_weight',
  'packrat_compare_gear_items',
  'packrat_semantic_gear_search',
  'packrat_similar_catalog_items',
  'packrat_similar_pack_items',
  'packrat_suggest_pack_items',
  'packrat_web_search',
]);

// Prefix bucket: admin tools. The classifier checks ADMIN_OVERRIDES first,
// then these prefixes. Anything matching is `admin`-classified regardless
// of its sub-prefix (e.g. `admin_list_users` is admin, not read).
const ADMIN_PREFIXES: readonly string[] = ['admin_', 'packrat_admin_'];

/**
 * Classify a tool by its name into one of three blast-radius buckets.
 *
 * Order of precedence:
 *   1. Explicit admin overrides (the two DB-access tools).
 *   2. Admin prefixes (`admin_*`, `packrat_admin_*`).
 *   3. Read prefixes (`get_*`, `list_*`, `search_*`, `find_*`, `extract_*`,
 *      `preview_*`, plus the same with the `packrat_` namespace).
 *   4. Explicit read names (`whoami`, `packrat_whoami`).
 *   5. Everything else → `write`.
 *
 * The `write` default is intentional: an unrecognized tool name is more
 * likely a new mutation than a new read, and over-gating a read tool fails
 * safe (the user just doesn't see it) whereas under-gating a write tool
 * lets an `mcp:read` client trigger side effects.
 */
export function classifyTool(name: string): ToolClassification {
  if (ADMIN_OVERRIDES.has(name)) return 'admin';
  for (const prefix of ADMIN_PREFIXES) {
    if (name.startsWith(prefix)) return 'admin';
  }
  for (const prefix of READ_PREFIXES) {
    if (name.startsWith(prefix)) return 'read';
  }
  if (READ_NAMES.has(name)) return 'read';
  return 'write';
}

/**
 * The set of scopes that authorize a given tool.
 *
 * The returned set is a *positive* list — at least one of these scopes
 * must be present in the granted scopes for the tool to be visible.
 *
 *   read   tools → ['mcp', 'mcp:read', 'mcp:write', 'mcp:admin']
 *   write  tools → ['mcp:write', 'mcp:admin']
 *   admin  tools → ['mcp:admin']
 *
 * `mcp` (the umbrella) authorizes only reads, per the scope-to-tool table
 * in the connector-readiness plan: pre-split clients only ever called read
 * tools, so it would be a quiet privilege escalation to suddenly let them
 * write or administer. New clients should request explicit scopes.
 */
export function visibleScopesForTool(name: string): readonly Scope[] {
  const c = classifyTool(name);
  if (c === 'admin') return ['mcp:admin'];
  if (c === 'write') return ['mcp:write', 'mcp:admin'];
  // read: include the umbrella scope for back-compat.
  return ['mcp', 'mcp:read', 'mcp:write', 'mcp:admin'];
}

/**
 * Partial-applied predicate: given the scopes granted at OAuth time,
 * returns `(toolName) => boolean` — true when the tool should be visible.
 *
 * Used by PackRatMCP.init() to walk the registered tools and disable any
 * the granted scopes don't authorize.
 *
 * An empty grant returns a predicate that hides every tool — fail-closed.
 * A grant that includes only unknown strings is treated the same way
 * (the intersection is empty).
 */
export function getVisibleTools(grantedScopes: readonly string[]): (toolName: string) => boolean {
  const granted = new Set(grantedScopes);
  return (toolName: string): boolean => {
    const visible = visibleScopesForTool(toolName);
    for (const scope of visible) {
      if (granted.has(scope)) return true;
    }
    return false;
  };
}
