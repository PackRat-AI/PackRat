/**
 * Real handler-invocation tests for every tool registered by
 * `registerTrailTools`. Each test drives the registered handler through the
 * shared `_tool-harness` api stub and asserts both the tool's text result
 * and that the expected Treaty endpoint was hit.
 *
 * `get_trail` / `get_trail_geometry` call the API via Treaty's path-param
 * form `agent.api.user.trails({ osmId }).get()`, so the recorded call chain
 * includes a synthetic `()` segment after `trails`.
 */

import { describe, expect, it } from 'vitest';
import { registerTrailTools } from '../tools/trails';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** Does any recorded call end in `verb` and contain every segment? */
function hasCall(calls: ApiCall[], match: { verb: string; segments: string[] }): boolean {
  return calls.some(
    (c) => c.path.at(-1) === match.verb && match.segments.every((s) => c.path.includes(s)),
  );
}

describe('registerTrailTools — handler invocation', () => {
  it('packrat_search_trails GETs user/trails/search with query filters', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailTools(agent);
    const result = await getToolHandler(server, 'packrat_search_trails')(
      { q: 'ridge', lat: 40, lon: -105, radius: 25, sport: 'hiking', limit: 10, offset: 0 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const get = calls.find((c) => c.path.at(-1) === 'get' && c.path.includes('search'));
    expect(get?.path.includes('trails')).toBe(true);
    expect((get?.args[0] as { query?: { q?: string } })?.query?.q).toBe('ridge');
  });

  it('packrat_get_trail GETs user/trails by osm_id path param', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailTools(agent);
    const result = await getToolHandler(server, 'packrat_get_trail')(
      { osm_id: 'r123456' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'trails'] })).toBe(true);
    const param = calls.find((c) => c.path.at(-1) === 'trails');
    expect((param?.args[0] as { osmId?: string })?.osmId).toBe('r123456');
  });

  it('packrat_get_trail_geometry GETs user/trails/geometry by osm_id', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailTools(agent);
    const result = await getToolHandler(server, 'packrat_get_trail_geometry')(
      { osm_id: 'r999' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'trails', 'geometry'] })).toBe(true);
    const param = calls.find((c) => c.path.at(-1) === 'trails');
    expect((param?.args[0] as { osmId?: string })?.osmId).toBe('r999');
  });
});
