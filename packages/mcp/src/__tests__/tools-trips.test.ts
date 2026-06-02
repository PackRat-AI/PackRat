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
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

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
