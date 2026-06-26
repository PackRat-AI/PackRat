/**
 * Real handler-invocation tests for every tool registered by
 * `registerAiTools`. Each test drives the registered handler through the
 * shared `_tool-harness` api stub and asserts both the tool's text result
 * and that the expected Treaty endpoint was hit.
 */

import { describe, expect, it } from 'vitest';
import { registerAiTools } from '../tools/ai';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** Does any recorded call end in `verb` and contain every segment? */
function hasCall(calls: ApiCall[], match: { verb: string; segments: string[] }): boolean {
  return calls.some(
    (c) => c.path.at(-1) === match.verb && match.segments.every((s) => c.path.includes(s)),
  );
}

describe('registerAiTools — handler invocation', () => {
  it('packrat_web_search GETs user/ai/web-search', async () => {
    const { agent, server, calls } = makeAgent();
    registerAiTools(agent);
    const result = await getToolHandler(server, 'packrat_web_search')(
      { query: 'best ultralight tent 2026' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'ai', 'web-search'] })).toBe(true);
  });

  it('packrat_execute_sql_query POSTs user/ai/execute-sql with query + limit', async () => {
    const { agent, server, calls } = makeAgent();
    registerAiTools(agent);
    const result = await getToolHandler(server, 'packrat_execute_sql_query')(
      { query: 'SELECT id FROM packs LIMIT 5', limit: 25 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect(post?.path.includes('execute-sql')).toBe(true);
    expect((post?.args[0] as { query?: string; limit?: number })?.query).toBe(
      'SELECT id FROM packs LIMIT 5',
    );
    expect((post?.args[0] as { query?: string; limit?: number })?.limit).toBe(25);
  });

  it('packrat_get_database_schema GETs user/ai/db-schema', async () => {
    const { agent, server, calls } = makeAgent();
    registerAiTools(agent);
    const result = await getToolHandler(server, 'packrat_get_database_schema')({}, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'ai', 'db-schema'] })).toBe(true);
  });
});
