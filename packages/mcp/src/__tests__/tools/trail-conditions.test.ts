import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackRatApiClient } from '../../client';
import { ApiError } from '../../client';
import { registerTrailConditionTools } from '../../tools/trail-conditions';
import type { RegisteredTool } from '../helpers';
import { buildMockAgent, callTool, parseToolResult } from '../helpers';

describe('trail condition tools', () => {
  let api: PackRatApiClient;
  let tools: Map<string, RegisteredTool>;

  beforeEach(() => {
    const mock = buildMockAgent();
    api = mock.api;
    tools = mock.tools;
    registerTrailConditionTools(mock.agent);
  });

  // ── get_trail_conditions ────────────────────────────────────────────────────

  describe('get_trail_conditions', () => {
    it('is registered', () => {
      expect(tools.has('get_trail_conditions')).toBe(true);
    });

    it('calls GET /trail-conditions with trailName and limit', async () => {
      const reports = { items: [{ id: 1, overallCondition: 'good' }] };
      vi.mocked(api.get).mockResolvedValue(reports);

      const result = await callTool({
        tools,
        name: 'get_trail_conditions',
        args: {
          trail_name: 'John Muir Trail',
          limit: 5,
        },
      });

      expect(api.get).toHaveBeenCalledWith('/trail-conditions', {
        trailName: 'John Muir Trail',
        limit: 5,
      });
      expect(parseToolResult(result)).toEqual(reports);
    });

    it('works without any params', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [] });

      await callTool({ tools, name: 'get_trail_conditions', args: { limit: 20 } });

      const [, params] = vi.mocked(api.get).mock.calls[0] as [string, Record<string, unknown>];
      expect(params.trailName).toBeUndefined();
      expect(params.limit).toBe(20);
    });

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Internal Server Error', 500, {}));

      const result = await callTool({ tools, name: 'get_trail_conditions', args: { limit: 10 } });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('500');
    });
  });

  // ── submit_trail_condition ──────────────────────────────────────────────────

  describe('submit_trail_condition', () => {
    it('is registered', () => {
      expect(tools.has('submit_trail_condition')).toBe(true);
    });

    it('calls POST /trail-conditions with correctly mapped API fields', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 'tcr_abc', submitted: true });

      const result = await callTool({
        tools,
        name: 'submit_trail_condition',
        args: {
          trail_name: 'Mt Whitney Trail',
          trail_region: 'California',
          surface: 'rocky',
          overall_condition: 'good',
          hazards: ['loose rocks', 'snow'],
          water_crossings: 3,
          water_crossing_difficulty: 'moderate',
          notes: 'Trail is clear above 10k, some snow patches near the summit',
        },
      });

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
      expect(path).toBe('/trail-conditions');
      expect(body.trailName).toBe('Mt Whitney Trail');
      expect(body.trailRegion).toBe('California');
      expect(body.surface).toBe('rocky');
      expect(body.overallCondition).toBe('good');
      expect(body.hazards).toEqual(['loose rocks', 'snow']);
      expect(body.waterCrossings).toBe(3);
      expect(body.waterCrossingDifficulty).toBe('moderate');
      expect(body.notes).toContain('summit');
      expect(body.photos).toEqual([]);
      expect(typeof body.id).toBe('string');
      expect((body.id as string).startsWith('tcr_')).toBe(true);
      expect(typeof body.localCreatedAt).toBe('string');
      expect(typeof body.localUpdatedAt).toBe('string');
      expect(parseToolResult(result)).toEqual({ id: 'tcr_abc', submitted: true });
    });

    it('submits with defaults when optional fields are absent', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 'tcr_2' });

      await callTool({
        tools,
        name: 'submit_trail_condition',
        args: {
          trail_name: 'Simple Trail',
          surface: 'dirt',
          overall_condition: 'excellent',
        },
      });

      const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
      expect(body.hazards).toEqual([]);
      expect(body.waterCrossings).toBe(0);
      expect(body.waterCrossingDifficulty).toBeNull();
      expect(body.notes).toBeNull();
      expect(body.trailRegion).toBeNull();
      expect(body.photos).toEqual([]);
    });

    it('returns error when user is not authenticated (401)', async () => {
      vi.mocked(api.post).mockRejectedValue(new ApiError('Unauthorized', 401, {}));

      const result = await callTool({
        tools,
        name: 'submit_trail_condition',
        args: {
          trail_name: 'Test Trail',
          surface: 'paved',
          overall_condition: 'fair',
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('401');
    });
  });
});
