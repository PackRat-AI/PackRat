/**
 * Unit tests for `scopes.ts` — the U5 scope-based admin gating model.
 *
 * Coverage targets the three load-bearing invariants:
 *
 *   1. `classifyTool` puts every tool in the right bucket. Includes a
 *      regression test for the two explicit DB-access overrides (per
 *      doc-review D3) — `execute_sql_query` and `get_database_schema`
 *      must NOT be exposed to mcp:read/mcp:write clients regardless of
 *      what their `get_` / `execute_` prefixes might suggest.
 *
 *   2. `visibleScopesForTool` produces the correct positive-list set
 *      with the proper inheritance: mcp:admin sees admin+write+read,
 *      mcp:write sees write+read, mcp:read sees read only, and the
 *      legacy `mcp` umbrella sees read-only (per the scope-to-tool
 *      table in the connector-store plan).
 *
 *   3. `getVisibleTools` partial application produces a predicate that
 *      enforces visibility correctly, including the fail-closed
 *      behaviour for empty grants.
 *
 * The tests also cover the unknown-tool default — defaulting unknown
 * tools to `write` is intentional and tested here so a future refactor
 * that flips the default to `read` regresses visibly.
 */

import { describe, expect, it } from 'vitest';
import { classifyTool, getVisibleTools, SCOPES_SUPPORTED, visibleScopesForTool } from '../scopes';

describe('classifyTool', () => {
  it('classifies admin_* tools as admin', () => {
    expect(classifyTool('admin_stats')).toBe('admin');
    expect(classifyTool('admin_list_users')).toBe('admin');
    expect(classifyTool('admin_hard_delete_user')).toBe('admin');
    expect(classifyTool('admin_analytics_growth')).toBe('admin');
  });

  it('classifies packrat_admin_* tools as admin (post-U7 naming)', () => {
    expect(classifyTool('packrat_admin_stats')).toBe('admin');
    expect(classifyTool('packrat_admin_hard_delete_user')).toBe('admin');
  });

  it('classifies the two explicit DB-access overrides as admin (D3)', () => {
    // execute_sql_query starts with `execute_` (a read-ish prefix?) and
    // get_database_schema starts with `get_` — but both expose raw DB
    // access and must NOT be available to mcp:read or mcp:write clients.
    expect(classifyTool('execute_sql_query')).toBe('admin');
    expect(classifyTool('get_database_schema')).toBe('admin');
  });

  it('classifies the post-U7 packrat_ variants of the DB-access overrides as admin', () => {
    expect(classifyTool('packrat_execute_sql_query')).toBe('admin');
    expect(classifyTool('packrat_get_database_schema')).toBe('admin');
  });

  it('classifies get_*/list_*/search_*/find_* tools as read', () => {
    expect(classifyTool('get_pack')).toBe('read');
    expect(classifyTool('list_packs')).toBe('read');
    expect(classifyTool('search_trails')).toBe('read');
    expect(classifyTool('find_pack_by_id')).toBe('read');
  });

  it('classifies extract_* and preview_* tools as read', () => {
    expect(classifyTool('extract_url_content')).toBe('read');
    expect(classifyTool('preview_pack_template')).toBe('read');
  });

  it('classifies the explicit non-prefixed read tool `whoami` as read', () => {
    expect(classifyTool('whoami')).toBe('read');
    expect(classifyTool('packrat_whoami')).toBe('read');
  });

  it('classifies the post-U7 packrat_get_*/packrat_list_* variants as read', () => {
    expect(classifyTool('packrat_get_pack')).toBe('read');
    expect(classifyTool('packrat_list_packs')).toBe('read');
    expect(classifyTool('packrat_search_trails')).toBe('read');
  });

  it('classifies create/update/delete/submit tools as write (default bucket)', () => {
    expect(classifyTool('create_pack')).toBe('write');
    expect(classifyTool('update_pack')).toBe('write');
    expect(classifyTool('delete_pack')).toBe('write');
    expect(classifyTool('submit_trail_condition')).toBe('write');
  });

  it('defaults unknown tool names to write (fail-safe — over-gate reads, under-gate writes is the worse failure)', () => {
    expect(classifyTool('totally_made_up_tool')).toBe('write');
    expect(classifyTool('logout')).toBe('write');
    expect(classifyTool('packrat_logout')).toBe('write');
  });

  it('is case-sensitive on prefixes (MCP tool names are case-sensitive)', () => {
    // `Get_Pack` doesn't match the lowercase `get_` prefix, so it falls
    // through to the write default. This is a regression guard: if a
    // future refactor lowercases the prefix check, a malformed tool
    // name could be silently promoted into the read bucket.
    expect(classifyTool('Get_Pack')).toBe('write');
    expect(classifyTool('ADMIN_STATS')).toBe('write');
  });
});

describe('visibleScopesForTool — scope inheritance', () => {
  it('exposes admin tools only on mcp:admin', () => {
    const scopes = visibleScopesForTool('admin_stats');
    expect(scopes).toEqual(['mcp:admin']);
  });

  it('exposes write tools on mcp:write OR mcp:admin (no umbrella)', () => {
    const scopes = visibleScopesForTool('create_pack');
    expect(scopes).toEqual(['mcp:write', 'mcp:admin']);
    // Importantly: the legacy `mcp` umbrella does NOT authorize writes.
    expect(scopes).not.toContain('mcp');
    expect(scopes).not.toContain('mcp:read');
  });

  it('exposes read tools on every scope including the legacy umbrella', () => {
    const scopes = visibleScopesForTool('get_pack');
    expect(scopes).toEqual(['mcp', 'mcp:read', 'mcp:write', 'mcp:admin']);
  });

  it('exposes whoami on every scope (read classification)', () => {
    const scopes = visibleScopesForTool('whoami');
    expect(scopes).toContain('mcp');
    expect(scopes).toContain('mcp:read');
  });

  it('exposes execute_sql_query only on mcp:admin (D3 override)', () => {
    expect(visibleScopesForTool('execute_sql_query')).toEqual(['mcp:admin']);
    expect(visibleScopesForTool('get_database_schema')).toEqual(['mcp:admin']);
  });

  it('only returns scope strings that appear in SCOPES_SUPPORTED', () => {
    // Defensive: if a future change accidentally references a scope
    // string that's not in the canonical list, the AS metadata will
    // drift from gating behaviour and clients won't be able to ask
    // for the scope they need.
    const supported = new Set(SCOPES_SUPPORTED);
    for (const name of ['get_pack', 'create_pack', 'admin_stats', 'execute_sql_query']) {
      for (const scope of visibleScopesForTool(name)) {
        expect(supported.has(scope)).toBe(true);
      }
    }
  });
});

describe('getVisibleTools — partial-applied predicate', () => {
  it('with mcp:read only — shows read tools, hides write/admin', () => {
    const visible = getVisibleTools(['mcp:read']);
    expect(visible('get_pack')).toBe(true);
    expect(visible('list_packs')).toBe(true);
    expect(visible('whoami')).toBe(true);
    expect(visible('create_pack')).toBe(false);
    expect(visible('admin_stats')).toBe(false);
    expect(visible('execute_sql_query')).toBe(false);
  });

  it('with mcp:write — shows read + write, hides admin', () => {
    const visible = getVisibleTools(['mcp:write']);
    expect(visible('get_pack')).toBe(true);
    expect(visible('create_pack')).toBe(true);
    expect(visible('update_pack')).toBe(true);
    expect(visible('delete_pack')).toBe(true);
    expect(visible('admin_stats')).toBe(false);
    expect(visible('execute_sql_query')).toBe(false);
  });

  it('with mcp:admin — shows everything (read + write + admin + D3 overrides)', () => {
    const visible = getVisibleTools(['mcp:admin']);
    expect(visible('get_pack')).toBe(true);
    expect(visible('create_pack')).toBe(true);
    expect(visible('admin_stats')).toBe(true);
    expect(visible('admin_hard_delete_user')).toBe(true);
    expect(visible('execute_sql_query')).toBe(true);
    expect(visible('get_database_schema')).toBe(true);
  });

  it('with the legacy mcp umbrella — shows read only (back-compat)', () => {
    const visible = getVisibleTools(['mcp']);
    expect(visible('get_pack')).toBe(true);
    expect(visible('list_packs')).toBe(true);
    expect(visible('whoami')).toBe(true);
    expect(visible('create_pack')).toBe(false);
    expect(visible('admin_stats')).toBe(false);
  });

  it('with multiple scopes — union of authorized tools', () => {
    const visible = getVisibleTools(['mcp:read', 'mcp:admin']);
    expect(visible('get_pack')).toBe(true);
    expect(visible('create_pack')).toBe(true); // mcp:admin authorizes writes
    expect(visible('admin_stats')).toBe(true);
  });

  it('with empty grant — hides every tool (fail-closed)', () => {
    const visible = getVisibleTools([]);
    expect(visible('get_pack')).toBe(false);
    expect(visible('whoami')).toBe(false);
    expect(visible('create_pack')).toBe(false);
    expect(visible('admin_stats')).toBe(false);
  });

  it('with only unknown scope strings — hides every tool (fail-closed)', () => {
    // An OAuth client that asked for a non-existent scope shouldn't get
    // anything, even though `SCOPES_SUPPORTED` would have rejected it.
    // The predicate itself is the final gate.
    const visible = getVisibleTools(['something-else', 'mcp:fake']);
    expect(visible('get_pack')).toBe(false);
    expect(visible('admin_stats')).toBe(false);
  });

  it('treats unknown tool names per their classification (write by default)', () => {
    // Unknown tool names fall into the `write` bucket, so they're visible
    // to mcp:write and mcp:admin but not mcp:read or the umbrella.
    const readOnly = getVisibleTools(['mcp:read']);
    const writeUp = getVisibleTools(['mcp:write']);
    expect(readOnly('mystery_tool')).toBe(false);
    expect(writeUp('mystery_tool')).toBe(true);
  });
});
