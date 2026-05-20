import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerFeedTools(agent: AgentContext): void {
  // ── Posts ─────────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_feed',
    {
      description: 'List social feed posts (paginated).',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ page, limit }) =>
      call({ promise: agent.api.user.feed.get({ query: { page, limit } }), action: 'list feed' }),
  );

  agent.server.registerTool(
    'create_feed_post',
    {
      description: 'Create a feed post with a caption and optional image keys.',
      inputSchema: {
        caption: z.string().min(1),
        images: z.array(z.string()).optional(),
      },
    },
    async ({ caption, images }) =>
      call({
        promise: agent.api.user.feed.post({ caption, images: images ?? [] }),
        action: 'create feed post',
      }),
  );

  agent.server.registerTool(
    'get_feed_post',
    {
      description: 'Get a specific feed post by ID.',
      inputSchema: { post_id: z.string() },
    },
    async ({ post_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).get(),
        action: 'get feed post',
        resourceHint: `post ${post_id}`,
      }),
  );

  agent.server.registerTool(
    'delete_feed_post',
    {
      description: 'Delete one of your own feed posts.',
      inputSchema: { post_id: z.string() },
    },
    async ({ post_id }) =>
      call({
        promise: agent.api.user.feed({ postId: post_id }).delete(),
        action: 'delete feed post',
        resourceHint: `post ${post_id}`,
      }),
  );

  agent.server.registerTool(
    'toggle_feed_post_like',
    {
      description: 'Like or unlike a feed post (toggle).',
      inputSchema: { post_id: z.string() },
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
    'list_feed_comments',
    {
      description: 'List comments on a feed post.',
      inputSchema: {
        post_id: z.string(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
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
    'create_feed_comment',
    {
      description: 'Add a comment to a feed post (or reply to a parent comment).',
      inputSchema: {
        post_id: z.string(),
        content: z.string().min(1),
        parent_comment_id: z.number().int().optional(),
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
    'delete_feed_comment',
    {
      description: 'Delete one of your own feed comments.',
      inputSchema: { post_id: z.string(), comment_id: z.string() },
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
    'toggle_feed_comment_like',
    {
      description: 'Like or unlike a feed comment (toggle).',
      inputSchema: { post_id: z.string(), comment_id: z.string() },
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
