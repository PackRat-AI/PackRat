import { createRoute, defineOpenAPIRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { commentLikes, postComments, posts, users } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  CommentSchema,
  CommentsResponseSchema,
  CreateCommentRequestSchema,
  LikeToggleResponseSchema,
} from '@packrat/api/schemas/feed';
import type { Env } from '@packrat/api/types/env';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import type { Variables } from '@packrat/api/types/variables';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

// GET /feed/:postId/comments - list comments
export const listCommentsRoute = createRoute({
  method: 'get',
  path: '/:postId/comments',
  tags: ['Feed'],
  summary: 'List comments on a post',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ postId: z.coerce.number().int() }),
    query: z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    }),
  },
  responses: {
    200: {
      description: 'Comments retrieved successfully',
      content: { 'application/json': { schema: CommentsResponseSchema } },
    },
    404: {
      description: 'Post not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const listCommentsHandler: RouteHandler<typeof listCommentsRoute> = async (c) => {
  const auth = c.get('user');
  const { postId } = c.req.valid('param');
  const { page, limit } = c.req.valid('query');
  const db = createDb(c);

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const offset = (page - 1) * limit;

  const [totalResult, items] = await Promise.all([
    db.select({ count: count() }).from(postComments).where(eq(postComments.postId, postId)),
    db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        parentCommentId: postComments.parentCommentId,
        createdAt: postComments.createdAt,
        updatedAt: postComments.updatedAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.postId, postId))
      .orderBy(desc(postComments.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  if (items.length === 0) {
    return c.json({ items: [], page, limit, total, totalPages: Math.ceil(total / limit) }, 200);
  }

  const commentIds = items.map((c) => c.id);

  const [likeCounts, myLikes] = await Promise.all([
    db
      .select({ commentId: commentLikes.commentId, cnt: count() })
      .from(commentLikes)
      .where(inArray(commentLikes.commentId, commentIds))
      .groupBy(commentLikes.commentId),
    db
      .select({ commentId: commentLikes.commentId })
      .from(commentLikes)
      .where(
        and(inArray(commentLikes.commentId, commentIds), eq(commentLikes.userId, auth.userId)),
      ),
  ]);

  const likeCountMap = Object.fromEntries(likeCounts.map((l) => [l.commentId, l.cnt]));
  const myLikeSet = new Set(myLikes.map((l) => l.commentId));

  const result = items.map((item) => ({
    id: item.id,
    postId: item.postId,
    userId: item.userId,
    content: item.content,
    parentCommentId: item.parentCommentId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    author: { id: item.userId, firstName: item.firstName, lastName: item.lastName },
    likeCount: likeCountMap[item.id] ?? 0,
    likedByMe: myLikeSet.has(item.id),
  }));

  return c.json({ items: result, page, limit, total, totalPages: Math.ceil(total / limit) }, 200);
};

// POST /feed/:postId/comments - add comment
export const addCommentRoute = createRoute({
  method: 'post',
  path: '/:postId/comments',
  tags: ['Feed'],
  summary: 'Add a comment to a post',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ postId: z.coerce.number().int() }),
    body: {
      content: { 'application/json': { schema: CreateCommentRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Comment created successfully',
      content: { 'application/json': { schema: CommentSchema } },
    },
    400: {
      description: 'Failed to create comment',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Post not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const addCommentHandler: RouteHandler<typeof addCommentRoute> = async (c) => {
  const auth = c.get('user');
  const { postId } = c.req.valid('param');
  const body = c.req.valid('json');
  const db = createDb(c);

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const [newComment] = await db
    .insert(postComments)
    .values({
      postId,
      userId: auth.userId,
      content: body.content,
      parentCommentId: body.parentCommentId ?? null,
    })
    .returning();

  if (!newComment) {
    return c.json({ error: 'Failed to create comment' }, 400);
  }

  const author = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { id: true, firstName: true, lastName: true },
  });

  return c.json(
    {
      id: newComment.id,
      postId: newComment.postId,
      userId: newComment.userId,
      content: newComment.content,
      parentCommentId: newComment.parentCommentId,
      createdAt: newComment.createdAt.toISOString(),
      updatedAt: newComment.updatedAt.toISOString(),
      author: author
        ? { id: author.id, firstName: author.firstName, lastName: author.lastName }
        : undefined,
      likeCount: 0,
      likedByMe: false,
    },
    201,
  );
};

// DELETE /feed/:postId/comments/:commentId - delete comment
export const deleteCommentRoute = createRoute({
  method: 'delete',
  path: '/:postId/comments/:commentId',
  tags: ['Feed'],
  summary: 'Delete a comment',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      postId: z.coerce.number().int(),
      commentId: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Comment deleted',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Comment not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteCommentHandler: RouteHandler<typeof deleteCommentRoute> = async (c) => {
  const auth = c.get('user');
  const { postId, commentId } = c.req.valid('param');
  const db = createDb(c);

  const comment = await db.query.postComments.findFirst({
    where: and(eq(postComments.id, commentId), eq(postComments.postId, postId)),
  });

  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  if (comment.userId !== auth.userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db.delete(postComments).where(eq(postComments.id, commentId));

  return c.json({ success: true }, 200);
};

// POST /feed/:postId/comments/:commentId/like - toggle like on comment
export const toggleCommentLikeRoute = createRoute({
  method: 'post',
  path: '/:postId/comments/:commentId/like',
  tags: ['Feed'],
  summary: 'Toggle like on a comment',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      postId: z.coerce.number().int(),
      commentId: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Like toggled',
      content: { 'application/json': { schema: LikeToggleResponseSchema } },
    },
    404: {
      description: 'Comment not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const toggleCommentLikeHandler: RouteHandler<typeof toggleCommentLikeRoute> = async (c) => {
  const auth = c.get('user');
  const { postId, commentId } = c.req.valid('param');
  const db = createDb(c);

  const comment = await db.query.postComments.findFirst({
    where: and(eq(postComments.id, commentId), eq(postComments.postId, postId)),
  });

  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  const existing = await db.query.commentLikes.findFirst({
    where: and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, auth.userId)),
  });

  if (existing) {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, auth.userId)));
  } else {
    await db.insert(commentLikes).values({ commentId, userId: auth.userId });
  }

  const [likeCountResult] = await db
    .select({ cnt: count() })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));

  return c.json({ liked: !existing, likeCount: likeCountResult?.cnt ?? 0 }, 200);
};

const commentsOpenApiRoutes = [
  defineOpenAPIRoute({ route: listCommentsRoute, handler: listCommentsHandler }),
  defineOpenAPIRoute({ route: addCommentRoute, handler: addCommentHandler }),
  defineOpenAPIRoute({ route: deleteCommentRoute, handler: deleteCommentHandler }),
  defineOpenAPIRoute({ route: toggleCommentLikeRoute, handler: toggleCommentLikeHandler }),
] as const;

const commentsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>().openapiRoutes(
  commentsOpenApiRoutes,
);
export { commentsRoutes };
