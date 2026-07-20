/**
 * Real unit tests for every feed tool HANDLER.
 *
 * Each test registers the feed tools against a stub agent (whose `api` is a
 * recording Proxy that resolves HTTP verbs to a success-shaped Treaty
 * result), pulls the handler from the SDK registry, invokes it with VALID
 * args, then asserts both:
 *   1. the handler returned a non-empty text content block, and
 *   2. the expected Treaty endpoint was hit — matched by its terminal HTTP
 *      verb plus the distinguishing path segments.
 *
 * The recording Proxy logs a `()` marker segment for every non-verb call
 * (e.g. `feed({ postId })`), so a chained path like
 * `api.user.feed({ postId }).comments({ commentId }).delete()` shows up as
 * `['user','feed','()','comments','()','delete']`.
 */

import { describe, expect, it } from 'vitest';
import { registerFeedTools } from '../tools/feed';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when `call.path` ends with `segments` (terminal-verb-anchored match). */
function pathEndsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

/** Count recorded calls whose path ends with the given terminal segments. */
function countCalls(calls: ApiCall[], segments: string[]): number {
  return calls.filter((c) => pathEndsWith(c, segments)).length;
}

describe('packrat_list_feed', () => {
  it('GETs the feed and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_list_feed')(
      { page: 1, limit: 20 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', 'get'])).toBe(1);
  });
});

describe('packrat_create_feed_post', () => {
  it('POSTs a new feed post and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_create_feed_post')(
      { caption: 'Trail day', images: ['key-1.jpg'] },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', 'post'])).toBe(1);
  });

  it('defaults images to [] when omitted and still POSTs', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_create_feed_post')(
      { caption: 'No photos' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', 'post'])).toBe(1);
  });
});

describe('packrat_get_feed_post', () => {
  it('GETs a single feed post by id and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_get_feed_post')(
      { post_id: 'post-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'get'])).toBe(1);
  });
});

describe('packrat_delete_feed_post', () => {
  it('DELETEs a feed post by id and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_feed_post')(
      { post_id: 'post-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'delete'])).toBe(1);
  });
});

describe('packrat_toggle_feed_post_like', () => {
  it('POSTs to the post like endpoint and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_toggle_feed_post_like')(
      { post_id: 'post-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'like', 'post'])).toBe(1);
  });
});

describe('packrat_list_feed_comments', () => {
  it('GETs comments for a post and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_list_feed_comments')(
      { post_id: 'post-1', page: 1, limit: 20 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'comments', 'get'])).toBe(1);
  });
});

describe('packrat_create_feed_comment', () => {
  it('POSTs a new comment (with parent reply) and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_create_feed_comment')(
      { post_id: 'post-1', content: 'Nice pack!', parent_comment_id: 7 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'comments', 'post'])).toBe(1);
  });
});

describe('packrat_delete_feed_comment', () => {
  it('DELETEs a comment by id and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_feed_comment')(
      { post_id: 'post-1', comment_id: 'comment-9' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'comments', '()', 'delete'])).toBe(1);
  });
});

describe('packrat_toggle_feed_comment_like', () => {
  it('POSTs to the comment like endpoint and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerFeedTools(agent);
    const result = await getToolHandler(server, 'packrat_toggle_feed_comment_like')(
      { post_id: 'post-1', comment_id: 'comment-9' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'feed', '()', 'comments', '()', 'like', 'post'])).toBe(1);
  });
});
