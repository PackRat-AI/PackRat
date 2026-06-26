/**
 * Real handler-invocation test for the single tool registered by
 * `registerSeasonTools`. Drives the registered handler through the shared
 * `_tool-harness` api stub and asserts both the tool's text result and that
 * the expected Treaty endpoint was hit.
 */

import { describe, expect, it } from 'vitest';
import { registerSeasonTools } from '../tools/seasons';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

describe('registerSeasonTools — handler invocation', () => {
  it('packrat_get_season_suggestions POSTs user/season-suggestions with location + date', async () => {
    const { agent, server, calls } = makeAgent();
    registerSeasonTools(agent);
    const result = await getToolHandler(server, 'packrat_get_season_suggestions')(
      { location: 'Boulder, CO', date: '2026-07-15' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect(post?.path.includes('season-suggestions')).toBe(true);
    expect((post?.args[0] as { location?: string; date?: string })?.location).toBe('Boulder, CO');
    expect((post?.args[0] as { location?: string; date?: string })?.date).toBe('2026-07-15');
  });
});
