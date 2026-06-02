/**
 * Unit tests for every tool handler registered by
 * `registerTrailConditionTools`.
 *
 * Strategy (shared `_tool-harness`): build a real `McpServer` + stub agent
 * whose `api` is a recording Proxy that resolves every HTTP verb to a
 * success-shaped Treaty result. We register the trail-condition tools, pull
 * each handler from the SDK registry, invoke it with valid args (real enum
 * values from `../enums`), then assert both that a non-empty text block came
 * back AND that the expected Treaty endpoint (specific path segments +
 * terminal verb) was actually hit.
 */

import { describe, expect, it } from 'vitest';
import { CrossingDifficulty, TrailCondition, TrailSurface } from '../enums';
import { registerTrailConditionTools } from '../tools/trail-conditions';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

describe('registerTrailConditionTools', () => {
  it('packrat_get_trail_conditions → GETs user.trail-conditions with query', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_get_trail_conditions');

    const result = await handler({ trail_name: 'PCT', limit: 20 }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const getCall = calls.find((c) => c.path.at(-1) === 'get');
    expect(getCall?.path).toEqual(['user', 'trail-conditions', 'get']);
    expect(getCall?.args[0]).toEqual({ query: { trailName: 'PCT', limit: 20 } });
  });

  it('packrat_list_my_trail_reports → GETs user.trail-conditions.mine with query', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_list_my_trail_reports');

    const result = await handler({ updated_since: '2025-01-01T00:00:00.000Z' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const getCall = calls.find((c) => c.path.at(-1) === 'get');
    expect(getCall?.path).toEqual(['user', 'trail-conditions', 'mine', 'get']);
    expect(getCall?.args[0]).toEqual({ query: { updatedAt: '2025-01-01T00:00:00.000Z' } });
  });

  it('packrat_submit_trail_condition → POSTs user.trail-conditions with mapped body', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_submit_trail_condition');

    const result = await handler(
      {
        trail_name: 'Rae Lakes Loop',
        trail_region: 'Sierra Nevada',
        surface: TrailSurface.Rocky,
        overall_condition: TrailCondition.Good,
        hazards: ['downed trees'],
        water_crossings: 3,
        water_crossing_difficulty: CrossingDifficulty.Moderate,
        notes: 'High water early morning',
        photos: ['https://example.com/p.jpg'],
        trip_id: 't_123',
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const postCall = calls.find((c) => c.path.at(-1) === 'post');
    expect(postCall?.path).toEqual(['user', 'trail-conditions', 'post']);
    const body = postCall?.args[0] as Record<string, unknown>;
    expect(body?.trailName).toBe('Rae Lakes Loop');
    expect(body?.surface).toBe('rocky');
    expect(body?.overallCondition).toBe('good');
    expect(body?.waterCrossingDifficulty).toBe('moderate');
  });

  it('packrat_update_trail_condition → PUTs user.trail-conditions({reportId})', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trail_condition');

    const result = await handler(
      {
        report_id: 'r_abc',
        trail_name: 'Updated Trail',
        surface: TrailSurface.Snow,
        water_crossing_difficulty: null,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const idCall = calls.find((c) => c.path.at(-1) === 'trail-conditions');
    expect(idCall?.args[0]).toEqual({ reportId: 'r_abc' });
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    expect(putCall?.path).toEqual(['user', 'trail-conditions', '()', 'put']);
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.trailName).toBe('Updated Trail');
    expect(body?.surface).toBe('snow');
    expect(body?.waterCrossingDifficulty).toBeNull();
  });

  it('packrat_delete_trail_condition → DELETEs user.trail-conditions({reportId})', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_delete_trail_condition');

    const result = await handler({ report_id: 'r_abc' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const idCall = calls.find((c) => c.path.at(-1) === 'trail-conditions');
    expect(idCall?.args[0]).toEqual({ reportId: 'r_abc' });
    const delCall = calls.find((c) => c.path.at(-1) === 'delete');
    expect(delCall?.path).toEqual(['user', 'trail-conditions', '()', 'delete']);
  });
});
