import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackRatApiClient } from '../../client';
import { ApiError } from '../../client';
import { registerWeatherTools } from '../../tools/weather';
import type { RegisteredTool } from '../helpers';
import { buildMockAgent, callTool, parseToolResult } from '../helpers';

describe('weather tools', () => {
  let api: PackRatApiClient;
  let tools: Map<string, RegisteredTool>;

  beforeEach(() => {
    const mock = buildMockAgent();
    api = mock.api;
    tools = mock.tools;
    registerWeatherTools(mock.agent);
  });

  // ── get_weather ─────────────────────────────────────────────────────────────

  describe('get_weather', () => {
    it('is registered', () => {
      expect(tools.has('get_weather')).toBe(true);
    });

    it('performs search then forecast (two-step flow)', async () => {
      const searchResult = { id: 'loc_123', name: 'Yosemite Valley' };
      const forecast = { location: 'Yosemite', temp: 55, forecast: [] };
      vi.mocked(api.get)
        .mockResolvedValueOnce(searchResult) // step 1: search
        .mockResolvedValueOnce(forecast); // step 2: forecast

      const result = await callTool({
        tools,
        name: 'get_weather',
        args: { location: 'Yosemite Valley, CA' },
      });

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(vi.mocked(api.get).mock.calls[0]).toEqual([
        '/weather/search',
        { q: 'Yosemite Valley, CA' },
      ]);
      expect(vi.mocked(api.get).mock.calls[1]).toEqual(['/weather/forecast', { id: 'loc_123' }]);
      expect(parseToolResult(result)).toEqual(forecast);
    });

    it('returns error when location search finds nothing', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({}); // no id in response

      const result = await callTool({
        tools,
        name: 'get_weather',
        args: { location: 'Nowhere Special' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No weather location found');
    });

    it('returns error result when search API fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Bad Request', { status: 400, body: {} }));

      const result = await callTool({
        tools,
        name: 'get_weather',
        args: { location: 'Bad Location' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('400');
    });
  });

  // ── search_weather_location ─────────────────────────────────────────────────

  describe('search_weather_location', () => {
    it('is registered', () => {
      expect(tools.has('search_weather_location')).toBe(true);
    });

    it('calls GET /weather/search with q param', async () => {
      vi.mocked(api.get).mockResolvedValue([{ id: 'loc_1', name: 'Seattle' }]);

      const result = await callTool({
        tools,
        name: 'search_weather_location',
        args: { query: 'Seattle, WA' },
      });

      expect(api.get).toHaveBeenCalledWith('/weather/search', { q: 'Seattle, WA' });
      expect(Array.isArray(parseToolResult(result))).toBe(true);
    });
  });

  // ── get_season_suggestions ──────────────────────────────────────────────────

  describe('get_season_suggestions', () => {
    it('is registered', () => {
      expect(tools.has('get_season_suggestions')).toBe(true);
    });

    it('calls POST /season-suggestions with destination', async () => {
      const suggestions = {
        destination: 'Patagonia',
        seasons: [{ name: 'Summer', months: 'Dec-Feb', conditions: 'best' }],
      };
      vi.mocked(api.post).mockResolvedValue(suggestions);

      const result = await callTool({
        tools,
        name: 'get_season_suggestions',
        args: { destination: 'Patagonia' },
      });

      expect(api.post).toHaveBeenCalledWith('/season-suggestions', { destination: 'Patagonia' });
      expect(parseToolResult(result)).toEqual(suggestions);
    });

    it('returns error when API fails', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Timeout'));

      const result = await callTool({
        tools,
        name: 'get_season_suggestions',
        args: { destination: 'Nowhere' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Timeout');
    });
  });
});
