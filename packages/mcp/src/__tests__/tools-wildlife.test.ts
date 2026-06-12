/**
 * Real unit tests for the wildlife tool handler
 * (`packages/mcp/src/tools/wildlife.ts`).
 *
 * `packrat_identify_wildlife` POSTs the R2 image key (wrapped as `{ image }`)
 * to the identify endpoint. The test asserts the text envelope AND that the
 * identify endpoint was hit with the expected body.
 */

import { describe, expect, it } from 'vitest';
import { registerWildlifeTools } from '../tools/wildlife';
import type { ApiCall } from './_tool-harness';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when a recorded call's path ends with the given trailing segments. */
function endsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

describe('packrat_identify_wildlife', () => {
  it('POSTs the image key to user.wildlife.identify', async () => {
    const { agent, server, calls } = makeAgent();
    registerWildlifeTools(agent);

    const result = await getToolHandler(server, 'packrat_identify_wildlife')(
      { image_key: 'uploads/abc123.jpg' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const posts = calls.filter((c) => endsWith(c, ['wildlife', 'identify', 'post']));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.args[0]).toEqual({ image: 'uploads/abc123.jpg' });
  });
});
