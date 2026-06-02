/**
 * Unit tests for every tool handler registered by `registerTripTools`.
 *
 * Strategy (shared `_tool-harness`): build a real `McpServer` + stub agent
 * whose `api` is a recording Proxy that resolves every HTTP verb to a
 * success-shaped Treaty result. We register the trip tools, pull each
 * handler from the SDK registry, invoke it with valid args, then assert
 * both that a non-empty text block came back AND that the expected Treaty
 * endpoint (specific path segments + terminal verb) was actually hit.
 */

import { describe, expect, it } from 'vitest';
import { registerTripTools } from '../tools/trips';
import type { AgentContext } from '../types';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/**
 * Build an agent whose `user.trips.get()` resolves to a success envelope
 * carrying an explicit array payload, so the list handler's
 * `Array.isArray(result.data)` true branch and `withNextOffset` full-page
 * branch are exercised (the shared stub only ever returns `{ success: true }`).
 */
function makeAgentWithTripsArray(items: unknown[]): MockLikeAgent {
  const { agent } = makeAgent();
  const tripsGet = () => Promise.resolve({ data: items, error: null, status: 200 });
  const trips = Object.assign(() => trips, { get: tripsGet });
  const api = { user: { trips } } as unknown as AgentContext['api'];
  return { ...agent, api };
}

type MockLikeAgent = AgentContext;

/** Does any recorded call's path end with the given segment sequence? */
function callEndsWith(calls: ApiCall[], tail: string[]): boolean {
  return calls.some(
    (c) =>
      c.path.length >= tail.length &&
      tail.every((seg, i) => c.path[c.path.length - tail.length + i] === seg),
  );
}

describe('registerTripTools', () => {
  it('packrat_list_trips → GETs user.trips and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_list_trips');

    const result = await handler({ limit: 10, offset: 0 }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(callEndsWith(calls, ['user', 'trips', 'get'])).toBe(true);
  });

  it('packrat_get_trip → GETs user.trips({tripId}) and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_get_trip');

    const result = await handler({ trip_id: 't_abc123' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(callEndsWith(calls, ['user', 'trips', '()', 'get'])).toBe(true);
    const idCall = calls.find((c) => c.path.at(-1) === 'trips');
    expect(idCall?.args[0]).toEqual({ tripId: 't_abc123' });
  });

  it('packrat_create_trip → POSTs user.trips and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_create_trip');

    const result = await handler(
      {
        name: 'PCT Section J — Fall 2025',
        description: 'Snoqualmie to Stevens',
        location: { latitude: 47.42, longitude: -121.41, name: 'Snoqualmie Pass' },
        start_date: '2025-09-01',
        end_date: '2025-09-07',
        notes: 'Permit needed',
        pack_id: 'p_123',
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const postCall = calls.find((c) => c.path.at(-2) === 'trips' && c.path.at(-1) === 'post');
    expect(postCall?.path).toEqual(['user', 'trips', 'post']);
    const body = postCall?.args[0] as Record<string, unknown>;
    expect(body?.name).toBe('PCT Section J — Fall 2025');
    expect(body?.packId).toBe('p_123');
  });

  it('packrat_update_trip → PUTs user.trips({tripId}) with mapped body', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trip');

    const result = await handler(
      {
        trip_id: 't_abc123',
        name: 'Renamed Trip',
        location: { latitude: 40, longitude: -120 },
        notes: null,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    expect(putCall?.path).toEqual(['user', 'trips', '()', 'put']);
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.name).toBe('Renamed Trip');
    expect(body?.notes).toBeNull();
  });

  it('packrat_delete_trip → DELETEs user.trips({tripId}) and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_delete_trip');

    const result = await handler({ trip_id: 't_abc123' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const delCall = calls.find((c) => c.path.at(-1) === 'delete');
    expect(delCall?.path).toEqual(['user', 'trips', '()', 'delete']);
  });
});

describe('registerTripTools — list_trips data/limit branches', () => {
  it('packrat_list_trips with array data and omitted limit → paginates with nextOffset', async () => {
    // 60 items > clamped default (50) → withNextOffset advertises a next page.
    const items = Array.from({ length: 60 }, (_v, i) => ({ id: `t_${i}`, name: `Trip ${i}` }));
    const agent = makeAgentWithTripsArray(items);
    const server = agent.server;
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_list_trips');

    const result = await handler({ offset: 0 }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const structured = result.structuredContent as { data: unknown[]; nextOffset: number | null };
    expect(structured.data).toHaveLength(50);
    expect(structured.nextOffset).toBe(50);
  });

  it('packrat_list_trips with short array page → nextOffset is null', async () => {
    const items = [{ id: 't_1', name: 'Only' }];
    const agent = makeAgentWithTripsArray(items);
    const server = agent.server;
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_list_trips');

    const result = await handler({ limit: 10, offset: 0 }, makeExtra());

    const structured = result.structuredContent as { data: unknown[]; nextOffset: number | null };
    expect(structured.data).toHaveLength(1);
    expect(structured.nextOffset).toBeNull();
  });
});

describe('registerTripTools — optional-omitted branches', () => {
  it('packrat_create_trip with only name → POSTs with null location and undefined optionals', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_create_trip');

    const result = await handler({ name: 'Minimal Trip' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    const postCall = calls.find((c) => c.path.at(-1) === 'post');
    const body = postCall?.args[0] as Record<string, unknown>;
    expect(body?.name).toBe('Minimal Trip');
    expect(body?.location).toBeNull();
    expect(body?.description).toBeUndefined();
    expect(body?.startDate).toBeUndefined();
    expect(body?.endDate).toBeUndefined();
    expect(body?.notes).toBeUndefined();
    expect(body?.packId).toBeUndefined();
  });

  it('packrat_update_trip with only trip_id → PUTs body omitting all optional keys', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trip');

    const result = await handler({ trip_id: 't_min' }, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    const keys = Object.keys(body);
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('description');
    expect(keys).not.toContain('location');
    expect(keys).not.toContain('startDate');
    expect(keys).not.toContain('endDate');
    expect(keys).not.toContain('notes');
    expect(keys).not.toContain('packId');
    expect(keys).toContain('localUpdatedAt');
  });

  it('packrat_update_trip with all optional fields set → PUTs full body', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trip');

    const result = await handler(
      {
        trip_id: 't_full',
        name: 'Full',
        description: 'desc',
        location: { latitude: 1, longitude: 2 },
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        notes: 'n',
        pack_id: 'p_1',
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.description).toBe('desc');
    expect(body?.startDate).toBe('2025-01-01');
    expect(body?.endDate).toBe('2025-01-02');
    expect(body?.packId).toBe('p_1');
  });

  it('packrat_update_trip with explicit null nullable fields → PUTs nulls', async () => {
    const { agent, server, calls } = makeAgent();
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trip');

    const result = await handler(
      {
        trip_id: 't_null',
        description: null,
        location: null,
        start_date: null,
        end_date: null,
        notes: null,
        pack_id: null,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    const putCall = calls.find((c) => c.path.at(-1) === 'put');
    const body = putCall?.args[0] as Record<string, unknown>;
    expect(body?.description).toBeNull();
    expect(body?.location).toBeNull();
    expect(body?.startDate).toBeNull();
    expect(body?.endDate).toBeNull();
    expect(body?.notes).toBeNull();
    expect(body?.packId).toBeNull();
  });
});

describe('registerTripTools — error paths', () => {
  it('packrat_list_trips surfaces upstream failure (GET verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_list_trips');

    const result = await handler({ offset: 0 }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_get_trip surfaces upstream failure (GET verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_get_trip');

    const result = await handler({ trip_id: 't_err' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_create_trip surfaces upstream failure (POST verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_create_trip');

    const result = await handler({ name: 'Err' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_update_trip surfaces upstream failure (PUT verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_update_trip');

    const result = await handler({ trip_id: 't_err', name: 'x' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('packrat_delete_trip surfaces upstream failure (DELETE verb)', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerTripTools(agent);
    const handler = getToolHandler(server, 'packrat_delete_trip');

    const result = await handler({ trip_id: 't_err' }, makeExtra());

    expect(result.isError).toBe(true);
    const code = (result.structuredContent?.error as { code?: unknown })?.code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });
});
