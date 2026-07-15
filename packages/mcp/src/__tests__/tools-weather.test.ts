/**
 * Real handler tests for every tool registered by `registerWeatherTools`.
 *
 * Strategy mirrors tools-admin.test.ts: build a real `McpServer`, register
 * the weather tools against a stub `AgentContext` whose `api` is a Proxy
 * that records every Treaty property chain + terminal verb, then invoke each
 * tool's handler directly and assert both (a) the handler returns a non-empty
 * text content block and (b) the expected Treaty endpoint was hit (specific
 * path segments + terminal `get`).
 *
 * These are read-only tools (no elicitation), so the stub's default
 * `{ data: { success: true } }` resolution drives the happy path.
 */

import { describe, expect, it } from 'vitest';
import { registerWeatherTools } from '../tools/weather';
import { nth } from './_access';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True if some recorded call's path ends with `segments` (last = terminal verb). */
function hasCallEndingWith(calls: ApiCall[], segments: string[]): boolean {
  return calls.some((c) => {
    if (c.path.length < segments.length) return false;
    const tail = c.path.slice(c.path.length - segments.length);
    return segments.every((seg, i) => nth(tail, i) === seg);
  });
}

describe('packrat_get_weather', () => {
  it('returns text content and hits user.weather.by-name.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerWeatherTools(agent);

    const result = await getToolHandler(server, 'packrat_get_weather')(
      { location: 'Yosemite Valley' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'weather', 'by-name', 'get'])).toBe(true);
  });
});

describe('packrat_search_weather_location', () => {
  it('returns text content and hits user.weather.search.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerWeatherTools(agent);

    const result = await getToolHandler(server, 'packrat_search_weather_location')(
      { query: 'Denver' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'weather', 'search', 'get'])).toBe(true);
  });
});

describe('packrat_search_weather_by_coordinates', () => {
  it('returns text content and hits user.weather.search-by-coordinates.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerWeatherTools(agent);

    const result = await getToolHandler(server, 'packrat_search_weather_by_coordinates')(
      { latitude: 37.865, longitude: -119.538 },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'weather', 'search-by-coordinates', 'get'])).toBe(
      true,
    );
  });
});

describe('packrat_get_weather_forecast', () => {
  it('returns text content and hits user.weather.forecast.get for a string id', async () => {
    const { agent, server, calls } = makeAgent();
    registerWeatherTools(agent);

    const result = await getToolHandler(server, 'packrat_get_weather_forecast')(
      { location_id: 'loc-123' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'weather', 'forecast', 'get'])).toBe(true);
  });

  it('accepts a numeric location_id and still hits user.weather.forecast.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerWeatherTools(agent);

    const result = await getToolHandler(server, 'packrat_get_weather_forecast')(
      { location_id: 4567 },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'weather', 'forecast', 'get'])).toBe(true);
  });
});
