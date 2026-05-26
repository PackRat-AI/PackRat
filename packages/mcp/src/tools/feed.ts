import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerFeedTools(agent: AgentContext): void {
  // ── Posts ─────────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_list_feed',
    {
      title: 'List Feed Posts',
      description: 'List social feed posts (paginated).',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: {
        title: 'List Feed Posts',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ page, limit }) =>
      call({ promise: agent.api.user.feed.get({ query: { page, limit } }), action: 'list feed' }),
  );

  agent.server.registerTool(
    'packrat_create_feed_post',
    {
      title: 'Create Feed Post',
      description: 'Create a feed post with a caption and optional image keys.',
      inputSchema: {
        caption: z.string().min(1),
        images: z.array(z.string()).optional(),
      },
      annotations: {
        title: 'Create Feed Post',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ caption, images }) =>
      call({
        promise: agent.api.user.feed.post({ caption, images: images ?? [] }),
        action: 'create feed post',
      }),
  );

  agent.server.registerTool(
    'packrat_get_feed_post',
    {
      title: 'Get Feed Post',
      description: 'Get a specific feed post by ID.',
      inputSchema: { post_id: z.string() },
      annotations: {
        title: 'Get Feed Post',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ post_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).get(),
        action: 'get feed post',
        resourceHint: `post ${post_id}`,
      }),
  );

  agent.server.registerTool(
    'packrat_delete_feed_post',
    {
      title: 'Delete Feed Post',
      description: 'Delete one of your own feed posts.',
      inputSchema: { post_id: z.string() },
      annotations: {
        title: 'Delete Feed Post',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ post_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).delete(),
        action: 'delete feed post',
        resourceHint: `post ${post_id}`,
      }),
  );

  // Note: `toggle_feed_post_like` is non-idempotent by name (each call flips
  // the like state) but additive in MCP's "destroys data" sense — no posts
  // or comments are removed.
  agent.server.registerTool(
    'packrat_toggle_feed_post_like',
    {
      title: 'Toggle Feed Post Like',
      description: 'Like or unlike a feed post (toggle).',
      inputSchema: { post_id: z.string() },
      annotations: {
        title: 'Toggle Feed Post Like',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ post_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).like.post({}),
        action: 'toggle feed post like',
        resourceHint: `post ${post_id}`,
      }),
  );

  // ── Comments ──────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_list_feed_comments',
    {
      title: 'List Feed Comments',
      description: 'List comments on a feed post.',
      inputSchema: {
        post_id: z.string(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: {
        title: 'List Feed Comments',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ post_id, page, limit }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).comments.get({ query: { page, limit } }),
        action: 'list feed comments',
        resourceHint: `post ${post_id}`,
      }),
  );

  agent.server.registerTool(
    'packrat_create_feed_comment',
    {
      title: 'Create Feed Comment',
      description: 'Add a comment to a feed post (or reply to a parent comment).',
      inputSchema: {
        post_id: z.string(),
        content: z.string().min(1),
        parent_comment_id: z.number().int().optional(),
      },
      annotations: {
        title: 'Create Feed Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ post_id, content, parent_comment_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).comments.post({
          content,
          parentCommentId: parent_comment_id,
        }),
        action: 'create feed comment',
        resourceHint: `post ${post_id}`,
      }),
  );

  agent.server.registerTool(
    'packrat_delete_feed_comment',
    {
      title: 'Delete Feed Comment',
      description: 'Delete one of your own feed comments.',
      inputSchema: { post_id: z.string(), comment_id: z.string() },
      annotations: {
        title: 'Delete Feed Comment',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ post_id, comment_id }) =>
      call({
        promise: agent.api.user
          .feed({ postId: post_id })
          .comments({ commentId: comment_id })
          .delete(),
        action: 'delete feed comment',
        resourceHint: `comment ${comment_id}`,
      }),
  );

  agent.server.registerTool(
    'packrat_toggle_feed_comment_like',
    {
      title: 'Toggle Feed Comment Like',
      description: 'Like or unlike a feed comment (toggle).',
      inputSchema: { post_id: z.string(), comment_id: z.string() },
      annotations: {
        title: 'Toggle Feed Comment Like',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ post_id, comment_id }) =>
      call({
        promise: agent.api.user
          .feed({ postId: post_id })
          .comments({ commentId: comment_id })
          .like.post({}),
        action: 'toggle feed comment like',
        resourceHint: `comment ${comment_id}`,
      }),
  );
}
