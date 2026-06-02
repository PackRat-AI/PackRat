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

describe('registerTrailConditionTools — optional-omitted branches', () => {
  it('packrat_list_my_trail_reports without updated_since → GETs with empty query', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_list_my_trail_reports');

    const result = await handler({}, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    const getCall = calls.find((c) => c.path.at(-1) === 'get');
    expect(getCall?.path).toEqual(['user', 'trail-conditions', 'mine', 'get']);
    expect(getCall?.args[0]).toEqual({ query: {} });
  });

  it('packrat_submit_trail_condition with only required args → POSTs with nullish defaults', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_submit_trail_condition');

    const result = await handler(
      {
        trail_name: 'Minimal Trail',
        surface: TrailSurface.Dirt,
        overall_condition: TrailCondition.Fair,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    const postCall = calls.find((c) => c.path.at(-1) === 'post');
    const body = postCall?.args[0] as Record<string, unknown>;
    expect(body?.trailRegion).toBeNull();
    expect(body?.hazards).toEqual([]);
    expect(body?.waterCrossings).toBe(0);
    expect(body?.waterCrossingDifficulty).toBeNull();
    expect(body?.notes).toBeNull();
    expect(body?.photos).toEqual([]);
    expect(body?.tripId).toBeUndefined();
  });

  it('packrat_update_trail_condition with only report_id → PUTs body omitting all optional keys', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trail_condition');

    const result = await handler({ report_id: 'r_min' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    const keys = Object.keys(body);
    expect(keys).not.toContain('trailName');
    expect(keys).not.toContain('trailRegion');
    expect(keys).not.toContain('surface');
    expect(keys).not.toContain('overallCondition');
    expect(keys).not.toContain('hazards');
    expect(keys).not.toContain('waterCrossings');
    expect(keys).not.toContain('waterCrossingDifficulty');
    expect(keys).not.toContain('notes');
    expect(keys).not.toContain('photos');
    expect(keys).toContain('localUpdatedAt');
  });

  it('packrat_update_trail_condition with all optional fields set → PUTs full body', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trail_condition');

    const result = await handler(
      {
        report_id: 'r_full',
        trail_name: 'Full Trail',
        trail_region: 'Cascades',
        surface: TrailSurface.Dirt,
        overall_condition: TrailCondition.Good,
        hazards: ['ice'],
        water_crossings: 2,
        water_crossing_difficulty: CrossingDifficulty.Easy,
        notes: 'fresh',
        photos: ['https://example.com/x.jpg'],
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.trailRegion).toBe('Cascades');
    expect(body?.hazards).toEqual(['ice']);
    expect(body?.waterCrossings).toBe(2);
    expect(body?.waterCrossingDifficulty).toBe('easy');
    expect(body?.notes).toBe('fresh');
    expect(body?.photos).toEqual(['https://example.com/x.jpg']);
  });

  it('packrat_update_trail_condition with explicit null nullable fields → PUTs nulls', async () => {
    const { agent, server, calls } = makeAgent();
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trail_condition');

    const result = await handler(
      {
        report_id: 'r_null',
        trail_region: null,
        water_crossing_difficulty: null,
        notes: null,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.trailRegion).toBeNull();
    expect(body?.waterCrossingDifficulty).toBeNull();
    expect(body?.notes).toBeNull();
  });
});

describe('registerTrailConditionTools — error paths', () => {
  it('packrat_get_trail_conditions surfaces upstream failure (GET verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_get_trail_conditions');

    const result = await handler({ limit: 20 }, makeExtra());

    expect(result.isError).toBe(true);
    expect(typeof result.structuredContent?.error).toBe('object');
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_submit_trail_condition surfaces upstream failure (POST verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_submit_trail_condition');

    const result = await handler(
      {
        trail_name: 'Err Trail',
        surface: TrailSurface.Dirt,
        overall_condition: TrailCondition.Good,
      },
      makeExtra(),
    );

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_update_trail_condition surfaces upstream failure (PUT verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trail_condition');

    const result = await handler({ report_id: 'r_err', trail_name: 'x' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_delete_trail_condition surfaces upstream failure (DELETE verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTrailConditionTools(agent);
    const handler = getToolHandler(server, 'packrat_delete_trail_condition');

    const result = await handler({ report_id: 'r_err' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });
});
