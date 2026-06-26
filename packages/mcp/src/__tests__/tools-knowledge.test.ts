/**
 * Real unit tests for the knowledge-base tool handlers
 * (`packages/mcp/src/tools/knowledge.ts`).
 *
 * Each test registers the tools against the shared stub agent, invokes the
 * handler directly, and asserts both the text-content envelope AND that the
 * expected Treaty endpoint (specific path segments + terminal verb) was hit
 * on the recorded `calls`.
 */

import { describe, expect, it } from 'vitest';
import { registerKnowledgeTools } from '../tools/knowledge';
import type { ApiCall } from './_tool-harness';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when a recorded call's path ends with the given trailing segments. */
function endsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

describe('packrat_search_outdoor_guides', () => {
  it('GETs user.ai.rag-search with the query+limit and returns a text envelope', async () => {
    const { agent, server, calls } = makeAgent();
    registerKnowledgeTools(agent);

    const result = await getToolHandler(server, 'packrat_search_outdoor_guides')(
      { query: 'how to filter water', limit: 3 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const gets = calls.filter((c) => endsWith(c, ['ai', 'rag-search', 'get']));
    expect(gets).toHaveLength(1);
    expect(gets[0]?.args[0]).toEqual({ query: { q: 'how to filter water', limit: 3 } });
  });
});

describe('packrat_extract_url_content', () => {
  it('POSTs the url to user.knowledge-base.reader.extract and returns a text envelope', async () => {
    const { agent, server, calls } = makeAgent();
    registerKnowledgeTools(agent);

    const result = await getToolHandler(server, 'packrat_extract_url_content')(
      { url: 'https://example.com/trip-report' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const posts = calls.filter((c) => endsWith(c, ['knowledge-base', 'reader', 'extract', 'post']));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.args[0]).toEqual({ url: 'https://example.com/trip-report' });
  });
});
