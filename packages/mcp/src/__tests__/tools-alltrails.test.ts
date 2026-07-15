/**
 * Real handler-invocation test for the single tool registered by
 * `registerAlltrailsTools`. Drives the registered handler through the shared
 * `_tool-harness` api stub and asserts both the tool's text result and that
 * the expected Treaty endpoint was hit.
 */

import { describe, expect, it } from 'vitest';
import { registerAlltrailsTools } from '../tools/alltrails';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

describe('registerAlltrailsTools — handler invocation', () => {
  it('packrat_preview_alltrails_url POSTs user/alltrails/preview with url', async () => {
    const { agent, server, calls } = makeAgent();
    registerAlltrailsTools(agent);
    const result = await getToolHandler(server, 'packrat_preview_alltrails_url')(
      { url: 'https://www.alltrails.com/trail/us/colorado/mount-sanitas-loop' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect(post?.path.includes('alltrails')).toBe(true);
    expect(post?.path.includes('preview')).toBe(true);
    expect((post?.args[0] as { url?: string })?.url).toBe(
      'https://www.alltrails.com/trail/us/colorado/mount-sanitas-loop',
    );
  });
});
